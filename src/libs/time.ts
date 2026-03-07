/**
 * 时间工具函数
 * 所有存储和计算使用UTC时间，只有渲染时转换为本地时间
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
export function getUTCDateParts(date: Date): { year: number; month: number; day: number } {
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
 * 获取指定本地日期的UTC开始时间（考虑 dayEndTime）
 * @param localDate 本地日期
 * @param dayEndTime "HH:mm" 格式，默认 "00:00"
 * @returns UTC ISO 格式时间字符串
 */
export function getUserStartOfDay(localDate: Date, dayEndTime: string = "00:00"): string {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  
  // 创建UTC时间：localDate的年月日 + dayEndTime的时分
  // 由于dayEndTime是本地时间概念，我们需要将其转换为当天的UTC时间
  const utcDate = Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    endHour,
    endMinute,
    0,
    0
  );
  
  return new Date(utcDate).toISOString();
}

/**
 * 获取指定本地日期的UTC结束时间（考虑 dayEndTime）
 * @param localDate 本地日期
 * @param dayEndTime "HH:mm" 格式，默认 "00:00"
 * @returns UTC ISO 格式时间字符串
 */
export function getUserEndOfDay(localDate: Date, dayEndTime: string = "00:00"): string {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  
  // 创建UTC时间：localDate的下一天 + dayEndTime的时分 - 1ms
  const utcDate = Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate() + 1,
    endHour,
    endMinute,
    0,
    -1
  );
  
  return new Date(utcDate).toISOString();
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
 * 计算过期时间（基于UTC时间）
 * @param startAtUTC 开始时间（UTC ISO格式）
 * @param expireDays 过期天数
 * @returns 过期时间（UTC ISO格式）
 */
export function calculateExpiredAt(startAtUTC: string, expireDays: number): string {
  const startDate = new Date(startAtUTC);
  // 使用UTC时间计算过期时间
  const expireDate = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate() + expireDays,
    0, 0, 0, 0
  ));
  return expireDate.toISOString();
}

/**
 * 检查实例是否过期（基于UTC时间比较）
 * @param expiredAtUTC 过期时间（UTC ISO格式）
 */
export function isExpired(expiredAtUTC?: string): boolean {
  if (!expiredAtUTC) return false;
  const now = new Date();
  const expireTime = new Date(expiredAtUTC);
  return now.getTime() > expireTime.getTime();
}

/**
 * 获取过期剩余时间文本（基于UTC时间）
 * @param expiredAtUTC 过期时间（UTC ISO格式）
 */
export function getExpireTimeText(expiredAtUTC?: string): string {
  if (!expiredAtUTC) return '';
  
  const now = new Date();
  const expire = new Date(expiredAtUTC);
  const diff = expire.getTime() - now.getTime();
  
  if (diff <= 0) return '已过期';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}天后过期`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? `${minutes}分钟` : ''}后过期`;
  }
  return `${minutes}分钟后过期`;
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
