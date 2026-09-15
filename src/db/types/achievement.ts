import type { TaskType } from './task';
import type { PomoMode } from './pomo';

/** 成就图标白名单（lucide 图标名） */
export const ACHIEVEMENT_ICONS = [
  'Trophy',
  'Medal',
  'Flame',
  'Target',
  'Rocket',
  'Crown',
  'Star',
  'Zap',
  'Award',
  'Shield',
  'Swords',
  'Gem',
  'Compass',
  'Dumbbell',
  'BookOpen',
  'Timer',
  'CalendarCheck',
  'TrendingUp',
  'Sparkles',
  'Mountain',
  'Bike',
  'Heart',
  'Lightbulb',
  'GraduationCap',
] as const;

export type AchievementIconName = (typeof ACHIEVEMENT_ICONS)[number];

/** 成就条件类型 */
export type AchievementConditionType =
  | 'task_complete_count' // 完成任务数
  | 'stage_complete_count' // 阶段 / 子任务达成次数
  | 'points_earned' // 累计积分收入
  | 'pomo_focus_minutes' // 专注分钟数
  | 'pomo_session_count' // 完成的专注番茄数
  | 'streak_days' // 连续 N 天有完成记录
  | 'daily_task_count' // 单日完成 N 个任务（峰值）
  | 'reward_redeem_count'; // 消费次数（购买即消费）

export const ACHIEVEMENT_CONDITION_TYPES: AchievementConditionType[] = [
  'task_complete_count',
  'stage_complete_count',
  'points_earned',
  'pomo_focus_minutes',
  'pomo_session_count',
  'streak_days',
  'daily_task_count',
  'reward_redeem_count',
];

/**
 * 累计型条件：进度 = 当前原始值 − 接取时 baseline
 * 其余（streak_days / daily_task_count）为状态/峰值型：只在接取日之后的窗口内计算
 */
export const CUMULATIVE_CONDITION_TYPES: AchievementConditionType[] = [
  'task_complete_count',
  'stage_complete_count',
  'points_earned',
  'pomo_focus_minutes',
  'pomo_session_count',
  'reward_redeem_count',
];

export interface AchievementCondition {
  type: AchievementConditionType;
  target: number;
  /** 绑定具体任务模板（可选） */
  templateId?: string;
  /** 仅 task_complete_count 使用 */
  taskType?: TaskType;
  /** 仅 pomo_session_count 使用，默认 'focus' */
  mode?: PomoMode;
}

export type AchievementStatus = 'proposed' | 'active' | 'unlocked' | 'abandoned';

export type AchievementSource = 'llm' | 'preset';

export interface Achievement {
  id: string;
  userId: number;
  title: string;
  description: string;
  icon: AchievementIconName;
  condition: AchievementCondition;
  /** 奖励积分，接取时可编辑 */
  rewardPoints: number;
  status: AchievementStatus;
  source: AchievementSource;
  /** 累计型条件的接取基线 */
  baseline: number;
  /** 缓存进度 */
  progress: number;
  /** 绑定模板标题快照，模板删除后用于展示 */
  templateTitleSnapshot?: string;
  /** 绑定的任务模板已被删除 */
  orphaned?: boolean;
  /** 生成该提案使用的模型 */
  model?: string;
  promptVersion: string;
  createdAt: string;
  acceptedAt?: string;
  unlockedAt?: string;
  abandonedAt?: string;
  updatedAt?: string;
}

/** 生成的成就提案（未落库前） */
export interface AchievementProposal {
  title: string;
  description: string;
  icon: AchievementIconName;
  condition: AchievementCondition;
  rewardPoints: number;
}
