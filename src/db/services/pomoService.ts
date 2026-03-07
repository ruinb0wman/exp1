import { getDB } from "../index";
import type { PomoSession, PomoSettings, PomoStatus } from "../types/pomo";
import { DEFAULT_POMO_SETTINGS } from "../types/pomo";

// 创建番茄钟会话
export async function createPomoSession(
  session: Omit<PomoSession, 'id' | 'startedAt'>
): Promise<number> {
  const db = getDB();
  const now = new Date().toISOString();
  
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
  const now = new Date().toISOString();
  
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
  const now = new Date().toISOString();
  
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

// 获取今日的番茄钟会话
export async function getTodayPomoSessions(userId: number): Promise<PomoSession[]> {
  const db = getDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  
  return db.pomoSessions
    .where('userId')
    .equals(userId)
    .filter(session => session.startedAt >= todayStr)
    .toArray();
}

// 获取今日完成的番茄数
export async function getTodayCompletedPomoCount(userId: number): Promise<number> {
  const sessions = await getTodayPomoSessions(userId);
  return sessions.filter(s => s.status === 'completed' && s.mode === 'focus').length;
}

// 获取本周的番茄钟统计
export async function getWeeklyPomoStats(userId: number): Promise<{
  totalFocus: number; // 总专注时长(分钟)
  completedCount: number;
  abortedCount: number;
}> {
  const db = getDB();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString();
  
  const sessions = await db.pomoSessions
    .where('userId')
    .equals(userId)
    .filter(session => session.startedAt >= weekAgoStr && session.mode === 'focus')
    .toArray();
  
  return {
    totalFocus: sessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + Math.floor(s.actualDuration / 60), 0),
    completedCount: sessions.filter(s => s.status === 'completed').length,
    abortedCount: sessions.filter(s => s.status === 'aborted').length,
  };
}

// 获取用户的番茄钟设置（从 localStorage）
export function getPomoSettings(): PomoSettings {
  const stored = localStorage.getItem('pomoSettings');
  if (stored) {
    return { ...DEFAULT_POMO_SETTINGS, ...(JSON.parse(stored) as Partial<PomoSettings>) };
  }
  return { ...DEFAULT_POMO_SETTINGS };
}

// 保存用户的番茄钟设置
export function savePomoSettings(settings: PomoSettings): void {
  localStorage.setItem('pomoSettings', JSON.stringify(settings));
}
