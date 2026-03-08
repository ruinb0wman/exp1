import { getDB } from "../index";
import type { PomoSession, PomoSettings, PomoStatus } from "../types/pomo";

// 创建番茄钟会话
export async function createPomoSession(
  session: Omit<PomoSession, 'id' | 'startedAt'>
): Promise<number> {
  const db = getDB();
  const now = new Date().toISOString(); // UTC时间
  
  const newSession: PomoSession = {
    ...session,
    startedAt: now,
  };
  
  return db.pomoSessions.add(newSession);
}

// 更新番茄钟会话
export async function updatePomoSession(
  id: number,
  updates: Partial<PomoSession>
): Promise<void> {
  const db = getDB();
  await db.pomoSessions.update(id, updates);
}

// 完成番茄钟会话
export async function completePomoSession(
  id: number,
  actualDuration: number
): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString(); // UTC时间
  
  await db.pomoSessions.update(id, {
    status: 'completed' as PomoStatus,
    actualDuration,
    endedAt: now,
  });
}

// 放弃番茄钟会话
export async function abortPomoSession(
  id: number,
  actualDuration: number
): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString(); // UTC时间
  
  await db.pomoSessions.update(id, {
    status: 'aborted' as PomoStatus,
    actualDuration,
    endedAt: now,
  });
}

// 增加中断次数
export async function incrementInterruptions(id: number): Promise<void> {
  const db = getDB();
  const session = await db.pomoSessions.get(id);
  if (session) {
    await db.pomoSessions.update(id, {
      interruptions: session.interruptions + 1,
    });
  }
}

// 获取今日的番茄钟会话（基于UTC时间）
export async function getTodayPomoSessions(userId: number): Promise<PomoSession[]> {
  const db = getDB();
  const now = new Date();
  
  // 计算今天的UTC开始时间
  const todayStartUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  )).toISOString();
  
  return db.pomoSessions
    .where('userId')
    .equals(userId)
    .filter(session => session.startedAt >= todayStartUTC)
    .toArray();
}

// 获取今日完成的番茄数（基于UTC时间）
export async function getTodayCompletedPomoCount(userId: number): Promise<number> {
  const sessions = await getTodayPomoSessions(userId);
  return sessions.filter(s => s.status === 'completed' && s.mode === 'focus').length;
}

// 获取本周的番茄钟统计（基于UTC时间）
export async function getWeeklyPomoStats(userId: number): Promise<{
  totalFocus: number; // 总专注时长(分钟)
  completedCount: number;
  abortedCount: number;
}> {
  const db = getDB();
  const now = new Date();
  
  // 计算7天前的UTC时间
  const weekAgoUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 7,
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  )).toISOString();
  
  const sessions = await db.pomoSessions
    .where('userId')
    .equals(userId)
    .filter(session => session.startedAt >= weekAgoUTC && session.mode === 'focus')
    .toArray();
  
  return {
    totalFocus: sessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + Math.floor(s.actualDuration / 60), 0),
    completedCount: sessions.filter(s => s.status === 'completed').length,
    abortedCount: sessions.filter(s => s.status === 'aborted').length,
  };
}

// 注意：getPomoSettings 和 savePomoSettings 已迁移到 userService.ts
// 使用 getUserPomoSettings 和 updateUserPomoSettings 代替
// 保留这两个函数作为兼容层，内部调用 userService

import { getUserPomoSettings, updateUserPomoSettings } from './userService';

/**
 * @deprecated 使用 getUserPomoSettings(userId) 代替
 * 获取用户的番茄钟设置（从 Dexie.js）
 */
export async function getPomoSettings(userId: number): Promise<PomoSettings> {
  return getUserPomoSettings(userId);
}

/**
 * @deprecated 使用 updateUserPomoSettings(userId, settings) 代替
 * 保存用户的番茄钟设置
 */
export async function savePomoSettings(userId: number, settings: PomoSettings): Promise<void> {
  await updateUserPomoSettings(userId, settings);
}
