import { useState, useCallback, useEffect } from 'react';
import { getDB } from '@/db';
import type { PointsHistory } from '@/db/types';
import { getPointsStats } from '@/db/services/pointsHistoryService';
import { getTaskStatistics } from '@/db/services/taskService';
import { getRewardStatistics } from '@/db/services/rewardService';

export interface ProfileStats {
  totalPointsEarned: number;
  tasksCompleted: number;
  itemsRedeemed: number;
  currentStreak: number;
}

interface UseProfileStatsReturn {
  stats: ProfileStats;
  recentHistory: PointsHistory[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 从UTC时间提取本地日期字符串 YYYY-MM-DD
 */
function getLocalDateStringFromUTC(utcString: string): string {
  const date = new Date(utcString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 计算连续完成天数（基于UTC时间的本地日期）
 */
async function calculateStreak(userId: number): Promise<number> {
  const db = getDB();
  
  // 获取所有已完成的任务实例，按完成时间倒序
  const instances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .and(i => i.status === 'completed' && i.completedAt !== undefined)
    .toArray();

  if (instances.length === 0) return 0;

  // 按本地日期分组统计（从UTC时间转换为本地日期）
  const completedDates = new Set<string>();
  instances.forEach(instance => {
    if (instance.completedAt) {
      const dateStr = getLocalDateStringFromUTC(instance.completedAt);
      completedDates.add(dateStr);
    }
  });

  const sortedDates = Array.from(completedDates).sort().reverse();
  if (sortedDates.length === 0) return 0;

  // 计算连续天数
  const today = new Date();
  const todayStr = getLocalDateStringFromUTC(today.toISOString());
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateStringFromUTC(yesterday.toISOString());

  // 如果今天或昨天没有完成，说明连续中断了
  if (sortedDates[0] !== todayStr && sortedDates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);
    
    const diffDays = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function useProfileStats(userId: number | null): UseProfileStatsReturn {
  const [stats, setStats] = useState<ProfileStats>({
    totalPointsEarned: 0,
    tasksCompleted: 0,
    itemsRedeemed: 0,
    currentStreak: 0,
  });
  const [recentHistory, setRecentHistory] = useState<PointsHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats({
        totalPointsEarned: 0,
        tasksCompleted: 0,
        itemsRedeemed: 0,
        currentStreak: 0,
      });
      setRecentHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const db = getDB();

      // 获取积分统计（所有时间范围，使用UTC时间）
      const startDate = '1970-01-01T00:00:00.000Z';
      const endDate = new Date().toISOString();
      const pointsStats = await getPointsStats(userId, startDate, endDate);

      // 获取任务统计
      const taskStats = await getTaskStatistics(userId);

      // 获取奖励统计
      const rewardStats = await getRewardStatistics(userId);

      // 计算连续天数
      const streak = await calculateStreak(userId);

      setStats({
        totalPointsEarned: pointsStats.income,
        tasksCompleted: taskStats.completed,
        itemsRedeemed: rewardStats.used,
        currentStreak: streak,
      });

      // 获取最近20条积分历史记录
      const historyRecords = await db.pointsHistory
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('createdAt');

      const recent20 = historyRecords.slice(0, 20);
      setRecentHistory(recent20);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    recentHistory,
    isLoading,
    error,
    refresh: fetchStats,
  };
}
