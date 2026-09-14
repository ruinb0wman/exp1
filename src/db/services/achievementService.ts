import { getDB } from '../index';
import type { Achievement, AchievementProposal, AchievementSource, AchievementStatus, PointsHistory } from '../types';
import { hashPointsHistory } from '@/libs/id';
import { toLocalDateString } from '@/libs/time';
import {
  computeProgress,
  computeRawMetric,
  isCumulativeCondition,
  type AchievementSources,
} from '@/libs/achievement/metrics';

/** 生成提案时使用的提示词版本，便于追溯 */
export const ACHIEVEMENT_PROMPT_VERSION = 'v1';

/** 成就判定重入锁，避免 liveQuery 回环 */
let isEvaluating = false;

async function loadSources(
  db: ReturnType<typeof getDB>,
  userId: number
): Promise<AchievementSources> {
  const [instances, sessions, pointsRecords, rewardInstances] = await Promise.all([
    db.taskInstances.where('userId').equals(userId).toArray(),
    db.pomoSessions.where('userId').equals(userId).toArray(),
    db.pointsHistory.where('userId').equals(userId).toArray(),
    db.rewardInstances.where('userId').equals(userId).toArray(),
  ]);
  return { instances, sessions, pointsRecords, rewardInstances };
}

// ==================== 查询 ====================

export async function getAchievements(userId: number): Promise<Achievement[]> {
  const db = getDB();
  const list = await db.achievements.where('userId').equals(userId).toArray();
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAchievementsByStatus(
  userId: number,
  status: AchievementStatus
): Promise<Achievement[]> {
  const db = getDB();
  const list = await db.achievements
    .where('[userId+status]')
    .equals([userId, status])
    .toArray();
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAchievementById(id: string): Promise<Achievement | undefined> {
  const db = getDB();
  return db.achievements.get(id);
}

/** 找出用户最活跃的任务模板（按已完成实例数），用于预设成就与提示词 */
export async function getMostActiveTemplate(
  userId: number
): Promise<{ id: string; title: string } | undefined> {
  const db = getDB();
  const [instances, templates] = await Promise.all([
    db.taskInstances.where('userId').equals(userId).toArray(),
    db.taskTemplates.where('userId').equals(userId).toArray(),
  ]);

  const counts = new Map<string, number>();
  for (const instance of instances) {
    if (instance.status !== 'completed') continue;
    counts.set(instance.templateId, (counts.get(instance.templateId) ?? 0) + 1);
  }

  let best: string | undefined;
  let bestCount = -1;
  for (const [templateId, count] of counts) {
    if (count > bestCount) {
      best = templateId;
      bestCount = count;
    }
  }

  const target = templates.find((t) => t.id === best) ?? templates.find((t) => t.enabled);
  return target ? { id: target.id, title: target.title } : undefined;
}

// ==================== 提案 ====================

export interface CreateProposalsMeta {
  source: AchievementSource;
  model?: string;
  templateTitles?: Map<string, string>;
}

/** 写入成就提案（status = proposed） */
export async function createProposals(
  userId: number,
  proposals: AchievementProposal[],
  meta: CreateProposalsMeta
): Promise<string[]> {
  const db = getDB();
  const now = new Date().toISOString();

  const records = proposals.map((proposal) => ({
    userId,
    title: proposal.title,
    description: proposal.description,
    icon: proposal.icon,
    condition: proposal.condition,
    rewardPoints: proposal.rewardPoints,
    status: 'proposed' as AchievementStatus,
    source: meta.source,
    baseline: 0,
    progress: 0,
    model: meta.model,
    promptVersion: ACHIEVEMENT_PROMPT_VERSION,
    templateTitleSnapshot: proposal.condition.templateId
      ? meta.templateTitles?.get(proposal.condition.templateId)
      : undefined,
    createdAt: now,
  })) as unknown as Achievement[];

  const keys = await db.achievements.bulkAdd(records, { allKeys: true });
  return keys as string[];
}

/** 删除用户所有未接取的提案 */
export async function deleteProposals(userId: number): Promise<number> {
  const db = getDB();
  const proposed = await db.achievements
    .where('[userId+status]')
    .equals([userId, 'proposed'])
    .toArray();
  if (proposed.length === 0) return 0;
  await db.achievements.bulkDelete(proposed.map((item) => item.id));
  return proposed.length;
}

// ==================== 接取 / 放弃 ====================

export interface AcceptAchievementOverrides {
  title?: string;
  description?: string;
  icon?: Achievement['icon'];
  rewardPoints?: number;
}

/**
 * 接取成就：记录累计型条件的 baseline，进度从零开始
 */
export async function acceptAchievement(
  id: string,
  overrides: AcceptAchievementOverrides = {}
): Promise<void> {
  const db = getDB();
  const achievement = await db.achievements.get(id);
  if (!achievement) {
    throw new Error('成就不存在');
  }
  if (achievement.status === 'active') return;

  const sources = await loadSources(db, achievement.userId);
  const baseline = isCumulativeCondition(achievement.condition)
    ? computeRawMetric(achievement.condition, sources)
    : 0;

  await db.achievements.update(id, {
    ...overrides,
    status: 'active',
    acceptedAt: new Date().toISOString(),
    baseline,
    progress: 0,
  });
}

/** 删除单条成就（仅用于丢弃提案） */
export async function deleteAchievement(id: string): Promise<void> {
  const db = getDB();
  await db.achievements.delete(id);
}

/** 放弃进行中的成就 */
export async function abandonAchievement(id: string): Promise<void> {
  const db = getDB();
  const achievement = await db.achievements.get(id);
  if (!achievement) return;
  await db.achievements.update(id, {
    status: 'abandoned',
    abandonedAt: new Date().toISOString(),
  });
}

// ==================== 判定 ====================

/**
 * 判定用户所有进行中的成就，返回本次新解锁的成就
 * 幂等：已解锁的成就不会重复发分
 */
export async function evaluateAll(userId: number): Promise<Achievement[]> {
  if (isEvaluating) return [];
  isEvaluating = true;

  try {
    const db = getDB();
    await reconcileOrphanedAchievements(userId);

    const active = await db.achievements
      .where('[userId+status]')
      .equals([userId, 'active'])
      .toArray();

    const pending = active.filter((item) => !item.orphaned);
    if (pending.length === 0) return [];

    const sources = await loadSources(db, userId);

    const progressUpdates: { key: string; changes: { progress: number } }[] = [];
    const toUnlock: { achievement: Achievement; progress: number }[] = [];

    for (const achievement of pending) {
      const windowStartDate = isCumulativeCondition(achievement.condition)
        ? undefined
        : achievement.acceptedAt
          ? toLocalDateString(achievement.acceptedAt)
          : undefined;

      const raw = computeRawMetric(achievement.condition, sources, windowStartDate);
      const progress = computeProgress(achievement.condition, raw, achievement.baseline);

      if (progress >= achievement.condition.target) {
        toUnlock.push({ achievement, progress });
      } else if (progress !== achievement.progress) {
        progressUpdates.push({ key: achievement.id, changes: { progress } });
      }
    }

    if (progressUpdates.length > 0) {
      await db.achievements.bulkUpdate(progressUpdates);
    }

    const unlocked: Achievement[] = [];
    for (const { achievement } of toUnlock) {
      const result = await unlockAchievement(achievement);
      if (result) unlocked.push(result);
    }

    return unlocked;
  } finally {
    isEvaluating = false;
  }
}

/** 解锁单条成就（事务内幂等），返回解锁后的记录；若已被处理则返回 null */
async function unlockAchievement(achievement: Achievement): Promise<Achievement | null> {
  const db = getDB();
  const now = new Date().toISOString();
  const target = achievement.condition.target;

  const result = await db.transaction(
    'rw',
    [db.achievements, db.pointsHistory, db.users],
    async () => {
      const fresh = await db.achievements.get(achievement.id);
      if (!fresh || fresh.status !== 'active') return null;

      await db.achievements.update(achievement.id, {
        status: 'unlocked',
        unlockedAt: now,
        progress: target,
      });

      if (fresh.rewardPoints > 0) {
        await db.pointsHistory.put({
          id: hashPointsHistory(fresh.id, 'achievement'),
          userId: fresh.userId,
          amount: fresh.rewardPoints,
          type: 'achievement',
          relatedInstanceId: fresh.id,
          description: `成就达成：${fresh.title}`,
          createdAt: now,
        } as unknown as PointsHistory);

        const user = await db.users.get(fresh.userId);
        if (user) {
          await db.users.update(fresh.userId, {
            totalPoints: Math.max(0, (user.totalPoints || 0) + fresh.rewardPoints),
          });
        }
      }

      return { ...fresh, status: 'unlocked' as AchievementStatus, unlockedAt: now, progress: target };
    }
  );

  return result ?? null;
}

// ==================== 孤儿处理 ====================

/**
 * 校正孤儿成就：绑定的任务模板已不存在时，标记 orphaned 并冻结
 * 在判定前以及删除任务后调用
 */
export async function reconcileOrphanedAchievements(userId?: number): Promise<number> {
  const db = getDB();
  const all = userId !== undefined
    ? await db.achievements.where('userId').equals(userId).toArray()
    : await db.achievements.toArray();

  const candidates = all.filter(
    (item) =>
      !item.orphaned &&
      !!item.condition.templateId &&
      (item.status === 'proposed' || item.status === 'active')
  );
  if (candidates.length === 0) return 0;

  const templateIds = Array.from(
    new Set(candidates.map((item) => item.condition.templateId as string))
  );
  const existing = await db.taskTemplates.bulkGet(templateIds);
  const existingIds = new Set(
    existing.filter(Boolean).map((template) => (template as { id: string }).id)
  );

  const affected = candidates.filter(
    (item) => !existingIds.has(item.condition.templateId as string)
  );
  if (affected.length === 0) return 0;

  await db.achievements.bulkUpdate(
    affected.map((item) => ({ key: item.id, changes: { orphaned: true } }))
  );
  return affected.length;
}
