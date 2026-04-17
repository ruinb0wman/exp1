/**
 * 时间工具函数
 * 所有时间使用本地时间，不使用 UTC
 */

/**
 * 获取当前UTC时间的ISO字符串
 */
export function getUTCTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 将本地日期转换为UTC日期的ISO字符串（仅用于显示转换）
 * 存储时应直接使用 new Date().toISOString()
 */
export function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * 获取指定UTC时间的年份、月份、日期（UTC）
 */
export function getUTCDateParts(date: Date): { year: number; month: number; month1Based: number; day: number } {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    month1Based: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * 格式化UTC日期为本地日期字符串 YYYY-MM-DD（用于显示）
 */
export function formatLocalDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将UTC时间戳或Date转换为本地日期字符串 YYYY-MM-DD（formatLocalDate的别名）
 * 用于统一生成本地日期键
 */
export const formatLocalDateToYYYYMMDD = formatLocalDate;

/**
 * 格式化UTC日期为本地时间字符串 YYYY-MM-DD HH:mm（用于显示）
 */
export function formatLocalDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatLocalDate(d);
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hour}:${minute}`;
}

/**
 * 获取用户定义的"当前日期"（考虑 dayEndTime 偏移）
 * 返回本地日期字符串 YYYY-MM-DD（用于显示和计算逻辑）
 * @param dayEndTime "HH:mm" 格式，如 "02:00"
 */
export function getUserCurrentDate(dayEndTime: string = "00:00"): string {
  const now = new Date();
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);

  // 当前时间小于 dayEndTime，算昨天
  if (now.getHours() < endHour || (now.getHours() === endHour && now.getMinutes() < endMinute)) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatLocalDate(yesterday);
  }

  return formatLocalDate(now);
}

/**
 * 创建UTC日期的开始时间（UTC 00:00:00.000）
 * @param year 年份
 * @param month 月份 (0-11)
 * @param day 日期
 */
export function createUTCStartOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * 创建UTC日期的结束时间（UTC 23:59:59.999）
 * @param year 年份
 * @param month 月份 (0-11)
 * @param day 日期
 */
export function createUTCEndOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
}

/**
 * 获取指定本地日期的开始时间（考虑 dayEndTime）
 * @param localDate 本地日期
 * @param dayEndTime "HH:mm" 格式，默认 "00:00"
 * @returns UTC ISO 格式时间字符串
 */
export function getUserStartOfDay(localDate: Date, dayEndTime: string = "00:00"): string {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  
  const localDateTime = new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    endHour,
    endMinute,
    0,
    0
  );
  
  return localDateTime.toISOString();
}

/**
 * 获取指定本地日期的结束时间（考虑 dayEndTime）
 * @param localDate 本地日期
 * @param dayEndTime "HH:mm" 格式，默认 "00:00"
 * @returns 本地 ISO 格式时间字符串
 */
export function getUserEndOfDay(localDate: Date, dayEndTime: string = "00:00"): string {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  
  const endOfDay = new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate() + 1,
    endHour,
    endMinute,
    0,
    -1
  );

  const year = endOfDay.getFullYear();
  const month = String(endOfDay.getMonth() + 1).padStart(2, '0');
  const day = String(endOfDay.getDate()).padStart(2, '0');
  const hour = String(endOfDay.getHours()).padStart(2, '0');
  const minute = String(endOfDay.getMinutes()).padStart(2, '0');
  const second = String(endOfDay.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000`;
}

/**
 * 获取当前UTC时间的日期边界（用于查询今天的数据）
 * @returns [startOfDayUTC, endOfDayUTC] ISO格式字符串
 */
export function getTodayUTCRange(): [string, string] {
  const now = new Date();
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const endOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999);
  return [new Date(startOfDay).toISOString(), new Date(endOfDay).toISOString()];
}

/**
 * 解析时间字符串为小时和分钟
 * @param time "HH:mm" 格式
 */
export function parseTimeString(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

/**
 * 格式化小时和分钟为时间字符串
 */
export function formatTimeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * 生成时间选项列表
 * @param interval 分钟间隔，默认 15
 */
export function generateTimeOptions(interval: number = 15): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      options.push(formatTimeString(hour, minute));
    }
  }
  return options;
}

/**
 * 基于 instanceDate 计算过期时间（动态计算，不存储）
 * @param instanceDate 实例日期（YYYY-MM-DD）
 * @param expireDays 过期天数（1表示当天结束后过期，2表示第二天结束后过期）
 * @param dayEndTime 本地时间的"一天结束"，格式 "HH:mm"
 * @returns 过期时间（本地 ISO 格式）
 */
export function calculateExpiredAtByInstanceDate(
  instanceDate: string,
  expireDays: number,
  dayEndTime: string
): string {
  const [year, month, day] = instanceDate.split('-').map(Number);
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);

  const expireLocalDate = new Date(year, month - 1, day + expireDays);
  expireLocalDate.setHours(endHour, endMinute, 0, 0);

  const yearStr = expireLocalDate.getFullYear();
  const monthStr = String(expireLocalDate.getMonth() + 1).padStart(2, '0');
  const dayStr = String(expireLocalDate.getDate()).padStart(2, '0');
  const hourStr = String(expireLocalDate.getHours()).padStart(2, '0');
  const minuteStr = String(expireLocalDate.getMinutes()).padStart(2, '0');
  const secondStr = String(expireLocalDate.getSeconds()).padStart(2, '0');

  return `${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:${secondStr}.000`;
}

/**
 * 基于 instanceDate 检查是否过期（动态计算）
 * @param instanceDate 实例日期（YYYY-MM-DD）
 * @param expireDays 过期天数
 * @param dayEndTime 本地时间的"一天结束"，格式 "HH:mm"
 */
export function isExpiredByInstanceDate(
  instanceDate: string,
  expireDays: number,
  dayEndTime: string
): boolean {
  if (!instanceDate || !expireDays || expireDays <= 0) {
    return false;
  }

  const [year, month, day] = instanceDate.split('-').map(Number);
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);

  const expireLocalDate = new Date(year, month - 1, day + expireDays);
  expireLocalDate.setHours(endHour, endMinute, 0, 0);

  const now = new Date();
  
  return now.getTime() > expireLocalDate.getTime();
}

export type ExpireTimeResult = 
  | { type: "expired" }
  | { type: "expiresInDays"; value: number }
  | { type: "expiresInHours"; hours: number; minutes: number }
  | { type: "expiresInMinutes"; value: number };

export function getExpireTimeTextByInstanceDate(
  instanceDate: string,
  expireDays: number,
  dayEndTime: string
): ExpireTimeResult {
  if (!instanceDate || !expireDays || expireDays <= 0) {
    return { type: "expired" };
  }

  const expiredAt = calculateExpiredAtByInstanceDate(instanceDate, expireDays, dayEndTime);
  const now = new Date();
  const expire = new Date(expiredAt);
  const diff = expire.getTime() - now.getTime();

  if (diff <= 0) return { type: "expired" };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { type: "expiresInDays", value: days };
  }
  if (hours > 0) {
    return { type: "expiresInHours", hours, minutes };
  }
  return { type: "expiresInMinutes", value: minutes };
}

/**
 * 计算过期时间（基于dayEndTime）
 * @deprecated 使用 calculateExpiredAtByInstanceDate 代替
 * @param startAtUTC 开始时间（UTC ISO格式）
 * @param expireDays 过期天数（按用户定义的"天"计算，1表示当天）
 * @param dayEndTime 本地时间的"一天结束"，格式 "HH:mm"，默认 "00:00"
 * @returns 过期时间（UTC ISO格式）
 */
export function calculateExpiredAt(
  startAtUTC: string,
  expireDays: number,
  dayEndTime: string = "00:00"
): string {
  const startDate = new Date(startAtUTC);

  const [endHour, endMinute] = dayEndTime.split(':').map(Number);

  const startLocalYear = startDate.getFullYear();
  const startLocalMonth = startDate.getMonth();
  const startLocalDate = startDate.getDate();
  const startLocalHour = startDate.getHours();
  const startLocalMinute = startDate.getMinutes();

  const startTimeMinutes = startLocalHour * 60 + startLocalMinute;
  const endTimeMinutes = endHour * 60 + endMinute;
  const hasPassedDayEnd = startTimeMinutes >= endTimeMinutes;

  const day1Date = hasPassedDayEnd
    ? new Date(startLocalYear, startLocalMonth, startLocalDate + 1)
    : new Date(startLocalYear, startLocalMonth, startLocalDate);

  const expireLocalDate = new Date(
    day1Date.getFullYear(),
    day1Date.getMonth(),
    day1Date.getDate() + expireDays - 1
  );

  expireLocalDate.setHours(endHour, endMinute, 0, 0);

  return expireLocalDate.toISOString();
}

/**
 * 检查实例是否过期（基于UTC时间比较）
 * @deprecated 使用 isExpiredByInstanceDate 代替
 * @param expiredAtUTC 过期时间（UTC ISO格式）
 */
export function isExpired(expiredAtUTC?: string): boolean {
  if (!expiredAtUTC) return false;
  const now = new Date();
  const expireTime = new Date(expiredAtUTC);
  return now.getTime() > expireTime.getTime();
}

export function getExpireTimeText(expiredAtUTC?: string): ExpireTimeResult {
  if (!expiredAtUTC) return { type: "expired" };
  
  const now = new Date();
  const expire = new Date(expiredAtUTC);
  const diff = expire.getTime() - now.getTime();
  
  if (diff <= 0) return { type: "expired" };
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { type: "expiresInDays", value: days };
  }
  if (hours > 0) {
    return { type: "expiresInHours", hours, minutes };
  }
  return { type: "expiresInMinutes", value: minutes };
}

/**
 * 计算两个UTC时间之间的天数差
 * 返回 date2 - date1 的天数（可以为负数）
 */
export function daysBetweenUTC(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  
  // 使用UTC时间计算
  const utc1 = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());
  const utc2 = Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * 计算两个UTC时间之间的周数差
 */
export function weeksBetweenUTC(date1: Date | string, date2: Date | string): number {
  return Math.floor(daysBetweenUTC(date1, date2) / 7);
}

/**
 * 计算两个UTC时间之间的月数差
 */
export function monthsBetweenUTC(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
}

/**
 * 检查两个UTC时间是否是同一天（UTC日期）
 */
export function isSameUTCDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return d1.getUTCFullYear() === d2.getUTCFullYear() &&
         d1.getUTCMonth() === d2.getUTCMonth() &&
         d1.getUTCDate() === d2.getUTCDate();
}

/**
 * 从本地日期字符串 YYYY-MM-DD 创建UTC时间的开始/结束范围
 * @param localDateStr 本地日期字符串 YYYY-MM-DD
 * @returns [startUTC, endUTC] ISO格式字符串
 */
export function getUTCRangeFromLocalDate(localDateStr: string): [string, string] {
  const [year, month, day] = localDateStr.split('-').map(Number);
  const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
  const endUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)).toISOString();
  return [startUTC, endUTC];
}

export type DurationResult = 
  | { type: "permanent" }
  | { type: "days"; value: number }
  | { type: "months"; value: number };

export function formatDuration(seconds: number): DurationResult {
  if (seconds <= 0) return { type: "permanent" };
  const days = Math.floor(seconds / 86400);
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return { type: "months", value: months };
  }
  return { type: "days", value: days };
}

export function formatDurationToString(result: DurationResult): string {
  switch (result.type) {
    case "permanent":
      return "永久有效";
    case "days":
      return `${result.value} 天`;
    case "months":
      return `${result.value} 个月`;
  }
}

export type RelativeDateResult = 
  | { type: "today"; time: string }
  | { type: "yesterday"; time: string }
  | { type: "daysAgo"; value: number; time: string }
  | { type: "monthDay"; month: number; day: number };

export function formatRelativeDate(dateStr: string): RelativeDateResult {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  if (diffDays === 0) {
    return { type: "today", time: timeStr };
  } else if (diffDays === 1) {
    return { type: "yesterday", time: timeStr };
  } else if (diffDays < 7) {
    return { type: "daysAgo", value: diffDays, time: timeStr };
  } else {
    return { type: "monthDay", month: date.getMonth() + 1, day: date.getDate() };
  }
}

export function formatRelativeDateToString(result: RelativeDateResult): string {
  switch (result.type) {
    case "today":
      return `今天 ${result.time}`;
    case "yesterday":
      return `昨天 ${result.time}`;
    case "daysAgo":
      return `${result.value}天前 ${result.time}`;
    case "monthDay":
      return `${result.month}/${result.day}`;
   }
}
