import { useState, useRef, useCallback } from 'react';
import { checkAndUpdateExpiredTasks } from '@/db/services';
import { useUserStore } from '@/store';

interface UseExpiredTaskCheckerOptions {
  userId: number | undefined;
  onChecked?: (expiredIds: string[]) => void;
  onError?: (error: Error) => void;
}

export function useExpiredTaskChecker(options: UseExpiredTaskCheckerOptions) {
  const { userId, onChecked, onError } = options;
  const user = useUserStore(s => s.user);

  const [isChecking, setIsChecking] = useState(false);
  const hasCheckedRef = useRef(false);

  const checkExpiredTasks = useCallback(async (
    options: { skipIfAlreadyChecked?: boolean } = {}
  ): Promise<string[]> => {
    const { skipIfAlreadyChecked = true } = options;

    const dayEndTime = user?.dayEndTime;

    if (!userId || !dayEndTime) {
      return [];
    }

    if (skipIfAlreadyChecked && hasCheckedRef.current) {
      return [];
    }

    setIsChecking(true);

    if (skipIfAlreadyChecked) {
      hasCheckedRef.current = true;
    }

    try {
      const expiredIds = await checkAndUpdateExpiredTasks(userId, dayEndTime);

      onChecked?.(expiredIds);
      return expiredIds;
    } catch (error) {
      if (skipIfAlreadyChecked) {
        hasCheckedRef.current = false;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    } finally {
      setIsChecking(false);
    }
  }, [userId, user?.dayEndTime, onChecked, onError]);

  const resetCheckFlag = useCallback(() => {
    hasCheckedRef.current = false;
  }, []);

  return {
    isChecking,
    hasChecked: hasCheckedRef.current,
    checkExpiredTasks,
    resetCheckFlag,
  };
}
