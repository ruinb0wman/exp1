import type {
  AchievementCondition,
  PointsHistory,
  PomoSession,
  RewardInstance,
  TaskInstance,
} from '@/db/types';
import { CUMULATIVE_CONDITION_TYPES } from '@/db/types';
import { daysBetweenLocal, toLocalDateString } from '@/libs/time';

/** 可用于计算成就进度的原始数据集合 */
export interface AchievementSources {
  instances: TaskInstance[];
  sessions: PomoSession[];
  pointsRecords: PointsHistory[];
  rewardInstances: RewardInstance[];
}

/** 计入「累计积分收入」的积分记录类型（排除 achievement 自身，避免自馈） */
const POINTS_EARNED_TYPES: PointsHistory['type'][] = [
  'task_stage',
  'task_completion',
  'task_reward',
  'admin_adjustment',
];

export function isCumulativeCondition(condition: AchievementCondition): boolean {
  return CUMULATIVE_CONDITION_TYPES.includes(condition.type);
}

/** 按条件过滤任务实例 */
function filterInstances(
  instances: TaskInstance[],
  condition: AchievementCondition
): TaskInstance[] {
  return instances.filter((instance) => {
    if (condition.templateId && instance.templateId !== condition.templateId) {
      return false;
    }
    if (condition.taskType && instance.template?.completeRule?.type !== condition.taskType) {
      return false;
    }
    return true;
  });
}

/**
 * 计算条件的「原始指标值」（未减 baseline）
 * @param windowStartDate 状态/峰值型条件的窗口起点（本地日期 YYYY-MM-DD）
 */
export function computeRawMetric(
  condition: AchievementCondition,
  sources: AchievementSources,
  windowStartDate?: string
): number {
  switch (condition.type) {
    case 'task_complete_count': {
      return filterInstances(sources.instances, condition).filter(
        (instance) => instance.status === 'completed'
      ).length;
    }

    case 'stage_complete_count': {
      return filterInstances(sources.instances, condition).reduce((sum, instance) => {
        const rule = instance.template?.completeRule;
        if (rule?.type === 'subtask') {
          return sum + (instance.completedSubtasks?.filter(Boolean).length ?? 0);
        }
        return sum + (instance.completedStages?.length ?? 0);
      }, 0);
    }

    case 'points_earned': {
      return sources.pointsRecords
        .filter((record) => record.amount > 0 && POINTS_EARNED_TYPES.includes(record.type))
        .reduce((sum, record) => sum + record.amount, 0);
    }

    case 'pomo_focus_minutes':
    case 'pomo_session_count': {
      const mode = condition.mode ?? 'focus';
      const instanceById = new Map(sources.instances.map((instance) => [instance.id, instance]));
      const matched = sources.sessions.filter((session) => {
        if (session.status !== 'completed' || session.mode !== mode) return false;
        if (!condition.templateId) return true;
        if (!session.taskId) return false;
        return instanceById.get(session.taskId)?.templateId === condition.templateId;
      });
      if (condition.type === 'pomo_session_count') {
        return matched.length;
      }
      return matched.reduce((sum, session) => sum + Math.floor(session.actualDuration / 60), 0);
    }

    case 'streak_days':
    case 'daily_task_count': {
      const countsByDate = new Map<string, number>();
      for (const instance of sources.instances) {
        if (instance.status !== 'completed' || !instance.completedAt) continue;
        if (condition.templateId && instance.templateId !== condition.templateId) continue;
        const date = toLocalDateString(instance.completedAt);
        if (windowStartDate && date < windowStartDate) continue;
        countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
      }

      const dates = Array.from(countsByDate.keys()).sort();

      if (condition.type === 'daily_task_count') {
        return dates.reduce((max, date) => Math.max(max, countsByDate.get(date) ?? 0), 0);
      }

      // streak_days：窗口内最长的连续天数
      let longest = 0;
      let current = 0;
      for (let i = 0; i < dates.length; i++) {
        if (i === 0) {
          current = 1;
        } else {
          current = daysBetweenLocal(dates[i - 1], dates[i]) === 1 ? current + 1 : 1;
        }
        longest = Math.max(longest, current);
      }
      return longest;
    }

    case 'reward_redeem_count': {
      return sources.rewardInstances.length;
    }

    default:
      return 0;
  }
}

/**
 * 根据原始指标与接取基线计算进度
 * 累计型：raw − baseline（不小于 0）
 * 状态/峰值型：直接取 raw
 */
export function computeProgress(
  condition: AchievementCondition,
  raw: number,
  baseline: number
): number {
  if (!isCumulativeCondition(condition)) {
    return Math.max(0, raw);
  }
  return Math.max(0, raw - baseline);
}
