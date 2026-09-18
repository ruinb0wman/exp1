import type { TaskTemplate, TaskInstance } from '@/db/types';
import {
  formatLocalDate,
  toLocalDateString,
  daysBetweenLocal,
  weeksBetweenLocal,
  monthsBetweenLocal,
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

/**
 * 将"日历日"语义的日期(通常为本地午夜)归一化为该用户日内部的一个时刻
 * (dayEndTime + 1 秒,即该用户日的"起点"之后)。
 *
 * 用于日历/统计等"选中某一天"的场景:选中的日历格子代表的是用户日本身,
 * 不应套用 toUserDateString 针对"当前时刻"的回退逻辑——否则当 dayEndTime
 * 不为 00:00 时,点选周日会被解析成周六(午夜早于 dayEndTime 回退一天)。
 *
 * @param date 日历日(本地时间,通常为 00:00 或任意时刻)
 * @param dayEndTime 一天结束时间,格式 "HH:mm"
 * @returns 位于同一本地日历日、且恒晚于 dayEndTime 的 Date
 */
export function toInUserDay(date: Date, dayEndTime: string = "00:00"): Date {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    endHour,
    endMinute,
    1,
    0
  );
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
  targetDate: Date = new Date(),
  dayEndTime: string = "00:00"
): boolean {
  const { endCondition, endValue } = template;

  if (endCondition === 'manual') {
    return false;
  }

  if (endCondition === 'date' && endValue) {
    // endValue 现在是本地日历日 YYYY-MM-DD（兼容旧 UTC ISO 格式）
    // 用日历日串比较：目标用户日严格晚于结束日才算结束
    const endLocal = toLocalDateString(endValue);
    const targetLocal = toUserDateString(targetDate, dayEndTime);
    return targetLocal > endLocal;
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

  const targetUserDate = toUserDateString(targetDate, dayEndTime);
  const startLocalDate = startAt ? toLocalDateString(startAt) : null;

  const hasInstanceOnDate = (): boolean => {
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
      if (!startLocalDate) return false;
      const interval = repeatInterval || 1;
      const daysDiff = daysBetweenLocal(startLocalDate, targetUserDate);
      return daysDiff >= 0 && daysDiff % interval === 0;
    }

    case 'weekly': {
      if (hasInstanceOnDate()) return false;
      if (!startLocalDate) return false;
      const interval = repeatInterval || 1;
      const currentDayOfWeek = new Date(targetUserDate + 'T00:00:00').getDay();

      if (!repeatDaysOfWeek || !repeatDaysOfWeek.includes(currentDayOfWeek)) {
        return false;
      }

      const weeksDiff = weeksBetweenLocal(startLocalDate, targetUserDate);
      return weeksDiff >= 0 && weeksDiff % interval === 0;
    }

    case 'monthly': {
      if (hasInstanceOnDate()) return false;
      if (!startLocalDate) return false;
      const interval = repeatInterval || 1;
      const currentDayOfMonth = new Date(targetUserDate + 'T00:00:00').getDate();

      if (!repeatDaysOfMonth || !repeatDaysOfMonth.includes(currentDayOfMonth)) {
        return false;
      }

      const monthsDiff = monthsBetweenLocal(startLocalDate, targetUserDate);
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

    if (isTemplateEndedOnDate(template, templateInstances, targetDate, dayEndTime)) {
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
      instanceDate = toLocalDateString(template.startAt);
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

// ==================== 模板执行等级 ====================

/**
 * 执行等级是否合法（正整数）
 *
 * 排序（缺失排到最后）与报表按等级分组（缺失兜底 1）共用这一个判据。
 */
export function isValidLevel(level: unknown): level is number {
  return typeof level === 'number' && Number.isFinite(level) && level > 0;
}

/** 缺失/非法 level 时排到最后（旧数据/手工构造对象） */
const MISSING_LEVEL = Number.MAX_SAFE_INTEGER;

function resolveLevel(template: TaskTemplate): number {
  return isValidLevel(template.level) ? template.level : MISSING_LEVEL;
}

/**
 * 模板比较器：level 升序 → createdAt → id
 * （后两级兜底保证同等级/旧数据也能得到稳定的全序）
 */
export function compareTemplateOrder(a: TaskTemplate, b: TaskTemplate): number {
  const byLevel = resolveLevel(a) - resolveLevel(b);
  if (byLevel !== 0) return byLevel;

  const byCreatedAt = (a.createdAt || '').localeCompare(b.createdAt || '');
  if (byCreatedAt !== 0) return byCreatedAt;

  return String(a.id).localeCompare(String(b.id));
}

/** 按模板执行等级排序（返回副本，不改原数组） */
export function sortTaskTemplates<T extends TaskTemplate>(templates: T[]): T[] {
  return [...templates].sort(compareTemplateOrder);
}

/**
 * 实时模板等级表：templateId → level
 *
 * 实例里存的是模板快照，快照不会随模板编辑更新，因此排序取实时表，
 * 拿不到时才回退到快照上的 level。
 */
export function buildTemplateLevelMap(templates: TaskTemplate[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const template of templates) {
    if (template.id) map.set(template.id, resolveLevel(template));
  }
  return map;
}

/** 任务状态权重：未完成在前，已完成/已跳过在后 */
const STATUS_WEIGHT: Record<string, number> = {
  pending: 0,
  completed: 1,
  skipped: 1,
};

/**
 * 任务列表顺序：未完成在前，其次按执行等级升序。
 *
 * 实例里存的是模板快照，快照不会随模板编辑更新，因此排序优先用
 * 实时模板等级表（levelByTemplateId），拿不到时才回退到快照上的 level。
 * 没有 instance 的项（日历预览）视为未完成。
 */
export function sortDisplayTasks<T extends { instance?: TaskInstance; template: TaskTemplate }>(
  items: T[],
  levelByTemplateId?: Map<string, number>
): T[] {
  return [...items].sort((a, b) => {
    const aWeight = a.instance ? (STATUS_WEIGHT[a.instance.status] ?? 0) : 0;
    const bWeight = b.instance ? (STATUS_WEIGHT[b.instance.status] ?? 0) : 0;
    const byStatus = aWeight - bWeight;
    if (byStatus !== 0) return byStatus;

    const aLevel = levelByTemplateId?.get(a.template.id) ?? resolveLevel(a.template);
    const bLevel = levelByTemplateId?.get(b.template.id) ?? resolveLevel(b.template);
    const byLevel = aLevel - bLevel;
    if (byLevel !== 0) return byLevel;

    return compareTemplateOrder(a.template, b.template);
  });
}
