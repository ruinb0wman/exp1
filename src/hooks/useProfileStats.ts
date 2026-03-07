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

export interface RecentActivity {
  id: number;
  title: string;
  subtitle: string;
  points: number;
  type: 'income' | 'expense';
  createdAt: string;
}

interface UseProfileStatsReturn {
  stats: ProfileStats;
  recentActivity: RecentActivity[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function getActivityTitle(history: PointsHistory, taskTitle?: string, rewardTitle?: string): string {
  switch (history.type) {
    case 'task_reward':
      return taskTitle || '完成任务';
    case 'task_undo':
      return taskTitle ? `撤销: ${taskTitle}` : '撤销任务完成';
    case 'reward_exchange':
      return rewardTitle ? `兑换: ${rewardTitle}` : '兑换奖励';
    case 'admin_adjustment':
      return history.amount > 0 ? '积分调整 (+)' : '积分调整 (-)';
    default:
      return '其他操作';
  }
}

function getActivitySubtitle(history: PointsHistory): string {
  const date = new Date(history.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

async function calculateStreak(userId: number): Promise<number> {
  const db = getDB();
  
  // 获取所有已完成的任务实例，按完成时间倒序
  const instances = await db.taskInstances
    .where('userId')
    .equals(userId)
    .and(i => i.status === 'completed' && i.completedAt !== undefined)
    .toArray();

  if (instances.length === 0) return 0;

  // 按日期分组统计（本地时间）
  const completedDates = new Set<string>();
  instances.forEach(instance => {
    if (instance.completedAt) {
      const date = new Date(instance.completedAt);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      completedDates.add(dateStr);
    }
  });

  const sortedDates = Array.from(completedDates).sort().reverse();
  if (sortedDates.length === 0) return 0;

  // 计算连续天数
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

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
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
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
      setRecentActivity([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const db = getDB();

      // 获取积分统计（所有时间范围）
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

      // 获取关联的任务和奖励标题
      const activityItems: RecentActivity[] = await Promise.all(
        recent20.map(async (history): Promise<RecentActivity> => {
          let taskTitle: string | undefined;
          let rewardTitle: string | undefined;

          if (history.relatedEntityId) {
            if (history.type === 'task_reward' || history.type === 'task_undo') {
              const instance = await db.taskInstances.get(history.relatedEntityId);
              if (instance) {
                const template = await db.taskTemplates.get(instance.templateId);
                taskTitle = template?.title;
              }
            } else if (history.type === 'reward_exchange') {
              const instance = await db.rewardInstances.get(history.relatedEntityId);
              if (instance) {
                const template = await db.rewardTemplates.get(instance.templateId);
                rewardTitle = template?.title;
              }
            }
          }

          return {
            id: history.id!,
            title: getActivityTitle(history, taskTitle, rewardTitle),
            subtitle: getActivitySubtitle(history),
            points: history.amount,
            type: history.amount > 0 ? 'income' : 'expense',
            createdAt: history.createdAt,
          };
        })
      );

      setRecentActivity(activityItems);
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
    recentActivity,
    isLoading,
    error,
    refresh: fetchStats,
  };
}
