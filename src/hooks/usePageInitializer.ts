import { useCallback, useRef } from "react";
import { getDB } from "@/db";
import { checkAllTemplatesAndGenerate, backfillMissingInstancesForAllTemplates } from "@/db/middleware/taskTemplateMiddleware";
import { checkAndUpdateExpiredTasks } from "@/db/services";

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

    console.log(`[pageInit] ====== 页面初始化开始 ======`);
    console.log(`[pageInit] userId=${userId}, dayEndTime=${dayEndTime}`);

    try {
      const db = getDB();
      console.log(`[pageInit] 步骤1: checkAllTemplatesAndGenerate...`);
      const generatedCount = await checkAllTemplatesAndGenerate(db, userId, dayEndTime);
      console.log(`[pageInit] 步骤1完成: 生成今日实例 ${generatedCount} 条`);

      console.log(`[pageInit] 步骤2: backfillMissingInstancesForAllTemplates...`);
      const backfillCount = await backfillMissingInstancesForAllTemplates(db, userId, dayEndTime);
      console.log(`[pageInit] 步骤2完成: 回填历史实例 ${backfillCount} 条`);

      console.log(`[pageInit] 步骤3: checkAndUpdateExpiredTasks...`);
      const expiredIds = await checkAndUpdateExpiredTasks(userId, dayEndTime);
      console.log(`[pageInit] 步骤3完成: 过期实例 ${expiredIds.length} 条`);

      console.log(`[pageInit] ====== 页面初始化完成 ======`);

      onInitialized?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[pageInit] ❌ 初始化失败:", err);
      onError?.(err);
      throw err;
    }
  }, [userId, dayEndTime, onInitialized, onError]);

  return { initialize };
}