import {
  ACHIEVEMENT_CONDITION_TYPES,
  ACHIEVEMENT_ICONS,
  type AchievementCondition,
  type AchievementConditionType,
  type AchievementIconName,
  type AchievementProposal,
  type PomoMode,
  type TaskType,
} from '@/db/types';

export const MAX_PROPOSALS = 5;
export const MIN_TARGET = 1;
export const MAX_TARGET = 100000;
export const MIN_REWARD = 1;
export const MAX_REWARD = 1000;

const TASK_TYPES: TaskType[] = ['simple', 'time', 'count', 'subtask'];
const POMO_MODES: PomoMode[] = ['focus', 'shortBreak', 'longBreak'];

export interface ParseProposalsContext {
  /** 当前用户的模板 id 集合；不在集合内的 templateId 会被降级为全局成就 */
  validTemplateIds: Set<string>;
}

export interface ParseProposalsResult {
  proposals: AchievementProposal[];
  /** 被丢弃的非法条目数 */
  dropped: number;
}

/**
 * 从模型输出中容错提取 JSON：
 * - 去掉 ```json 围栏
 * - 截取首个 `{` / `[` 到末个 `}` / `]` 之间的内容
 */
export function extractJson(raw: string): unknown {
  if (!raw) {
    throw new Error('EMPTY_RESPONSE');
  }

  let text = raw.trim();

  // 去掉 markdown 代码围栏
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let start = -1;
  let end = -1;

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = text.lastIndexOf('}');
  } else if (firstBracket >= 0) {
    start = firstBracket;
    end = text.lastIndexOf(']');
  }

  if (start < 0 || end <= start) {
    throw new Error('NO_JSON_FOUND');
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('INVALID_JSON');
  }
}

/** 从解析结果中取出候选数组 */
function extractCandidates(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    for (const key of ['achievements', 'items', 'data', 'result']) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
}

function clampInt(value: unknown, min: number, max: number): number | null {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** 校验并规范化单条提案，非法时返回 null */
export function normalizeProposal(
  raw: unknown,
  context: ParseProposalsContext
): AchievementProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
  if (!rawTitle) return null;

  const rawCondition =
    item.condition && typeof item.condition === 'object'
      ? (item.condition as Record<string, unknown>)
      : null;
  if (!rawCondition) return null;

  const conditionType = rawCondition.type;
  if (
    typeof conditionType !== 'string' ||
    !ACHIEVEMENT_CONDITION_TYPES.includes(conditionType as AchievementConditionType)
  ) {
    return null;
  }

  const target = clampInt(rawCondition.target, MIN_TARGET, MAX_TARGET);
  if (target === null) return null;

  const condition: AchievementCondition = {
    type: conditionType as AchievementConditionType,
    target,
  };

  // templateId 必须命中当前用户的任务列表，否则降级为全局成就
  if (typeof rawCondition.templateId === 'string' && rawCondition.templateId) {
    if (context.validTemplateIds.has(rawCondition.templateId)) {
      condition.templateId = rawCondition.templateId;
    }
  }

  if (
    condition.type === 'task_complete_count' &&
    typeof rawCondition.taskType === 'string' &&
    TASK_TYPES.includes(rawCondition.taskType as TaskType)
  ) {
    condition.taskType = rawCondition.taskType as TaskType;
  }

  if (
    condition.type === 'pomo_session_count' &&
    typeof rawCondition.mode === 'string' &&
    POMO_MODES.includes(rawCondition.mode as PomoMode)
  ) {
    condition.mode = rawCondition.mode as PomoMode;
  }

  const icon: AchievementIconName =
    typeof item.icon === 'string' && ACHIEVEMENT_ICONS.includes(item.icon as AchievementIconName)
      ? (item.icon as AchievementIconName)
      : 'Trophy';

  const rewardPoints = clampInt(item.rewardPoints, MIN_REWARD, MAX_REWARD) ?? MIN_REWARD;

  const description = typeof item.description === 'string' ? item.description.trim() : '';

  return {
    title: truncate(rawTitle, 40),
    description: truncate(description, 120),
    icon,
    condition,
    rewardPoints,
  };
}

/**
 * 解析模型输出为成就提案
 * - 丢弃非法条目
 * - 最多保留 MAX_PROPOSALS 条
 * - 无合法条目时抛出可读错误
 */
export function parseProposals(
  raw: string,
  context: ParseProposalsContext
): ParseProposalsResult {
  const parsed = extractJson(raw);
  const candidates = extractCandidates(parsed);

  if (candidates.length === 0) {
    throw new Error('NO_CANDIDATES');
  }

  const proposals: AchievementProposal[] = [];
  let dropped = 0;

  for (const candidate of candidates) {
    const normalized = normalizeProposal(candidate, context);
    if (normalized) {
      proposals.push(normalized);
    } else {
      dropped += 1;
    }
  }

  if (proposals.length === 0) {
    throw new Error('NO_VALID_PROPOSALS');
  }

  return {
    proposals: proposals.slice(0, MAX_PROPOSALS),
    dropped: dropped + Math.max(0, proposals.length - MAX_PROPOSALS),
  };
}
