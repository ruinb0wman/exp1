export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
export type EndCondition = 'times' | 'date' | 'manual';
export type TaskStatus = 'pending' | 'completed' | 'skipped';
export type CompleteRule = 'time' | 'count';

export interface TaskTemplate {
  id?: number;
  userId: number;
  title: string;  // 标题
  description?: string; // 任务描述
  rewardPoints: number; // 奖励的积分
  repeatMode: RepeatMode; // 重复模式
  repeatInterval?: number;  // 重复周期, repeatMode为daily时. 表示每n天, repeatMode为weekly时表示每n周. repeatMode为monthly是为每n月
  repeatDaysOfWeek?: number[]; // 周, 0-6, 例如[1,5]表示周1和周5创建任务实例
  repeatDaysOfMonth?: number[]; // 月, 1-31, 例如[6,10]表示6号和10号创建任务实例
  endCondition: EndCondition; // 结束方式
  endValue?: string; // 结束日期或次数
  enabled: boolean; // 是否启用
  subtasks: string[]; // 子任务
  isRandomSubtask: boolean; // 是否随机选中一个子任务
  createdAt: string; // 创建时间戳
  updatedAt: string; // 更新时间戳

  // 完成规则相关字段
  completeRule?: CompleteRule; // 完成规则：'time' 时间(分钟) / 'count' 次数
  completeTarget?: number; // 目标值（分钟或次数）
  completeExpireDays?: number; // 过期天数（0 或 undefined 表示不过期）

  // 任务开始时间
  startAt?: string; // 任务开始日期（YYYY-MM-DD），undefined 表示从今天开始
}

export interface TaskInstance {
  id?: number;
  userId: number;
  templateId: number; // TaskTemplate id（保留作为引用）
  template: TaskTemplate; // 完整的模板副本（生成时的快照），包含 rewardPoints 等字段
  status: TaskStatus;
  subtasks: string[];
  startAt?: string; // 任务开始时间戳
  createdAt: string; // 任务实例创建时间戳
  updatedAt: string; // 任务实例更新时间戳（用于同步）
  completedAt?: string; // 任务实例完成时间戳

  // 进度相关字段
  completeProgress?: number; // 当前进度（分钟或次数），默认 0
  expiredAt?: string; // 过期时间戳
}
