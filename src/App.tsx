import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { BottomNav } from "./components/BottomNav";
import { ConfirmProvider } from "./hooks/useConfirm";
import { Home } from "./pages/Home";
import { AllTasks } from "./pages/AllTasks";
import { EditTask } from "./pages/EditTask";
import { Store } from "./pages/Store";
import { EditReward } from "./pages/EditReward";
import { Stats } from "./pages/Stats";
import { Profile } from "./pages/Profile";
import { Pomo } from "./pages/Pomo";
import { PointsHistory } from "./pages/PointsHistory";
import { Backpack } from "./pages/Backpack";
import { TaskHistory } from "./pages/TaskHistory";
import { Settings } from "./pages/Settings";
import { DataImportExport } from "./pages/DataImportExport";
import { useUserStore, useTaskStore } from "./store";
import { useExpiredTaskChecker } from "./hooks/useExpiredTaskChecker";
import { useGlobalPomoTimer } from "./hooks/useGlobalPomoTimer";
import { useAppInitializer } from "./hooks/useAppInitializer";
import { useEscHideWindow } from "./hooks/useEscHideWindow";
import { useSafeAreaInsets } from "./hooks/useSafeAreaInsets";
import { TitleBar } from "./components/TitleBar";
import { setDeviceId } from "./db";

interface LayoutProps {
  isMobile: boolean;
  safeAreaTop: number;
}

function Layout({ isMobile, safeAreaTop }: LayoutProps) {
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

        {/* 可滚动内容区域 - 使用绝对定位确保严格限制在可视区域内 */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
            <Outlet />
          </div>
        </div>

        {/* 底部导航 - 固定在底部 */}
        <BottomNav />
      </div>
    </>
  );
}

function SimpleLayout({ isMobile, safeAreaTop }: LayoutProps) {
  // 全局初始化用户（简单布局也需要）
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

  // 移动端使用动态计算的 safeAreaTop，桌面端使用固定 32px
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

        {/* 可滚动内容区域 - 使用绝对定位确保严格限制在可视区域内 */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
            <Outlet />
          </div>
        </div>

        {/* 横屏时显示导航栏 */}
        <div className="hidden landscape:block flex-shrink-0">
          <BottomNav />
        </div>
      </div>
    </>
  );
}

function App() {
  const [isMobile, setIsMobile] = useState(false);
  const { top: safeAreaTop } = useSafeAreaInsets();

  // 初始化平台检测
  useEffect(() => {
    const initPlatform = async () => {
      try {
        const platform = await invoke<string>("get_platform");
        const isMobilePlatform = platform === "mobile" || platform === "ios" || platform === "android";
        setIsMobile(isMobilePlatform);
        // 根据平台设置 deviceId：mobile 平台设为 'mobile'，其他设为 'pc'
        setDeviceId(isMobilePlatform ? "mobile" : "pc");
      } catch (error) {
        console.error("Failed to detect platform:", error);
        // 默认设为 pc
        setDeviceId("pc");
      }
    };
    initPlatform();
  }, []);

  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
        {/* Main layout with bottom navigation */}
        <Route element={<Layout isMobile={isMobile} safeAreaTop={safeAreaTop} />}>
          <Route path="/" element={<Home />} />
          <Route path="/pomo" element={<Pomo />} />
          <Route path="/store" element={<Store />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Simple layout without bottom navigation */}
        <Route element={<SimpleLayout isMobile={isMobile} safeAreaTop={safeAreaTop} />}>
          <Route path="/tasks" element={<AllTasks />} />
          <Route path="/tasks/new" element={<EditTask />} />
          <Route path="/tasks/:id" element={<EditTask />} />
          <Route path="/rewards/new" element={<EditReward />} />
          <Route path="/rewards/:id" element={<EditReward />} />
          <Route path="/points-history" element={<PointsHistory />} />
          <Route path="/backpack" element={<Backpack />} />
          <Route path="/task-history" element={<TaskHistory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/data-import-export" element={<DataImportExport />} />
        </Route>
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
  );
}

export default App;
