import { updateTaskProgress, getTaskInstanceWithTemplate } from "@/db/services";
import { useUserStore } from "@/store";
import type { TaskInstance, TaskTemplate } from "@/db/types";

/**
 * 完成任务并发放积分
 */
export async function completeTask(
  instanceId: number,
  _templateId: number,
  rewardPoints: number,
  complete: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<void> {
  await complete(instanceId);
  // 刷新任务列表以显示完成状态
  await refreshTasks();
  await refreshNoDateTasks();
  // 添加积分，关联到任务实例
  await useUserStore.getState().addPoints(rewardPoints, "task_reward", instanceId);
}

/**
 * 撤回任务并扣除积分
 */
export async function resetTask(
  instanceId: number,
  _templateId: number,
  rewardPoints: number,
  reset: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<void> {
  await reset(instanceId);
  // 刷新任务列表以显示待处理状态
  await refreshTasks();
  await refreshNoDateTasks();
  // 扣除积分，关联到任务实例
  await useUserStore.getState().spendPoints(rewardPoints, "task_reward", instanceId);
}

/**
 * 在 Popup 中完成任务
 */
export async function completeTaskInPopup(
  instance: TaskInstance,
  template: TaskTemplate,
  complete: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>,
  onSuccess: () => void
): Promise<void> {
  await complete(instance.id!);
  await refreshTasks();
  await refreshNoDateTasks();
  await useUserStore.getState().addPoints(template.rewardPoints, "task_reward", instance.id!);
  onSuccess();
}

/**
 * 在 Popup 中撤回任务
 */
export async function resetTaskInPopup(
  instance: TaskInstance,
  template: TaskTemplate,
  reset: (instanceId: number) => Promise<void>,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>,
  onSuccess: () => void
): Promise<void> {
  await reset(instance.id!);
  await refreshTasks();
  await refreshNoDateTasks();
  await useUserStore.getState().spendPoints(template.rewardPoints, "task_reward", instance.id!);
  onSuccess();
}

/**
 * 增加任务计数进度（用于 count 类型任务）
 * 返回更新后的任务实例
 */
export async function incrementTaskCount(
  instance: TaskInstance,
  template: TaskTemplate,
  refreshTasks: () => Promise<void>,
  refreshNoDateTasks: () => Promise<void>
): Promise<{ instance: TaskInstance; template: TaskTemplate } | null> {
  const progressBefore = instance.completeProgress ?? 0;
  const target = template.completeTarget ?? 0;

  // 更新进度（增加1）
  await updateTaskProgress(instance.id!, 1);

  // 如果进度达到目标，发放积分
  const progressAfter = progressBefore + 1;
  if (progressAfter >= target && progressBefore < target) {
    await useUserStore.getState().addPoints(template.rewardPoints, "task_reward", instance.id!);
  }

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
