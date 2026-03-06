import type { TaskTemplate, TaskInstance } from '@/db/types';

/**
 * 获取今天的日期字符串 (YYYY-MM-DD) - 使用本地时区
 */
export function getTodayString(): string {
  const now = new Date();
  return formatLocalDate(now);
}

/**
 * 获取本地日期字符串 (YYYY-MM-DD)
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取指定日期的开始时间 (ISO 格式，本地时区的 00:00:00)
 */
export function getStartOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * 获取指定日期的结束时间 (ISO 格式)
 */
export function getEndOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * 计算两个日期之间的天数差
 */
export function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 计算两个日期之间的周数差
 */
export function weeksBetween(date1: Date, date2: Date): number {
  return Math.floor(daysBetween(date1, date2) / 7);
}

/**
 * 计算两个日期之间的月数差
 */
export function monthsBetween(date1: Date, date2: Date): number {
  return (date2.getFullYear() - date1.getFullYear()) * 12 + (date2.getMonth() - date1.getMonth());
}

/**
 * 判断任务模板在指定日期是否已满足结束条件
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
    const endDate = new Date(endValue);
    endDate.setHours(23, 59, 59, 999);
    return targetDate > endDate;
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
 * @param existingInstances 该模板已存在的所有实例
 * @param targetDate 目标日期，默认为今天
 */
export function shouldGenerateInstanceOnDate(
  template: TaskTemplate,
  existingInstances: TaskInstance[],
  targetDate: Date = new Date()
): boolean {
  const { repeatMode, repeatInterval, repeatDaysOfWeek, repeatDaysOfMonth, createdAt } = template;
  const created = new Date(createdAt);

  switch (repeatMode) {
    case 'none': {
      // 不重复：只生成一次，检查是否已经有实例
      return existingInstances.length === 0;
    }

    case 'daily': {
      // 每日：检查间隔天数
      const interval = repeatInterval || 1;
      const daysDiff = daysBetween(created, targetDate);
      return daysDiff % interval === 0;
    }

    case 'weekly': {
      // 每周：检查是否在指定星期几，且满足间隔周数
      const interval = repeatInterval || 1;
      const currentDayOfWeek = targetDate.getDay(); // 0-6

      // 检查目标日期是否在指定的星期几列表中
      if (!repeatDaysOfWeek || !repeatDaysOfWeek.includes(currentDayOfWeek)) {
        return false;
      }

      // 检查是否满足间隔周数
      const weeksDiff = weeksBetween(created, targetDate);
      return weeksDiff % interval === 0;
    }

    case 'monthly': {
      // 每月：检查是否在指定日期，且满足间隔月数
      const interval = repeatInterval || 1;
      const currentDayOfMonth = targetDate.getDate();

      // 检查目标日期是否在指定的日期列表中
      if (!repeatDaysOfMonth || !repeatDaysOfMonth.includes(currentDayOfMonth)) {
        return false;
      }

      // 检查是否满足间隔月数
      const monthsDiff = monthsBetween(created, targetDate);
      return monthsDiff % interval === 0;
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

    // 对于 repeatMode 为 'none' 的，只检查是否已经有实例
    if (template.repeatMode === 'none') {
      return shouldGenerateInstanceOnDate(template, templateInstances, targetDate);
    }

    // 对于其他 repeatMode，检查目标日期是否已经生成过实例
    // 统一使用本地日期字符串来比较，避免时区问题
    const targetDateStr = formatLocalDate(targetDate); // YYYY-MM-DD (本地时区)
    const hasInstanceOnDate = templateInstances.some((inst) => {
      // 从 ISO 格式的 startAt 中提取本地日期
      if (!inst.startAt) return false;
      const instDate = new Date(inst.startAt);
      const instanceDateStr = formatLocalDate(instDate);
      return instanceDateStr === targetDateStr;
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
 * 为任务模板生成任务实例数据
 */
export function generateTaskInstance(
  template: TaskTemplate,
  date?: Date
): Omit<TaskInstance, 'id' | 'createAt'> {
  const targetDate = date || new Date();

  // 如果启用随机子任务且存在子任务，随机选择一个
  let subtasks = template.subtasks || [];
  if (template.isRandomSubtask && subtasks.length > 0) {
    const randomIndex = Math.floor(Math.random() * subtasks.length);
    subtasks = [subtasks[randomIndex]];
  }

  // repeatMode 为 'none' 时不设置 startAt
  const startAt = template.repeatMode === 'none' 
    ? undefined 
    : getStartOfDay(targetDate);

  return {
    userId: template.userId,
    templateId: template.id!,
    status: 'pending',
    rewardPoints: template.rewardPoints,
    subtasks: [...subtasks],
    startAt,
  };
}

/**
 * 批量生成任务实例
 */
export function generateTaskInstances(
  templates: TaskTemplate[],
  date?: Date
): Omit<TaskInstance, 'id' | 'createAt'>[] {
  return templates.map((template) => generateTaskInstance(template, date));
}
