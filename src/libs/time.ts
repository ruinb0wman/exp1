/**
 * 时间工具函数
 * 处理用户自定义的一天结束时间（dayEndTime）相关逻辑
 */

/**
 * 获取指定日期的本地字符串 YYYY-MM-DD
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取用户定义的"当前日期"（考虑 dayEndTime 偏移）
 * @param dayEndTime "HH:mm" 格式，如 "02:00"
 * @returns 本地日期字符串 YYYY-MM-DD
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
 * 获取用户"指定日期"的开始时间（考虑 dayEndTime）
 * @param date 日期
 * @param dayEndTime "HH:mm" 格式
 * @returns ISO 格式时间字符串
 */
export function getUserStartOfDay(date: Date, dayEndTime: string = "00:00"): string {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  const d = new Date(date);
  d.setHours(endHour, endMinute, 0, 0);
  return d.toISOString();
}

/**
 * 获取用户"指定日期"的结束时间（考虑 dayEndTime）
 * @param date 日期
 * @param dayEndTime "HH:mm" 格式
 * @returns ISO 格式时间字符串
 */
export function getUserEndOfDay(date: Date, dayEndTime: string = "00:00"): string {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  d.setHours(endHour, endMinute, 0, 0);
  d.setMilliseconds(d.getMilliseconds() - 1);
  return d.toISOString();
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
 * 计算过期时间
 * @param startAt 开始时间（ISO 格式）
 * @param expireDays 过期天数
 * @returns 过期时间（ISO 格式）
 */
export function calculateExpiredAt(startAt: string, expireDays: number): string {
  const expireDate = new Date(startAt);
  expireDate.setDate(expireDate.getDate() + expireDays);
  return expireDate.toISOString();
}

/**
 * 检查实例是否过期
 * @param expiredAt 过期时间（ISO 格式）
 */
export function isExpired(expiredAt?: string): boolean {
  if (!expiredAt) return false;
  return new Date() > new Date(expiredAt);
}

/**
 * 获取过期剩余时间文本
 * @param expiredAt 过期时间（ISO 格式）
 */
export function getExpireTimeText(expiredAt?: string): string {
  if (!expiredAt) return '';
  
  const now = new Date();
  const expire = new Date(expiredAt);
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
