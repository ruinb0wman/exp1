import { useCallback, useRef } from "react";
import { getDB } from "@/db";
import { checkAllTemplatesAndGenerate } from "@/db/middleware/taskTemplateMiddleware";

interface UseAppInitializerOptions {
  userId?: number;
  onInitialized?: () => void;
  onError?: (error: Error) => void;
}

export function useAppInitializer({
  userId,
  onInitialized,
  onError,
}: UseAppInitializerOptions) {
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
      const generatedCount = await checkAllTemplatesAndGenerate(db, userId);

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
  }, [userId, onInitialized, onError]);

  return { initialize };
}
