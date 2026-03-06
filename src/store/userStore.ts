import { create } from 'zustand';
import type { User, PointsHistoryType } from '@/db/types';
import {
  getOrCreateUser,
  updateUser as updateUserService,
  updateUserPoints as updateUserPointsService,
} from '../db/services';

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<Omit<User, 'id' | 'createdAt'>>) => Promise<void>;
  addPoints: (amount: number, type: PointsHistoryType, relatedEntityId?: number) => Promise<void>;
  spendPoints: (amount: number, type: PointsHistoryType, relatedEntityId?: number) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  initUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await getOrCreateUser();
      set({ user, isLoading: false });
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
      set({ user: refreshedUser, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh user',
        isLoading: false,
      });
    }
  },

  updateUser: async (updates) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not initialized');
    }

    set({ isLoading: true, error: null });
    try {
      await updateUserService(user.id, updates);
      const updatedUser = await getOrCreateUser();
      set({ user: updatedUser, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update user',
        isLoading: false,
      });
      throw error;
    }
  },

  addPoints: async (amount, type, relatedEntityId) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not initialized');
    }

    set({ isLoading: true, error: null });
    try {
      await updateUserPointsService(user.id, Math.abs(amount), type, relatedEntityId);
      const updatedUser = await getOrCreateUser();
      set({ user: updatedUser, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add points',
        isLoading: false,
      });
      throw error;
    }
  },

  spendPoints: async (amount, type, relatedEntityId) => {
    const { user } = get();
    if (!user) {
      throw new Error('User not initialized');
    }

    set({ isLoading: true, error: null });
    try {
      await updateUserPointsService(user.id, -Math.abs(amount), type, relatedEntityId);
      const updatedUser = await getOrCreateUser();
      set({ user: updatedUser, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to spend points',
        isLoading: false,
      });
      throw error;
    }
  },
}));
