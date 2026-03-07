import type { TaskTemplate, TaskInstance } from '@/db/types';
import { 
  getUserStartOfDay, 
  calculateExpiredAt, 
  formatLocalDate,
  daysBetweenUTC,
  weeksBetweenUTC,
  monthsBetweenUTC,
  getUTCTimestamp,
  isSameUTCDay,
} from './time';

// 重新导出 formatLocalDate 以保持兼容性
export { formatLocalDate };

/**
 * 获取今天的本地日期字符串 (YYYY-MM-DD)
 * 用于显示和逻辑判断，实际存储使用UTC
 */
export function getTodayString(): string {
  const now = new Date();
  return formatLocalDate(now);
}

/**
 * 获取指定UTC时间的当天开始时间 (ISO格式，UTC 00:00:00)
 * @deprecated 使用 time.ts 中的 getUserStartOfDay 或 createUTCStartOfDay
 */
export function getStartOfDay(date: Date): string {
  const d = new Date(date);
  // 设置为当天的UTC开始时间
  const utcStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  return new Date(utcStart).toISOString();
}

/**
 * 获取指定UTC时间的当天结束时间 (ISO格式，UTC 23:59:59.999)
 * @deprecated 使用 time.ts 中的 getUserEndOfDay 或 createUTCEndOfDay
 */
export function getEndOfDay(date: Date): string {
  const d = new Date(date);
  // 设置为当天的UTC结束时间
  const utcEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
  return new Date(utcEnd).toISOString();
}

/**
 * 计算两个UTC日期之间的天数差
 * @deprecated 使用 time.ts 中的 daysBetweenUTC
 */
export function daysBetween(date1: Date, date2: Date): number {
  return daysBetweenUTC(date1, date2);
}

/**
 * 计算两个UTC日期之间的周数差
 * @deprecated 使用 time.ts 中的 weeksBetweenUTC
 */
export function weeksBetween(date1: Date, date2: Date): number {
  return weeksBetweenUTC(date1, date2);
}

/**
 * 计算两个UTC日期之间的月数差
 * @deprecated 使用 time.ts 中的 monthsBetweenUTC
 */
export function monthsBetween(date1: Date, date2: Date): number {
  return monthsBetweenUTC(date1, date2);
}

/**
 * 判断任务模板在指定日期是否已满足结束条件
 * 使用UTC时间进行比较
 */
export function isTemplateEndedOnDate(
  template: TaskTemplate,
  existingInstances: TaskInstance[],
  targetDate: Date = new Date()
): boolean {
  const { endCondition, endValue } = template;

  if (endCondition === 'manual') {
    return false;
  }

  if (endCondition === 'date' && endValue) {
    // endValue 存储的是 UTC ISO 格式或 YYYY-MM-DD 格式
    const endDate = new Date(endValue);
    // 设置为UTC当天的最后一刻
    const endDateUTC = new Date(Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
      23, 59, 59, 999
    ));
    return targetDate.getTime() > endDateUTC.getTime();
  }

  if (endCondition === 'times' && endValue) {
    const maxTimes = parseInt(endValue, 10);
    return existingInstances.length >= maxTimes;
  }

  return false;
}

/**
 * 判断任务模板是否已满足结束条件（兼容旧代码）
 * @deprecated 使用 isTemplateEndedOnDate 代替
 */
export function isTemplateEnded(
  template: TaskTemplate,
  existingInstances: TaskInstance[]
): boolean {
  return isTemplateEndedOnDate(template, existingInstances, new Date());
}

/**
 * 判断指定日期是否需要为该模板生成任务实例
 * 使用UTC时间进行计算
 * @param existingInstances 该模板已存在的所有实例
 * @param targetDate 目标日期（本地时间），默认为今天
 */
export function shouldGenerateInstanceOnDate(
  template: TaskTemplate,
  existingInstances: TaskInstance[],
  targetDate: Date = new Date()
): boolean {
  const { repeatMode, repeatInterval, repeatDaysOfWeek, repeatDaysOfMonth, startAt } = template;

  switch (repeatMode) {
    case 'none': {
      // 不重复：只生成一次，检查是否已经有实例
      return existingInstances.length === 0;
    }

    case 'daily': {
      // 每日：检查间隔天数，使用 startAt 作为基准
      if (!startAt) return false; // 周期性任务必须有 startAt
      const interval = repeatInterval || 1;
      const daysDiff = daysBetweenUTC(startAt, targetDate);
      return daysDiff >= 0 && daysDiff % interval === 0;
    }

    case 'weekly': {
      // 每周：检查是否在指定星期几，且满足间隔周数，使用 startAt 作为基准
      if (!startAt) return false;
      const baseDate = new Date(startAt);
      const interval = repeatInterval || 1;
      const currentDayOfWeek = targetDate.getDay(); // 0-6，使用本地时间的星期几

      // 检查目标日期是否在指定的星期几列表中
      if (!repeatDaysOfWeek || !repeatDaysOfWeek.includes(currentDayOfWeek)) {
        return false;
      }

      // 检查是否满足间隔周数（基于UTC时间计算）
      const weeksDiff = weeksBetweenUTC(baseDate, targetDate);
      return weeksDiff >= 0 && weeksDiff % interval === 0;
    }

    case 'monthly': {
      // 每月：检查是否在指定日期，且满足间隔月数，使用 startAt 作为基准
      if (!startAt) return false;
      const baseDate = new Date(startAt);
      const interval = repeatInterval || 1;
      const currentDayOfMonth = targetDate.getDate(); // 使用本地时间的日期

      // 检查目标日期是否在指定的日期列表中
      if (!repeatDaysOfMonth || !repeatDaysOfMonth.includes(currentDayOfMonth)) {
        return false;
      }

      // 检查是否满足间隔月数（基于UTC时间计算）
      const monthsDiff = monthsBetweenUTC(baseDate, targetDate);
      return monthsDiff >= 0 && monthsDiff % interval === 0;
    }

    default:
      return false;
  }
}

/**
 * 判断今天是否需要为该模板生成任务实例（兼容旧代码）
 * @deprecated 使用 shouldGenerateInstanceOnDate 代替
 */
export function shouldGenerateInstanceToday(
  template: TaskTemplate,
  existingInstances: TaskInstance[]
): boolean {
  return shouldGenerateInstanceOnDate(template, existingInstances, new Date());
}

/**
 * 过滤出指定日期需要生成实例的任务模板
 * 使用UTC时间进行日期比较
 */
export function filterTemplatesNeedingInstancesOnDate(
  templates: TaskTemplate[],
  existingInstances: TaskInstance[],
  targetDate: Date = new Date()
): TaskTemplate[] {
  return templates.filter((template) => {
    // 只处理启用的模板
    if (!template.enabled) {
      return false;
    }

    // 获取该模板的所有实例
    const templateInstances = existingInstances.filter(
      (inst) => inst.templateId === template.id
    );

    // 检查在目标日期是否已满足结束条件
    if (isTemplateEndedOnDate(template, templateInstances, targetDate)) {
      return false;
    }

    // 对于周期性任务（repeatMode !== 'none'），必须确保 startAt 存在
    if (template.repeatMode !== 'none' && !template.startAt) {
      console.warn(`Template ${template.id} (${template.title}) has no startAt, skipping`);
      return false;
    }

    // 对于 repeatMode 为 'none' 的，只检查是否已经有实例
    if (template.repeatMode === 'none') {
      return shouldGenerateInstanceOnDate(template, templateInstances, targetDate);
    }

    // 对于其他 repeatMode，检查目标日期是否已经生成过实例
    // 统一使用UTC日期比较
    const hasInstanceOnDate = templateInstances.some((inst) => {
      if (!inst.startAt) return false;
      // 使用UTC时间比较是否是同一天
      return isSameUTCDay(inst.startAt, targetDate);
    });
    if (hasInstanceOnDate) {
      return false;
    }

    // 检查目标日期是否应该生成实例
    return shouldGenerateInstanceOnDate(template, templateInstances, targetDate);
  });
}

/**
 * 过滤出今天需要生成实例的任务模板（兼容旧代码）
 * @deprecated 使用 filterTemplatesNeedingInstancesOnDate 代替
 */
export function filterTemplatesNeedingInstances(
  templates: TaskTemplate[],
  existingInstances: TaskInstance[]
): TaskTemplate[] {
  return filterTemplatesNeedingInstancesOnDate(templates, existingInstances, new Date());
}

/**
 * 为任务模板生成任务实例数据（使用UTC时间）
 * @param dayEndTime 本地时间的"一天结束"，格式 "HH:mm"
 */
export function generateTaskInstance(
  template: TaskTemplate,
  dayEndTime: string = "00:00",
  date?: Date
): Omit<TaskInstance, 'id' | 'createdAt'> {
  const targetDate = date || new Date();

  // 如果启用随机子任务且存在子任务，随机选择一个
  let subtasks = template.subtasks || [];
  if (template.isRandomSubtask && subtasks.length > 0) {
    const randomIndex = Math.floor(Math.random() * subtasks.length);
    subtasks = [subtasks[randomIndex]];
  }

  // 根据 repeatMode 和 template.startAt 决定 instance.startAt
  let startAt: string | undefined;

  if (template.repeatMode === 'none') {
    // 一次性任务：如果 template.startAt 存在，转换为当天的 UTC 开始时间
    if (template.startAt) {
      const date = new Date(template.startAt);
      startAt = getUserStartOfDay(date, dayEndTime);
    }
  } else {
    // 周期性任务：基于目标日期生成 startAt（UTC格式）
    startAt = getUserStartOfDay(targetDate, dayEndTime);
  }

  // 计算过期时间（UTC）
  let expiredAt: string | undefined;
  if (startAt && template.completeExpireDays && template.completeExpireDays > 0) {
    expiredAt = calculateExpiredAt(startAt, template.completeExpireDays);
  }

  return {
    userId: template.userId,
    templateId: template.id!,
    status: 'pending',
    rewardPoints: template.rewardPoints,
    subtasks: [...subtasks],
    startAt,
    completeProgress: template.completeRule ? 0 : undefined,
    expiredAt,
  };
}

/**
 * 批量生成任务实例（使用UTC时间）
 */
export function generateTaskInstances(
  templates: TaskTemplate[],
  dayEndTime?: string,
  date?: Date
): Omit<TaskInstance, 'id' | 'createdAt'>[] {
  return templates.map((template) => generateTaskInstance(template, dayEndTime, date));
}
