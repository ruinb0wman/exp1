import { create } from 'zustand';
import type { Achievement } from '@/db/types';

interface AchievementState {
  /** 待展示的解锁通知队列 */
  pendingUnlocks: Achievement[];
  pushUnlocks: (items: Achievement[]) => void;
  shiftUnlock: () => void;
  clearUnlocks: () => void;
}

export const useAchievementStore = create<AchievementState>((set) => ({
  pendingUnlocks: [],

  pushUnlocks: (items) => {
    if (items.length === 0) return;
    set((state) => {
      const existing = new Set(state.pendingUnlocks.map((item) => item.id));
      const merged = [
        ...state.pendingUnlocks,
        ...items.filter((item) => !existing.has(item.id)),
      ];
      return { pendingUnlocks: merged };
    });
  },

  shiftUnlock: () =>
    set((state) => ({ pendingUnlocks: state.pendingUnlocks.slice(1) })),

  clearUnlocks: () => set({ pendingUnlocks: [] }),
}));
