export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
export type EndCondition = 'times' | 'date' | 'manual';
export type TaskStatus = 'pending' | 'completed' | 'skipped';

export interface TaskTemplate {
  id?: number;
  userId: number;
  title: string;  // 标题
  description?: string; // 任务描述
  rewardPoints: number; // 奖励的积分
  repeatMode: RepeatMode; // 重复模式
  repeatInterval?: number;  // 重复周期, repeatMode为daily时. 表示每n天, repeatMode为weekly时表示每n周. repeatMode为monthly是为每n月
  repeatDaysOfWeek?: number[]; // 周, 1-7, 例如[1,5]表示周1和周5创建任务实例
  repeatDaysOfMonth?: number[]; // 月, 1-31, 例如[6,10]表示6号和10号创建任务实例
  endCondition: EndCondition; // 结束方式
  endValue?: string; // 结束日期或次数
  enabled: boolean; // 是否启用
  subtasks: string[]; // 子任务
  isRandomSubtask: boolean; // 是否随机选中一个子任务
  createdAt: string; // 创建时间戳
  updatedAt: string; // 更新时间戳
}

export interface TaskInstance {
  id?: number;
  userId: number;
  templateId: number; // TaskTemplate id
  status: TaskStatus;
  rewardPoints: number;
  subtasks: string[];
  startAt?: string; // 任务开始时间戳
  createAt: string; // 任务实例创建时间戳
  completedAt?: string; // 任务实例完成时间戳
}
