import { describe, it, expect, beforeEach } from 'vitest';
import { getDB } from '@/db';
import type { Achievement, TaskInstance, TaskTemplate, User } from '@/db/types';
import {
  abandonAchievement,
  acceptAchievement,
  createProposals,
  deleteProposals,
  evaluateAll,
  getAchievementById,
  reconcileOrphanedAchievements,
} from './achievementService';

const db = getDB();

function template(id: string): TaskTemplate {
  return {
    id,
    userId: 1,
    title: `Template ${id}`,
    repeatMode: 'daily',
    endCondition: 'manual',
    enabled: true,
    subtasks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    completeRule: { type: 'simple', stages: [], completionPoints: 10 },
  } as unknown as TaskTemplate;
}

function instance(id: string, templateId: string, completed: boolean): TaskInstance {
  return {
    id,
    userId: 1,
    templateId,
    template: template(templateId),
    status: completed ? 'completed' : 'pending',
    subtasks: [],
    instanceDate: '2026-05-01',
    createdAt: '2026-05-01T00:00:00.000Z',
    completedAt: completed ? '2026-05-01T10:00:00.000Z' : undefined,
  } as unknown as TaskInstance;
}

function user(): User {
  return {
    id: 1,
    name: 'User',
    totalPoints: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

async function seedCompletedInstances(count: number, templateId = 't1'): Promise<void> {
  const rows = Array.from({ length: count }, (_, index) =>
    instance(`i${index}`, templateId, true)
  );
  await db.taskInstances.bulkAdd(rows);
}

async function createProposal(overrides: Partial<Achievement> = {}): Promise<string> {
  const ids = await createProposals(
    1,
    [
      {
        title: '完成 1 个任务',
        description: '测试用成就',
        icon: 'Trophy',
        condition: { type: 'task_complete_count', target: 1 },
        rewardPoints: 30,
      },
    ],
    { source: 'preset' }
  );
  if (Object.keys(overrides).length > 0) {
    await db.achievements.update(ids[0], overrides);
  }
  return ids[0];
}

describe('achievementService', () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.taskTemplates.clear();
    await db.taskInstances.clear();
    await db.pointsHistory.clear();
    await db.rewardPurchases.clear();
    await db.pomoSessions.clear();
    await db.achievements.clear();
    await db.users.add(user());
  });

  it('接取时记录累计基线，进度从零开始', async () => {
    await seedCompletedInstances(3);
    const id = await createProposal();

    await acceptAchievement(id);

    const accepted = await getAchievementById(id);
    expect(accepted?.status).toBe('active');
    expect(accepted?.baseline).toBe(3);
    expect(accepted?.progress).toBe(0);
    expect(accepted?.acceptedAt).toBeTruthy();
  });

  it('接取后可覆盖标题、描述、图标与奖励分', async () => {
    const id = await createProposal();

    await acceptAchievement(id, {
      title: '自定义标题',
      description: '自定义描述',
      icon: 'Rocket',
      rewardPoints: 99,
    });

    const accepted = await getAchievementById(id);
    expect(accepted?.title).toBe('自定义标题');
    expect(accepted?.description).toBe('自定义描述');
    expect(accepted?.icon).toBe('Rocket');
    expect(accepted?.rewardPoints).toBe(99);
  });

  it('达标后解锁，写入一条 achievement 积分记录并累加总积分', async () => {
    const id = await createProposal();
    await acceptAchievement(id);

    await db.taskInstances.add(instance('after', 't1', true));

    const unlocked = await evaluateAll(1);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe(id);

    const record = await db.pointsHistory.where('relatedInstanceId').equals(id).toArray();
    expect(record).toHaveLength(1);
    expect(record[0].type).toBe('achievement');
    expect(record[0].amount).toBe(30);

    const updatedUser = await db.users.get(1);
    expect(updatedUser?.totalPoints).toBe(30);

    const achievement = await getAchievementById(id);
    expect(achievement?.status).toBe('unlocked');
    expect(achievement?.progress).toBe(achievement?.condition.target);
    expect(achievement?.unlockedAt).toBeTruthy();
  });

  it('重复判定不会重复发分', async () => {
    const id = await createProposal();
    await acceptAchievement(id);
    await db.taskInstances.add(instance('after', 't1', true));

    await evaluateAll(1);
    await evaluateAll(1);
    await evaluateAll(1);

    const records = await db.pointsHistory.where('relatedInstanceId').equals(id).toArray();
    expect(records).toHaveLength(1);
    const updatedUser = await db.users.get(1);
    expect(updatedUser?.totalPoints).toBe(30);
  });

  it('未达标时只更新进度，不发分', async () => {
    const ids = await createProposals(
      1,
      [
        {
          title: '完成 5 个任务',
          description: '',
          icon: 'Trophy',
          condition: { type: 'task_complete_count', target: 5 },
          rewardPoints: 50,
        },
      ],
      { source: 'preset' }
    );
    await acceptAchievement(ids[0]);
    await seedCompletedInstances(2, 't1');

    const unlocked = await evaluateAll(1);
    expect(unlocked).toHaveLength(0);

    const achievement = await getAchievementById(ids[0]);
    expect(achievement?.status).toBe('active');
    expect(achievement?.progress).toBe(2);
  });

  it('放弃成就后不再参与判定', async () => {
    const id = await createProposal();
    await acceptAchievement(id);
    await abandonAchievement(id);

    await db.taskInstances.add(instance('after', 't1', true));
    const unlocked = await evaluateAll(1);

    expect(unlocked).toHaveLength(0);
    expect(await getAchievementById(id)).toMatchObject({ status: 'abandoned' });
    expect(await db.pointsHistory.where('relatedInstanceId').equals(id).count()).toBe(0);
  });

  it('deleteProposals 只删除未接取的提案', async () => {
    const pendingId = await createProposal();
    const activeId = await createProposal();
    await acceptAchievement(activeId);

    const deleted = await deleteProposals(1);

    expect(deleted).toBe(1);
    expect(await getAchievementById(pendingId)).toBeUndefined();
    expect(await getAchievementById(activeId)).toBeDefined();
  });

  it('绑定的模板不存在时标记为 orphaned 并冻结进度', async () => {
    await db.taskTemplates.add(template('t1'));
    const ids = await createProposals(
      1,
      [
        {
          title: '模板成就',
          description: '',
          icon: 'Trophy',
          condition: { type: 'task_complete_count', target: 1, templateId: 't1' },
          rewardPoints: 20,
        },
      ],
      { source: 'preset' }
    );
    await acceptAchievement(ids[0]);

    // 模板仍然存在 -> 不标记孤儿
    expect(await reconcileOrphanedAchievements(1)).toBe(0);

    // 模板被删除 -> 标记孤儿
    await db.taskTemplates.delete('t1');
    expect(await reconcileOrphanedAchievements(1)).toBe(1);

    const achievement = await getAchievementById(ids[0]);
    expect(achievement?.orphaned).toBe(true);

    // 孤儿成就冻结，不再解锁
    await db.taskInstances.add(instance('after', 't1', true));
    const unlocked = await evaluateAll(1);
    expect(unlocked).toHaveLength(0);
    expect(await db.pointsHistory.where('relatedInstanceId').equals(ids[0]).count()).toBe(0);
  });

  it('接取已接取的成就是幂等操作', async () => {
    await seedCompletedInstances(3);
    const id = await createProposal();

    await acceptAchievement(id);
    await acceptAchievement(id);

    const achievement = await getAchievementById(id);
    expect(achievement?.baseline).toBe(3);
  });
});
