import { useCallback, useRef } from "react";
import { getDB } from "@/db";
import { checkAllTemplatesAndGenerate } from "@/db/middleware/taskTemplateMiddleware";

interface UsePageInitializerOptions {
  userId?: number;
  dayEndTime?: string;
  onInitialized?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 页面初始化 Hook
 * 在进入页面时检查所有启用的模板并生成今天的任务实例
 */
export function usePageInitializer({
  userId,
  dayEndTime = "00:00",
  onInitialized,
  onError,
}: UsePageInitializerOptions) {
  const hasInitializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (!userId) {
      return;
    }

    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    try {
      const db = getDB();
      const generatedCount = await checkAllTemplatesAndGenerate(db, userId, dayEndTime);

      if (generatedCount > 0) {
        console.log(`Generated ${generatedCount} task instances on page init`);
      }

      onInitialized?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to initialize page:", err);
      onError?.(err);
      throw err;
    }
  }, [userId, dayEndTime, onInitialized, onError]);

  return { initialize };
}