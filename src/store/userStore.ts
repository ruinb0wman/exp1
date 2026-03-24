import { create } from 'zustand';
import { liveQuery } from 'dexie';
import type { User, PointsHistoryType } from '@/db/types';
import {
  getOrCreateUser,
  updateUser as updateUserService,
  updateUserPoints as updateUserPointsService,
  calculateUserPoints,
} from '../db/services';
import { getDB } from '../db';

interface UserState {
  user: User | null;
  currentPoints: number; // 从 pointsHistory 计算得到的当前积分
  isLoading: boolean;
  error: string | null;
  pointsSubscription: (() => void) | null; // 积分变化订阅的清理函数

  // Actions
  initUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<Omit<User, 'id' | 'createdAt'>>) => Promise<void>;
  addPoints: (amount: number, type: PointsHistoryType, relatedInstanceId?: number) => Promise<void>;
  spendPoints: (amount: number, type: PointsHistoryType, relatedInstanceId?: number) => Promise<void>;
  // 计算当前积分
  calculatePoints: () => Promise<number>;
  // 订阅积分变化
  subscribeToPointsChanges: () => void;
  // 取消订阅积分变化
  unsubscribeFromPointsChanges: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  currentPoints: 0,
  isLoading: false,
  error: null,
  pointsSubscription: null,

  initUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await getOrCreateUser();
      // 计算当前积分
      const points = await calculateUserPoints(user.id);
      set({ user, currentPoints: points, isLoading: false });
      // 启动积分变化订阅
      get().subscribeToPointsChanges();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize user',
        isLoading: false,
      });
    }
  },

  refreshUser: async () => {
    const { user } = get();
    if (!user) {
      await get().initUser();
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const refreshedUser = await getOrCreateUser();
      // 重新计算积分
      const points = await calculateUserPoints(refreshedUser.id);
      set({ user: refreshedUser, currentPoints: points, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh user',
        isLoading: false,
      });
    }
  },

  updateUser: async (updates: Partial<Omit<User, 'id' | 'createdAt'>>) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not initialized');
    }

    set({ isLoading: true, error: null });
    try {
      await updateUserService(user.id, updates);
      const updatedUser = await getOrCreateUser();
      // 重新计算积分
      const points = await calculateUserPoints(updatedUser.id);
      set({ user: updatedUser, currentPoints: points, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update user',
        isLoading: false,
      });
      throw error;
    }
  },

  addPoints: async (amount: number, type: PointsHistoryType, relatedInstanceId?: number) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not initialized');
    }

    set({ isLoading: true, error: null });
    try {
      // updateUserPointsService 现在返回新的积分余额
      const newPoints = await updateUserPointsService(user.id, Math.abs(amount), type, relatedInstanceId);
      // 直接使用返回的新积分，避免再次查询数据库
      set({ currentPoints: newPoints, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add points',
        isLoading: false,
      });
      throw error;
    }
  },

  spendPoints: async (amount: number, type: PointsHistoryType, relatedInstanceId?: number) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not initialized');
    }

    set({ isLoading: true, error: null });
    try {
      // updateUserPointsService 现在返回新的积分余额
      const newPoints = await updateUserPointsService(user.id, -Math.abs(amount), type, relatedInstanceId);
      // 直接使用返回的新积分，避免再次查询数据库
      set({ currentPoints: newPoints, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to spend points',
        isLoading: false,
      });
      throw error;
    }
  },

  calculatePoints: async () => {
    const { user } = get();
    if (!user) {
      return 0;
    }
    const points = await calculateUserPoints(user.id);
    set({ currentPoints: points });
    return points;
  },

  subscribeToPointsChanges: () => {
    const { user, pointsSubscription } = get();
    if (!user) return;

    // 如果已有订阅，先取消
    if (pointsSubscription) {
      pointsSubscription();
    }

    // 使用 liveQuery 订阅 pointsHistory 表的变化
    const observable = liveQuery(() => {
      const db = getDB();
      return db.pointsHistory.where('userId').equals(user.id).toArray();
    });

    const subscription = observable.subscribe({
      next: async () => {
        // 当 pointsHistory 表变化时，重新计算积分
        await get().calculatePoints();
      },
      error: (error) => {
        console.error('[UserStore] Points subscription error:', error);
      },
    });

    // 保存清理函数
    set({
      pointsSubscription: () => subscription.unsubscribe(),
    });
  },

  unsubscribeFromPointsChanges: () => {
    const { pointsSubscription } = get();
    if (pointsSubscription) {
      pointsSubscription();
      set({ pointsSubscription: null });
    }
  },
}));
