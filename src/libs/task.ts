import type { TaskTemplate, TaskInstance } from '@/db/types';
import { 
  getUserStartOfDay, 
  calculateExpiredAt, 
  formatLocalDate,
  daysBetweenUTC,
  weeksBetweenUTC,
  monthsBetweenUTC,
  isExpired,
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
  
  // 如果当前本地时间 < dayEndTime，算前一天
  if (d.getHours() < endHour || (d.getHours() === endHour && d.getMinutes() < endMinute)) {
    d.setDate(d.getDate() - 1);
  }
  
  return formatLocalDate(d);
}

/**
 * 计算两个 UTC 时间之间的"用户天数差"（考虑 dayEndTime）
 */
function daysBetweenUserDates(
  date1: Date | string, 
  date2: Date | string, 
  dayEndTime: string
): number {
  const userDate1 = toUserDateString(date1, dayEndTime);
  const userDate2 = toUserDateString(date2, dayEndTime);
  
  const d1 = new Date(userDate1);
  const d2 = new Date(userDate2);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 计算两个 UTC 时间之间的"用户月数差"（考虑 dayEndTime）
 */
function monthsBetweenUserDates(
  date1: Date | string, 
  date2: Date | string, 
  dayEndTime: string
): number {
  const userDate1 = toUserDateString(date1, dayEndTime);
  const userDate2 = toUserDateString(date2, dayEndTime);
  
  const [y1, m1] = userDate1.split('-').map(Number);
  const [y2, m2] = userDate2.split('-').map(Number);
  
  return (y2 - y1) * 12 + (m2 - m1);
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
 * 使用"用户日期"进行计算（考虑 dayEndTime 偏移）
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

  // 辅助函数：检查是否已有目标日期的实例（使用"用户日期"比较）
  const hasInstanceOnDate = (): boolean => {
    const targetUserDate = toUserDateString(targetDate, dayEndTime);
    return existingInstances.some((inst) => {
      if (!inst.startAt) return false;
      const instUserDate = toUserDateString(inst.startAt, dayEndTime);
      return instUserDate === targetUserDate;
    });
  };

  switch (repeatMode) {
    case 'none': {
      // 不重复：只生成一次，检查是否已经有实例
      return existingInstances.length === 0;
    }

    case 'daily': {
      // 每日：先检查是否已存在该日期的实例
      if (hasInstanceOnDate()) return false;
      
      // 检查间隔天数（基于用户日期），使用 startAt 作为基准
      if (!startAt) return false; // 周期性任务必须有 startAt
      const interval = repeatInterval || 1;
      // 使用"用户日期"计算天数差
      const daysDiff = daysBetweenUserDates(startAt, targetDate, dayEndTime);
      return daysDiff >= 0 && daysDiff % interval === 0;
    }

    case 'weekly': {
      // 每周：先检查是否已存在该日期的实例
      if (hasInstanceOnDate()) return false;
      
      // 检查是否在指定星期几，且满足间隔周数（基于用户日期）
      if (!startAt) return false;
      const interval = repeatInterval || 1;
      // 使用"用户日期"获取星期几
      const currentUserDateStr = toUserDateString(targetDate, dayEndTime);
      const currentDayOfWeek = new Date(currentUserDateStr).getDay(); // 0-6

      // 检查目标日期的用户日期是否在指定的星期几列表中
      if (!repeatDaysOfWeek || !repeatDaysOfWeek.includes(currentDayOfWeek)) {
        return false;
      }

      // 检查是否满足间隔周数（基于用户日期计算）
      const daysDiff = daysBetweenUserDates(startAt, targetDate, dayEndTime);
      const weeksDiff = Math.floor(daysDiff / 7);
      return weeksDiff >= 0 && weeksDiff % interval === 0;
    }

    case 'monthly': {
      // 每月：先检查是否已存在该日期的实例
      if (hasInstanceOnDate()) return false;
      
      // 检查是否在指定日期，且满足间隔月数（基于用户日期）
      if (!startAt) return false;
      const interval = repeatInterval || 1;
      // 使用"用户日期"获取日期
      const currentUserDateStr = toUserDateString(targetDate, dayEndTime);
      const currentDayOfMonth = new Date(currentUserDateStr).getDate();

      // 检查目标日期的用户日期是否在指定的日期列表中
      if (!repeatDaysOfMonth || !repeatDaysOfMonth.includes(currentDayOfMonth)) {
        return false;
      }

      // 检查是否满足间隔月数（基于用户日期计算）
      const monthsDiff = monthsBetweenUserDates(startAt, targetDate, dayEndTime);
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
 * 使用"用户日期"进行日期比较（考虑 dayEndTime）
 * @param dayEndTime 一天结束时间，格式 "HH:mm"，默认 "00:00"
 */
export function filterTemplatesNeedingInstancesOnDate(
  templates: TaskTemplate[],
  existingInstances: TaskInstance[],
  targetDate: Date = new Date(),
  dayEndTime: string = "00:00"
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

    // 对于 repeatMode 为 'none' 的，只检查是否已经有实例（不依赖 dayEndTime）
    if (template.repeatMode === 'none') {
      return shouldGenerateInstanceOnDate(template, templateInstances, targetDate, dayEndTime);
    }

    // 对于其他 repeatMode，检查目标日期的"用户日期"是否已经生成过实例
    const targetUserDate = toUserDateString(targetDate, dayEndTime);
    const hasInstanceOnDate = templateInstances.some((inst) => {
      if (!inst.startAt) return false;
      // 使用"用户日期"比较是否是同一天
      const instUserDate = toUserDateString(inst.startAt, dayEndTime);
      return instUserDate === targetUserDate;
    });
    if (hasInstanceOnDate) {
      return false;
    }

    // 检查目标日期是否应该生成实例
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
 * 为任务模板生成任务实例数据（使用UTC时间）
 * @param dayEndTime 本地时间的"一天结束"，格式 "HH:mm"
 */
export function generateTaskInstance(
  template: TaskTemplate,
  dayEndTime: string = "00:00",
  date?: Date
): Omit<TaskInstance, 'id'> {
  const targetDate = date || new Date();

  const subtasks = template.subtasks || [];

  let startAt: string | undefined;
  let instanceDate: string;

  if (template.repeatMode === 'none') {
    if (template.startAt) {
      startAt = template.startAt;
      instanceDate = template.startAt.split('T')[0];
    } else {
      instanceDate = new Date().toISOString().split('T')[0];
    }
  } else {
    startAt = getUserStartOfDay(targetDate, dayEndTime);
    instanceDate = startAt.split('T')[0];
  }

  let expiredAt: string | undefined;
  if (startAt && template.completeExpireDays && template.completeExpireDays > 0) {
    expiredAt = calculateExpiredAt(startAt, template.completeExpireDays, dayEndTime);
  }

  const now = new Date().toISOString();
  const rule = template.completeRule;

  return {
    userId: template.userId,
    templateId: template.id,
    template: { ...template },
    status: 'pending',
    subtasks: [...subtasks],
    startAt,
    instanceDate,
    createdAt: now,

    completeProgress: rule && rule.type !== 'subtask' ? 0 : undefined,

    completedStages: [],
    stagePointsEarned: 0,
    completionPointsEarned: 0,
    completedSubtasks: subtasks.map(() => false),
    isFullyCompleted: false,

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

/**
 * 检查任务实例是否过期
 */
export function isTaskInstanceExpired(instance: TaskInstance): boolean {
  return isExpired(instance.expiredAt);
}
