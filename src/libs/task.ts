import type { TaskTemplate, TaskInstance } from '@/db/types';
import { 
  formatLocalDate,
  daysBetweenUTC,
  weeksBetweenUTC,
  monthsBetweenUTC,
} from './time';

/**
 * 将 UTC 时间转换为"用户日期"（本地 YYYY-MM-DD，考虑 dayEndTime 偏移）
 * @param date UTC 时间
 * @param dayEndTime 一天结束时间，格式 "HH:mm"
 * @returns 用户感知日期 YYYY-MM-DD
 */
export function toUserDateString(date: Date | string, dayEndTime: string): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  
  if (d.getHours() < endHour || (d.getHours() === endHour && d.getMinutes() < endMinute)) {
    d.setDate(d.getDate() - 1);
  }
  
  return formatLocalDate(d);
}

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
 * @param existingInstances 该模板已存在的所有实例
 * @param targetDate 目标日期（本地时间），默认为今天
 * @param dayEndTime 一天结束时间，格式 "HH:mm"，默认 "00:00"
 */
export function shouldGenerateInstanceOnDate(
  template: TaskTemplate,
  existingInstances: TaskInstance[],
  targetDate: Date = new Date(),
  dayEndTime: string = "00:00"
): boolean {
  const { repeatMode, repeatInterval, repeatDaysOfWeek, repeatDaysOfMonth, startAt } = template;

  const hasInstanceOnDate = (): boolean => {
    const targetUserDate = toUserDateString(targetDate, dayEndTime);
    return existingInstances.some((inst) => {
      if (!inst.instanceDate) return false;
      return inst.instanceDate === targetUserDate;
    });
  };

  switch (repeatMode) {
    case 'none': {
      return existingInstances.length === 0;
    }

    case 'daily': {
      if (hasInstanceOnDate()) return false;
      if (!startAt) return false;
      const interval = repeatInterval || 1;
      const daysDiff = daysBetweenUTC(startAt, targetDate);
      return daysDiff >= 0 && daysDiff % interval === 0;
    }

    case 'weekly': {
      if (hasInstanceOnDate()) return false;
      if (!startAt) return false;
      const interval = repeatInterval || 1;
      const currentUserDateStr = toUserDateString(targetDate, dayEndTime);
      const currentDayOfWeek = new Date(currentUserDateStr).getDay();

      if (!repeatDaysOfWeek || !repeatDaysOfWeek.includes(currentDayOfWeek)) {
        return false;
      }

      const daysDiff = daysBetweenUTC(startAt, targetDate);
      const weeksDiff = Math.floor(daysDiff / 7);
      return weeksDiff >= 0 && weeksDiff % interval === 0;
    }

    case 'monthly': {
      if (hasInstanceOnDate()) return false;
      if (!startAt) return false;
      const interval = repeatInterval || 1;
      const currentUserDateStr = toUserDateString(targetDate, dayEndTime);
      const currentDayOfMonth = new Date(currentUserDateStr).getDate();

      if (!repeatDaysOfMonth || !repeatDaysOfMonth.includes(currentDayOfMonth)) {
        return false;
      }

      const monthsDiff = monthsBetweenUTC(startAt, targetDate);
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
  return shouldGenerateInstanceOnDate(template, existingInstances, new Date(), "00:00");
}

/**
 * 过滤出指定日期需要生成实例的任务模板
 * @param dayEndTime 一天结束时间，格式 "HH:mm"，默认 "00:00"
 */
export function filterTemplatesNeedingInstancesOnDate(
  templates: TaskTemplate[],
  existingInstances: TaskInstance[],
  targetDate: Date = new Date(),
  dayEndTime: string = "00:00"
): TaskTemplate[] {
  return templates.filter((template) => {
    if (!template.enabled) {
      return false;
    }

    const templateInstances = existingInstances.filter(
      (inst) => inst.templateId === template.id
    );

    if (isTemplateEndedOnDate(template, templateInstances, targetDate)) {
      return false;
    }

    if (template.repeatMode !== 'none' && !template.startAt) {
      console.warn(`Template ${template.id} (${template.title}) has no startAt, skipping`);
      return false;
    }

    return shouldGenerateInstanceOnDate(template, templateInstances, targetDate, dayEndTime);
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
  return filterTemplatesNeedingInstancesOnDate(templates, existingInstances, new Date(), "00:00");
}

/**
 * 为任务模板生成任务实例数据
 * @param dayEndTime 本地时间的"一天结束"，格式 "HH:mm"
 */
export function generateTaskInstance(
  template: TaskTemplate,
  date?: Date,
  dayEndTime?: string
): Omit<TaskInstance, 'id'> {
  const targetDate = date || new Date();
  const effectiveDayEndTime = dayEndTime || "00:00";

  const subtasks = template.subtasks || [];

  let instanceDate: string;

  if (template.repeatMode === 'none') {
    if (template.startAt) {
      instanceDate = template.startAt.split('T')[0];
    } else {
      instanceDate = toUserDateString(new Date(), effectiveDayEndTime);
    }
  } else {
    instanceDate = toUserDateString(targetDate, effectiveDayEndTime);
  }

  const now = new Date().toISOString();
  const rule = template.completeRule;

  return {
    userId: template.userId,
    templateId: template.id,
    template: { ...template },
    status: 'pending',
    subtasks: [...subtasks],
    instanceDate,
    createdAt: now,

    completeProgress: rule && rule.type !== 'subtask' ? 0 : undefined,

    completedStages: [],
    stagePointsEarned: 0,
    completionPointsEarned: 0,
    completedSubtasks: subtasks.map(() => false),
    isFullyCompleted: false,
  };
}

/**
 * 批量生成任务实例
 */
export function generateTaskInstances(
  templates: TaskTemplate[],
  date?: Date,
  dayEndTime?: string
): Omit<TaskInstance, 'id' | 'createdAt'>[] {
  return templates.map((template) => generateTaskInstance(template, date, dayEndTime));
}

// ==================== taskService 相关工具函数 ====================

/**
 * 获取任务的完成进度百分比
 * @param instance 任务实例
 * @returns 0-100 的百分比
 */
export function getTaskProgressPercent(instance: TaskInstance): number {
  const template = instance.template;
  if (!template?.completeRule) {
    return instance.status === 'completed' ? 100 : 0;
  }

  const rule = template.completeRule;

  if (rule.type === 'subtask') {
    const completedCount = (instance.completedSubtasks || []).filter(Boolean).length;
    const config = rule.subtaskConfig;
    const targetCount = config?.mode === 'all' 
      ? instance.subtasks.length 
      : (config?.requiredCount || 1);
    return Math.min(100, Math.round((completedCount / targetCount) * 100));
  }

  // time/count 类型
  if (rule.stages.length === 0) {
    return instance.status === 'completed' ? 100 : 0;
  }

  const progress = instance.completeProgress ?? 0;
  const maxThreshold = Math.max(...rule.stages.map(s => s.threshold));
  return Math.min(100, Math.round((progress / maxThreshold) * 100));
}

/**
 * 获取下一个待完成的阶段
 */
export function getNextStage(instance: TaskInstance): import('@/db/types').Stage | undefined {
  const template = instance.template;
  if (!template?.completeRule || template.completeRule.type === 'subtask') {
    return undefined;
  }

  const rule = template.completeRule;
  const completedStages = instance.completedStages || [];

  return rule.stages.find(stage => 
    !completedStages.some(cs => cs.stageId === stage.id)
  );
}

/**
 * 获取已获得的总积分
 */
export function getTotalPointsEarned(instance: TaskInstance): number {
  return (instance.stagePointsEarned || 0) + (instance.completionPointsEarned || 0);
}
