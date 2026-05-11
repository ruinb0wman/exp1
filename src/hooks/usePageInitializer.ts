import { useCallback, useRef } from "react";
import { getDB } from "@/db";
import { checkAllTemplatesAndGenerate, backfillMissingInstancesForAllTemplates } from "@/db/middleware/taskTemplateMiddleware";
import { checkAndUpdateExpiredTasks } from "@/db/services";
import { useUserStore } from "@/store";

interface UsePageInitializerOptions {
  userId?: number;
  onInitialized?: () => void;
  onError?: (error: Error) => void;
}

export function usePageInitializer({
  userId,
  onInitialized,
  onError,
}: UsePageInitializerOptions) {
  const user = useUserStore(s => s.user);
  const hasInitializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (!userId) {
      return;
    }

    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    const dayEndTime = user?.dayEndTime ?? "00:00";

    console.log(`[pageInit] ====== 页面初始化开始 ======`);
    console.log(`[pageInit] userId=${userId}`);

    try {
      const db = getDB();
      console.log(`[pageInit] 步骤1: checkAllTemplatesAndGenerate...`);
      const generatedCount = await checkAllTemplatesAndGenerate(db, userId);
      console.log(`[pageInit] 步骤1完成: 生成今日实例 ${generatedCount} 条`);

      console.log(`[pageInit] 步骤2: backfillMissingInstancesForAllTemplates...`);
      const backfillCount = await backfillMissingInstancesForAllTemplates(db, userId);
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
  }, [userId, user?.dayEndTime, onInitialized, onError]);

  return { initialize };
}