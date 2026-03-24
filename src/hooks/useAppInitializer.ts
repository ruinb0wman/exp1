import { useCallback, useRef } from "react";
import { getDB } from "@/db";
import { checkAllTemplatesAndGenerate } from "@/db/middleware/taskTemplateMiddleware";

interface UseAppInitializerOptions {
  userId?: number;
  dayEndTime?: string;
  onInitialized?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 应用初始化 Hook
 * 在应用启动时检查所有启用的模板并生成今天的任务实例
 */
export function useAppInitializer({
  userId,
  dayEndTime = "00:00",
  onInitialized,
  onError,
}: UseAppInitializerOptions) {
  // 用于防止重复初始化的 ref
  const hasInitializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (!userId) {
      return;
    }

    // 防止重复初始化
    if (hasInitializedRef.current) {
      return;
    }

    // 立即标记为已初始化，防止 React StrictMode 导致的重复执行
    hasInitializedRef.current = true;

    try {
      const db = getDB();
      const generatedCount = await checkAllTemplatesAndGenerate(
        db,
        userId,
        dayEndTime
      );

      if (generatedCount > 0) {
        console.log(`Generated ${generatedCount} task instances on app init`);
      }

      onInitialized?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to initialize app:", err);
      onError?.(err);
      throw err;
    }
  }, [userId, dayEndTime, onInitialized, onError]);

  return { initialize };
}
