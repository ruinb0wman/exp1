import { useEffect } from "react";
import { useUserStore, useTaskStore } from "@/store";
import { useExpiredTaskChecker } from "@/hooks/useExpiredTaskChecker";
import { useGlobalPomoTimer } from "@/hooks/useGlobalPomoTimer";
import { useAppInitializer } from "@/hooks/useAppInitializer";

/**
 * 应用启动初始化 hook
 * 集中管理所有全局初始化逻辑，应在 App 组件中调用
 */
export function useAppBootstrap() {
  // 全局初始化用户
  const { user, initUser } = useUserStore();

  // 全局检查过期任务
  const { checkExpiredTasks } = useExpiredTaskChecker({
    userId: user?.id,
  });

  // 全局应用初始化（检查并生成任务实例）
  const { initialize: initializeApp } = useAppInitializer({
    userId: user?.id,
    dayEndTime: user?.dayEndTime,
    onError: (error) => {
      console.error("Failed to initialize app:", error);
    },
  });

  // 全局番茄钟计时器（确保后台也能计时）
  useGlobalPomoTimer();

  // 初始化用户
  useEffect(() => {
    if (!user) {
      initUser();
    }
  }, [user, initUser]);

  // 用户初始化完成后执行应用初始化
  useEffect(() => {
    if (user?.id) {
      initializeApp();
    }
  }, [user?.id, initializeApp]);

  // 用户初始化完成后检查过期任务
  useEffect(() => {
    if (user?.id) {
      checkExpiredTasks();
    }
  }, [user?.id, checkExpiredTasks]);

  // 用户初始化完成后启动任务订阅
  useEffect(() => {
    if (user?.id) {
      const { subscribeToTodayTasks, subscribeToNoDateTasks } = useTaskStore.getState();
      subscribeToTodayTasks(user.id, user.dayEndTime);
      subscribeToNoDateTasks(user.id);
    }
  }, [user?.id]);
}
