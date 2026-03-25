import { useEffect } from "react";
import { Outlet } from "react-router";
import { useUserStore, useTaskStore } from "@/store";
import { useExpiredTaskChecker } from "@/hooks/useExpiredTaskChecker";
import { useGlobalPomoTimer } from "@/hooks/useGlobalPomoTimer";
import { useAppInitializer } from "@/hooks/useAppInitializer";
import { useEscHideWindow } from "@/hooks/useEscHideWindow";
import { TitleBar } from "@/components/TitleBar";
import { useSafeAreaInsets } from "@/hooks/useSafeAreaInsets";

interface BaseLayoutProps {
  children?: React.ReactNode;
  showBottomNav?: boolean;
}

/**
 * 基础布局组件
 * 包含所有共享的初始化逻辑和布局结构
 */
export function BaseLayout({ children, showBottomNav = true }: BaseLayoutProps) {
  const { top: safeAreaTop } = useSafeAreaInsets();

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

  // ESC 隐藏窗口
  useEscHideWindow();

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

  // 移动端使用动态计算的 safeAreaTop，桌面端使用固定 32px
  const isMobile = safeAreaTop > 0;
  const topPadding = isMobile ? safeAreaTop : 32;

  return (
    <>
      <TitleBar />
      <div className="h-screen flex flex-col bg-background landscape:pl-56 overflow-hidden">
        {/* 固定安全区域 - 状态栏占位（透明背景） */}
        <div
          className="flex-shrink-0 z-50"
          style={{ height: `${topPadding}px` }}
        />

        {/* 可滚动内容区域 */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
            {children || <Outlet />}
          </div>
        </div>

        {/* 底部导航区域 - 由子组件控制显示 */}
        {showBottomNav && <div className="flex-shrink-0 landscape:hidden" />}
      </div>
    </>
  );
}
