export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
export type EndCondition = 'times' | 'date' | 'manual';
export type TaskStatus = 'pending' | 'completed' | 'skipped';

// ===== 新的完成规则系统 =====

/** 任务类型 */
export type TaskType = 'time' | 'count' | 'subtask';

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
  id?: number;
  userId: number;
  title: string;                  // 标题
  description?: string;           // 任务描述
  rewardPoints: number;           // 【已废弃】保留兼容性，实际积分由 stages 决定
  repeatMode: RepeatMode;         // 重复模式
  repeatInterval?: number;        // 重复周期
  repeatDaysOfWeek?: number[];    // 周重复，0-6
  repeatDaysOfMonth?: number[];   // 月重复，1-31
  endCondition: EndCondition;     // 结束方式
  endValue?: string;              // 结束日期或次数
  enabled: boolean;               // 是否启用
  subtasks: string[];             // 子任务列表
  isRandomSubtask: boolean;       // 是否随机选中一个子任务
  createdAt: string;              // 创建时间戳
  updatedAt: string;              // 更新时间戳

  // 【新】完成规则
  completeRule?: CompleteRule;

  // 【旧】兼容字段（将被移除）
  completeTarget?: number;        // 目标值（分钟或次数）
  completeExpireDays?: number;    // 过期天数（0 或 undefined 表示不过期）

  // 任务开始时间
  startAt?: string;               // 任务开始日期（YYYY-MM-DD）
}

/** 任务实例 */
export interface TaskInstance {
  id?: number;
  userId: number;
  templateId: number;             // TaskTemplate id（保留作为引用）
  template: TaskTemplate;         // 完整的模板副本（生成时的快照）
  status: TaskStatus;
  subtasks: string[];
  startAt?: string;               // 任务开始时间戳
  createdAt: string;              // 任务实例创建时间戳
  updatedAt: string;              // 任务实例更新时间戳（用于同步）
  completedAt?: string;           // 任务实例完成时间戳

  // 【新】阶段追踪相关字段
  completedStages?: CompletedStage[];    // 已完成的阶段
  stagePointsEarned?: number;            // 已从阶段获得的总积分
  completionPointsEarned?: number;       // 已获得的完成额外积分
  completedSubtasks?: boolean[];         // 每个子任务的完成状态（subtask类型使用）
  isFullyCompleted?: boolean;            // 是否已发放完成额外积分

  // 【保留】进度相关字段
  completeProgress?: number;      // 当前进度（分钟或次数），time/count类型使用
  expiredAt?: string;             // 过期时间戳
}

// ===== 工具函数 =====

/** 计算任务可获得的最大积分 */
export function calculateMaxPoints(rule: CompleteRule): number {
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
