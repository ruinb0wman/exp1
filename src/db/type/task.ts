export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
export type EndCondition = 'times' | 'date' | 'manual';
export type TaskStatus = 'pending' | 'completed' | 'skipped';

export interface TaskTemplate {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  rewardPoints: number;
  repeatMode: RepeatMode;
  repeatInterval?: number;
  repeatDaysOfWeek?: number[];
  repeatDaysOfMonth?: number[];
  endCondition: EndCondition;
  endValue?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  subtasks: string[];
  isRandomSubtask: boolean;
}

export interface TaskInstance {
  id?: number;
  userId: number;
  templateId: number;
  scheduledDate?: string;
  status: TaskStatus;
  completedAt?: string;
  rewardPoints: number;
  subtasks: string[];
}
