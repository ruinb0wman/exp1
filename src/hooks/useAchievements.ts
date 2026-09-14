import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { getDB } from '@/db';
import type { Achievement } from '@/db/types';

/** 订阅用户的成就列表（响应式） */
export function useAchievements(userId: number | null) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setAchievements([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const observable = liveQuery(() =>
      getDB().achievements.where('userId').equals(userId).toArray()
    );

    const subscription = observable.subscribe({
      next: (list) => {
        setAchievements(list);
        setIsLoading(false);
      },
      error: (error) => {
        console.error('[useAchievements] liveQuery error:', error);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [userId]);

  return { achievements, isLoading };
}
