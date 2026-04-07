export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
export type EndCondition = 'times' | 'date' | 'manual';
export type TaskStatus = 'pending' | 'completed' | 'skipped';

// ===== 新的完成规则系统 =====

/** 任务类型 */
export type TaskType = 'simple' | 'time' | 'count' | 'subtask';

/** 子任务完成模式 */
export type SubtaskMode = 'all' | 'partial';

/** 阶段定义 */
export interface Stage {
  id: string;           // 唯一标识
  threshold: number;    // 触发阈值（分钟/次数）
  points: number;       // 完成此阶段获得的积分
}

/** 子任务配置（仅 subtask 类型使用） */
export interface SubtaskConfig {
  mode: SubtaskMode;              // all=全部完成, partial=完成n项
  requiredCount?: number;         // partial模式：需要完成的数量
  pointsPerSubtask: number[];     // 每个子任务的积分（按索引对应）
}

/** 完成规则定义（TaskTemplate 使用） */
export interface CompleteRule {
  type: TaskType;
  stages: Stage[];                // 阶段列表，支持无限添加
  completionPoints: number;       // 全部完成后的额外积分
  subtaskConfig?: SubtaskConfig;  // 仅 subtask 类型使用
}

/** 已完成的阶段记录（TaskInstance 使用） */
export interface CompletedStage {
  stageId: string;
  completedAt: string;            // ISO时间戳
  points: number;                 // 当时获得的积分
}

/** 任务模板 */
export interface TaskTemplate {
  id: string;
  userId: number;
  title: string;
  description?: string;
  repeatMode: RepeatMode;
  repeatInterval?: number;
  repeatDaysOfWeek?: number[];
  repeatDaysOfMonth?: number[];
  endCondition: EndCondition;
  endValue?: string;
  enabled: boolean;
  subtasks: string[];
  createdAt: string;
  updatedAt?: string;

  completeRule?: CompleteRule;

  completeTarget?: number;
  completeExpireDays?: number;

  startAt?: string;
}

/** 任务实例 */
export interface TaskInstance {
  id: string;
  userId: number;
  templateId: string;
  template: TaskTemplate;
  status: TaskStatus;
  subtasks: string[];
  startAt?: string;
  instanceDate: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;

  completedStages?: CompletedStage[];
  stagePointsEarned?: number;
  completionPointsEarned?: number;
  completedSubtasks?: boolean[];
  isFullyCompleted?: boolean;

  completeProgress?: number;
}

// ===== 工具函数 =====

/** 计算任务可获得的最大积分 */
export function calculateMaxPoints(rule: CompleteRule): number {
  // simple 类型：直接返回完成积分
  if (rule.type === 'simple') {
    return rule.completionPoints;
  }

  if (rule.type === 'subtask' && rule.subtaskConfig) {
    const config = rule.subtaskConfig;
    if (config.mode === 'all') {
      // 全部完成：所有子任务积分 + 完成额外积分
      return config.pointsPerSubtask.reduce((sum, p) => sum + p, 0) + rule.completionPoints;
    } else {
      // 完成n项：取最高的n个积分 + 完成额外积分
      const sorted = [...config.pointsPerSubtask].sort((a, b) => b - a);
      const topN = sorted.slice(0, config.requiredCount || 1);
      return topN.reduce((sum, p) => sum + p, 0) + rule.completionPoints;
    }
  }

  // time/count 类型：所有阶段积分 + 完成额外积分
  const stagesPoints = rule.stages.reduce((sum, stage) => sum + stage.points, 0);
  return stagesPoints + rule.completionPoints;
}

/** 计算当前进度对应的完成百分比（用于进度条） */
export function calculateProgressPercent(
  progress: number,
  rule: CompleteRule
): number {
  if (rule.type === 'subtask' || rule.stages.length === 0) {
    return 0;
  }
  
  const maxThreshold = Math.max(...rule.stages.map(s => s.threshold));
  return Math.min(100, Math.round((progress / maxThreshold) * 100));
}

/** 获取下一个待完成的阶段 */
export function getNextStage(
  _progress: number,
  rule: CompleteRule,
  completedStages: CompletedStage[]
): Stage | undefined {
  if (rule.type === 'subtask') return undefined;
  
  return rule.stages.find(stage => 
    !completedStages.some(cs => cs.stageId === stage.id)
  );
}

/** 检查是否应该发放完成额外积分 */
export function shouldAwardCompletion(
  rule: CompleteRule,
  completedStages: CompletedStage[],
  completedSubtasks: boolean[]
): boolean {
  if (rule.type === 'subtask' && rule.subtaskConfig) {
    const config = rule.subtaskConfig;
    const completedCount = completedSubtasks.filter(Boolean).length;
    
    if (config.mode === 'all') {
      return completedCount === completedSubtasks.length;
    } else {
      return completedCount >= (config.requiredCount || 1);
    }
  }
  
  // time/count 类型：所有阶段都完成
  return rule.stages.every(stage => 
    completedStages.some(cs => cs.stageId === stage.id)
  );
}

// ==================== taskService 相关类型 ====================

export interface ProgressUpdateResult {
  stagesCompleted: string[];
  stagesReverted: string[];
  pointsEarned: number;
  pointsDeducted: number;
  isFullyCompleted: boolean;
  currentProgress: number;
}

export interface SubtaskUpdateResult {
  completedCount: number;
  pointsEarned: number;
  pointsDeducted: number;
  isFullyCompleted: boolean;
}
