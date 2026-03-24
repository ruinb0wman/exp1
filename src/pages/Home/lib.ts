import { updateTaskProgress, getTaskInstanceWithTemplate } from "@/db/services";
import type { TaskInstance, TaskTemplate } from "@/db/types";

/**
 * 完成任务
 * 积分奖励由中间件自动处理
 */
export async function completeTask(
  instanceId: number,
  _templateId: number,
  _rewardPoints: number,
  complete: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<void> {
  await complete(instanceId);
  // 刷新任务列表以显示完成状态
  await refreshTasks();
  await refreshNoDateTasks();
  // 积分奖励由中间件自动处理
}

/**
 * 撤回任务
 * 积分扣除由中间件自动处理
 */
export async function resetTask(
  instanceId: number,
  _templateId: number,
  _rewardPoints: number,
  reset: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<void> {
  await reset(instanceId);
  // 刷新任务列表以显示待处理状态
  await refreshTasks();
  await refreshNoDateTasks();
  // 积分扣除由中间件自动处理
}

/**
 * 在 Popup 中完成任务
 * 积分奖励由中间件自动处理
 */
export async function completeTaskInPopup(
  instance: TaskInstance,
  _template: TaskTemplate,
  complete: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>,
  onSuccess: () => void
): Promise<void> {
  await complete(instance.id!);
  await refreshTasks();
  await refreshNoDateTasks();
  // 积分奖励由中间件自动处理
  onSuccess();
}

/**
 * 在 Popup 中撤回任务
 * 积分扣除由中间件自动处理
 */
export async function resetTaskInPopup(
  instance: TaskInstance,
  _template: TaskTemplate,
  reset: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>,
  onSuccess: () => void
): Promise<void> {
  await reset(instance.id!);
  await refreshTasks();
  await refreshNoDateTasks();
  // 积分扣除由中间件自动处理
  onSuccess();
}

/**
 * 增加任务计数进度（用于 count 类型任务）
 * 返回更新后的任务实例
 */
export async function incrementTaskCount(
  instance: TaskInstance,
  _template: TaskTemplate,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<{ instance: TaskInstance; template: TaskTemplate } | null> {
  // 更新进度（增加1）
  // 积分奖励由中间件自动处理（当任务状态变为 completed 时）
  await updateTaskProgress(instance.id!, 1);

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
