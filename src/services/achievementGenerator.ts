import { getDB } from '@/db';
import {
  createProposals,
  deleteProposals,
  getAchievementById,
  getMostActiveTemplate,
} from '@/db/services';
import { calculateMaxPoints } from '@/db/types';
import type { Achievement, AchievementStatus, TaskType } from '@/db/types';
import { toLocalDateString } from '@/libs/time';
import { computeRawMetric, type AchievementSources } from '@/libs/achievement/metrics';
import { parseProposals } from '@/libs/achievement/parseProposals';
import { buildPresetProposals } from '@/libs/achievement/presets';
import { llmChat, type LlmChatMessage } from '@/services/llmService';

export interface AchievementContextTask {
  id: string;
  title: string;
  type: TaskType;
  repeatMode: string;
  subtaskCount: number;
  maxPoints: number;
  completedCount: number;
}

export interface AchievementContextStats {
  tasksCompleted: number;
  totalPointsEarned: number;
  currentStreak: number;
  pomoFocusMinutes: number;
  pomoSessions: number;
  itemsRedeemed: number;
  activeDays: number;
  last30dCompleted: number;
  avgDailyTasks: number;
}

export interface AchievementContext {
  tasks: AchievementContextTask[];
  stats: AchievementContextStats;
  existing: { title: string; status: AchievementStatus }[];
}

const MAX_CONTEXT_TASKS = 20;
const MAX_HISTORY_CHARS = 60;

async function loadSources(userId: number): Promise<AchievementSources> {
  const db = getDB();
  const [instances, sessions, pointsRecords, rewardPurchases] = await Promise.all([
    db.taskInstances.where('userId').equals(userId).toArray(),
    db.pomoSessions.where('userId').equals(userId).toArray(),
    db.pointsHistory.where('userId').equals(userId).toArray(),
    db.rewardPurchases.where('userId').equals(userId).toArray(),
  ]);
  return { instances, sessions, pointsRecords, rewardPurchases };
}

/** 采集生成成就所需的上下文（不包含任务描述全文） */
export async function buildContext(userId: number): Promise<AchievementContext> {
  const db = getDB();
  const [templates, achievements, sources] = await Promise.all([
    db.taskTemplates.where('userId').equals(userId).toArray(),
    db.achievements.where('userId').equals(userId).toArray(),
    loadSources(userId),
  ]);

  const completedByTemplate = new Map<string, number>();
  for (const instance of sources.instances) {
    if (instance.status !== 'completed') continue;
    completedByTemplate.set(
      instance.templateId,
      (completedByTemplate.get(instance.templateId) ?? 0) + 1
    );
  }

  const tasks: AchievementContextTask[] = templates
    .map((template) => ({
      id: template.id,
      title: template.title,
      type: template.completeRule?.type ?? 'simple',
      repeatMode: template.repeatMode,
      subtaskCount: template.subtasks?.length ?? 0,
      maxPoints: template.completeRule ? calculateMaxPoints(template.completeRule) : 0,
      completedCount: completedByTemplate.get(template.id) ?? 0,
    }))
    .sort((a, b) => b.completedCount - a.completedCount)
    .slice(0, MAX_CONTEXT_TASKS);

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoDate = toLocalDateString(thirtyDaysAgo);

  const activeDates = new Set<string>();
  let last30dCompleted = 0;
  for (const instance of sources.instances) {
    if (instance.status !== 'completed' || !instance.completedAt) continue;
    const date = toLocalDateString(instance.completedAt);
    activeDates.add(date);
    if (date >= thirtyDaysAgoDate) last30dCompleted += 1;
  }

  const stats: AchievementContextStats = {
    tasksCompleted: sources.instances.filter((item) => item.status === 'completed').length,
    totalPointsEarned: computeRawMetric({ type: 'points_earned', target: 1 }, sources),
    currentStreak: computeRawMetric({ type: 'streak_days', target: 1 }, sources),
    pomoFocusMinutes: computeRawMetric({ type: 'pomo_focus_minutes', target: 1 }, sources),
    pomoSessions: computeRawMetric({ type: 'pomo_session_count', target: 1 }, sources),
    itemsRedeemed: sources.rewardPurchases.length,
    activeDays: activeDates.size,
    last30dCompleted,
    avgDailyTasks: Math.round((last30dCompleted / 30) * 10) / 10,
  };

  return {
    tasks,
    stats,
    existing: achievements.map((item) => ({ title: item.title, status: item.status })),
  };
}

/** 构造提示词 */
export function buildPrompt(
  context: AchievementContext,
  locale: 'zh' | 'en',
  feedback?: string
): LlmChatMessage[] {
  const language = locale === 'en' ? 'English' : '简体中文';

  const system = [
    'You design in-game achievement quests for a gamified task-management app.',
    `Write title and description in ${language}.`,
    '',
    'Return ONLY a JSON object shaped exactly like:',
    '{"achievements":[{"title":string,"description":string,"icon":string,"condition":{"type":string,"target":number,"templateId"?:string,"taskType"?:string,"mode"?:string},"rewardPoints":number}]}',
    '',
    'Allowed condition.type values and their meaning:',
    '- task_complete_count: number of completed task instances (optional templateId, optional taskType)',
    '- stage_complete_count: number of completed stages / subtasks (optional templateId)',
    '- points_earned: total points earned from tasks',
    '- pomo_focus_minutes: total focused minutes',
    '- pomo_session_count: number of completed pomodoro sessions (optional mode: focus|shortBreak|longBreak)',
    '- streak_days: consecutive days with at least one completion',
    '- daily_task_count: tasks completed within a single day (peak)',
    '- reward_redeem_count: number of rewards redeemed',
    '',
    'Rules:',
    '- Produce 3 to 5 achievements.',
    '- condition.target must be an integer between 1 and 100000 and must be meaningfully challenging but reachable.',
    '- templateId is only valid if it appears in context.tasks[].id. Omit it for global achievements.',
    '- taskType is only allowed for task_complete_count and must be one of: simple, time, count, subtask.',
    '- Do not duplicate the titles already listed in context.existing.',
    '- icon must be one of: Trophy, Medal, Flame, Target, Rocket, Crown, Star, Zap, Award, Shield, Swords, Gem, Compass, Dumbbell, BookOpen, Timer, CalendarCheck, TrendingUp, Sparkles, Mountain, Bike, Heart, Lightbulb, GraduationCap.',
    '- rewardPoints is an integer between 1 and 1000. Calibrate it by difficulty: about 10 task completions ≈ 30-60 points, a 7-day streak ≈ 100-200 points, 1000 focused minutes ≈ 150 points.',
    '- title must be at most 40 characters, description at most 120 characters.',
    '- Prefer achievements that reference the user\'s actual tasks when that makes them more personal.',
  ].join('\n');

  const payload = {
    tasks: context.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      repeatMode: task.repeatMode,
      subtaskCount: task.subtaskCount,
      maxPoints: task.maxPoints,
      completedCount: task.completedCount,
    })),
    stats: context.stats,
    existing: context.existing.slice(0, MAX_HISTORY_CHARS),
  };

  const user = [
    'Here is the user\'s current data as JSON:',
    JSON.stringify(payload),
    '',
    'Generate personalized achievement quests that build on these tasks and habits.',
  ].join('\n');

  const messages: LlmChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  if (feedback) {
    messages.push({
      role: 'user',
      content: `Your previous response could not be parsed (${feedback}). Reply again with ONLY the JSON object described above.`,
    });
  }

  return messages;
}

export interface GenerateAchievementsResult {
  achievements: Achievement[];
  model?: string;
  dropped: number;
}

/**
 * 调用 LLM 生成成就提案
 * - 校验失败时携带错误反馈重试 1 次
 * - 网络/鉴权错误直接抛出，不做重试
 */
export async function generateAchievements(
  userId: number,
  locale: 'zh' | 'en' = 'zh'
): Promise<GenerateAchievementsResult> {
  const context = await buildContext(userId);
  const validTemplateIds = new Set(context.tasks.map((task) => task.id));
  const templateTitles = new Map(context.tasks.map((task) => [task.id, task.title]));

  let lastError = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = buildPrompt(context, locale, attempt === 0 ? undefined : lastError);
    const response = await llmChat(messages, { temperature: 0.7, jsonMode: true });

    try {
      const parsed = parseProposals(response.content, { validTemplateIds });

      // 仅在解析成功后清空旧的未接取提案，避免生成失败时丢失已有提案
      await deleteProposals(userId);

      const ids = await createProposals(userId, parsed.proposals, {
        source: 'llm',
        model: response.model,
        templateTitles,
      });
      const created = await Promise.all(ids.map((id) => getAchievementById(id)));

      return {
        achievements: created.filter((item): item is Achievement => Boolean(item)),
        model: response.model,
        dropped: parsed.dropped,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`模型返回的成就格式无法解析（${lastError}）`);
}

/** 未配置 API Key 或生成失败时的兜底：内置推荐成就 */
export async function generatePresetAchievements(userId: number): Promise<Achievement[]> {
  await deleteProposals(userId);
  const mostActive = await getMostActiveTemplate(userId);
  const proposals = buildPresetProposals(mostActive);
  const templateTitles = new Map(
    mostActive ? [[mostActive.id, mostActive.title] as [string, string]] : []
  );

  const ids = await createProposals(userId, proposals, {
    source: 'preset',
    templateTitles,
  });
  const created = await Promise.all(ids.map((id) => getAchievementById(id)));
  return created.filter((item): item is Achievement => Boolean(item));
}
