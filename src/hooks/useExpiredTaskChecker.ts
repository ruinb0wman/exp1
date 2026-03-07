import { useState, useRef, useCallback } from 'react';
import { checkAndUpdateExpiredTasks } from '@/db/services';

interface UseExpiredTaskCheckerOptions {
  /** 用户ID */
  userId: number | undefined;
  /** 检查完成后回调 */
  onChecked?: (expiredIds: number[]) => void;
  /** 检查失败回调 */
  onError?: (error: Error) => void;
}

/**
 * 过期任务检查器 Hook
 * 
 * 用于应用打开时自动检查并更新过期的 pending 任务实例
 * 将已过期的任务状态更新为 'skipped'
 * 
 * 使用示例：
 * ```tsx
 * function App() {
 *   const { checkExpiredTasks, isChecking } = useExpiredTaskChecker({
 *     userId: user?.id,
 *     onChecked: (expiredIds) => {
 *       if (expiredIds.length > 0) {
 *         toast.info(`${expiredIds.length} 个任务已过期`);
 *       }
 *     },
 *   });
 * 
 *   useEffect(() => {
 *     checkExpiredTasks();
 *   }, [checkExpiredTasks]);
 * 
 *   return ...;
 * }
 * ```
 */
export function useExpiredTaskChecker(options: UseExpiredTaskCheckerOptions) {
  const { userId, onChecked, onError } = options;
  
  const [isChecking, setIsChecking] = useState(false);
  const hasCheckedRef = useRef(false);

  /**
   * 检查并更新过期的任务实例
   * @param options 检查选项
   * @returns 更新的任务实例ID列表
   */
  const checkExpiredTasks = useCallback(async (
    options: { skipIfAlreadyChecked?: boolean } = {}
  ): Promise<number[]> => {
    const { skipIfAlreadyChecked = true } = options;
    
    if (!userId) {
      return [];
    }

    // 如果已经检查过且需要跳过，直接返回
    if (skipIfAlreadyChecked && hasCheckedRef.current) {
      return [];
    }

    setIsChecking(true);
    
    // 立即标记已检查，防止 React StrictMode 导致的重复执行
    if (skipIfAlreadyChecked) {
      hasCheckedRef.current = true;
    }

    try {
      const expiredIds = await checkAndUpdateExpiredTasks(userId);
      
      onChecked?.(expiredIds);
      return expiredIds;
    } catch (error) {
      // 出错时重置标记，允许下次重试
      if (skipIfAlreadyChecked) {
        hasCheckedRef.current = false;
      }
      
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    } finally {
      setIsChecking(false);
    }
  }, [userId, onChecked, onError]);

  /**
   * 重置检查标记，允许再次检查
   */
  const resetCheckFlag = useCallback(() => {
    hasCheckedRef.current = false;
  }, []);

  return {
    /** 是否正在检查 */
    isChecking,
    /** 是否已经检查过 */
    hasChecked: hasCheckedRef.current,
    /** 检查并更新过期任务 */
    checkExpiredTasks,
    /** 重置检查标记 */
    resetCheckFlag,
  };
}
