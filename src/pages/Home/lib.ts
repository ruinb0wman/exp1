import { updateTaskProgress, completeSubtask, getTaskInstanceWithTemplate } from "@/db/services";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { calculateMaxPoints } from "@/db/types";

/**
 * 计算今日预估可获得的总积分
 * 基于每个任务的 completeRule 计算最大积分
 */
export function calculateEstimatedTotalPoints(
  tasks: { instance: TaskInstance; template: TaskTemplate }[]
): number {
  return tasks.reduce((total, { template }) => {
    const rule = template.completeRule;
    if (!rule) return total;
    return total + calculateMaxPoints(rule);
  }, 0);
}

/**
 * 计算今日已获得的积分
 * simple 类型任务：已完成时返回 completionPoints
 * 其他类型：累加 stagePointsEarned 和 completionPointsEarned
 */
export function calculateTodayEarnedPoints(
  tasks: { instance: TaskInstance; template: TaskTemplate }[]
): number {
  return tasks.reduce((total, { instance, template }) => {
    const rule = template.completeRule;
    
    // simple 类型：已完成时返回 completionPoints
    if (rule?.type === 'simple' && instance.status === 'completed') {
      return total + (rule.completionPoints || 0);
    }
    
    // 其他类型：使用已有的字段
    return total + (instance.stagePointsEarned || 0) + (instance.completionPointsEarned || 0);
  }, 0);
}

/**
 * 完成任务（简单任务）
 * 积分奖励由中间件自动处理
 */
export async function completeTask(
  instanceId: number,
  complete: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<void> {
  await complete(instanceId);
  await refreshTasks();
  await refreshNoDateTasks();
}

/**
 * 撤回任务
 */
export async function resetTask(
  instanceId: number,
  reset: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<void> {
  await reset(instanceId);
  await refreshTasks();
  await refreshNoDateTasks();
}

/**
 * 在 Popup 中完成任务
 */
export async function completeTaskInPopup(
  instance: TaskInstance,
  _template: TaskTemplate,
  complete: (instanceId: string) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>,
  onSuccess: () => void
): Promise<void> {
  await complete(instance.id!);
  await refreshTasks();
  await refreshNoDateTasks();
  onSuccess();
}

/**
 * 在 Popup 中撤回任务
 */
export async function resetTaskInPopup(
  instance: TaskInstance,
  _template: TaskTemplate,
  reset: (instanceId: string) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>,
  onSuccess: () => void
): Promise<void> {
  await reset(instance.id!);
  await refreshTasks();
  await refreshNoDateTasks();
  onSuccess();
}

/**
 * 增加任务计数进度（用于 count 类型任务）
 * 新系统：使用绝对进度值而非增量
 */
export async function incrementTaskCount(
  instance: TaskInstance,
  _template: TaskTemplate,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<{ instance: TaskInstance; template: TaskTemplate } | null> {
  // 获取当前进度并加1
  const currentProgress = instance.completeProgress || 0;
  const newProgress = currentProgress + 1;
  
  // 更新进度（使用绝对值）
  await updateTaskProgress(instance.id!, newProgress);

  // 刷新任务列表
  await refreshTasks();
  await refreshNoDateTasks();

  // 获取更新后的任务状态
  const updated = await getTaskInstanceWithTemplate(instance.id!);
  if (!updated) return null;
  return {
    instance: updated.instance,
    template: updated.template!,
  };
}

/**
 * 切换子任务完成状态（用于 subtask 类型任务）
 */
export async function toggleSubtaskCompletion(
  instance: TaskInstance,
  subtaskIndex: number,
  completed: boolean,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<{ instance: TaskInstance; template: TaskTemplate } | null> {
  // 更新子任务状态
  await completeSubtask(instance.id!, subtaskIndex, completed);

  // 刷新任务列表
  await refreshTasks();
  await refreshNoDateTasks();

  // 获取更新后的任务状态
  const updated = await getTaskInstanceWithTemplate(instance.id!);
  if (!updated) return null;
  return {
    instance: updated.instance,
    template: updated.template!,
  };
}

/**
 * 计算任务统计
 */
export function calculateTaskStats(tasks: { instance: TaskInstance; template: TaskTemplate }[]): {
  completedCount: number;
  totalCount: number;
} {
  const completedCount = tasks.filter(({ instance }) => instance.status === "completed").length;
  const totalCount = tasks.length;
  return { completedCount, totalCount };
}

/**
 * 过滤待处理任务
 */
export function filterPendingTasks<T extends { instance: TaskInstance }>(tasks: T[]): T[] {
  return tasks.filter(({ instance }) => instance.status === "pending");
}

export function filterTodayTasks<T extends { instance: TaskInstance }>(
  tasks: T[]
): T[] {
  return tasks;
}
