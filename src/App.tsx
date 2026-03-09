import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
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
import { useUserStore } from "./store/userStore";
import { useExpiredTaskChecker } from "./hooks/useExpiredTaskChecker";
import { useGlobalPomoTimer } from "./hooks/useGlobalPomoTimer";
import { TitleBar } from "./components/TitleBar";

function Layout() {
  // 全局初始化用户
  const { user, initUser } = useUserStore();
  
  // 全局检查过期任务
  const { checkExpiredTasks } = useExpiredTaskChecker({
    userId: user?.id,
  });
  
  // 全局番茄钟计时器（确保后台也能计时）
  useGlobalPomoTimer();
  
  useEffect(() => {
    if (!user) {
      initUser();
    }
  }, [user, initUser]);
  
  // 用户初始化完成后检查过期任务
  useEffect(() => {
    if (user?.id) {
      checkExpiredTasks();
    }
  }, [user?.id, checkExpiredTasks]);
  
  return (
    <>
      <TitleBar />
      <div className="min-h-screen-safe pt-safe landscape:pl-56 mt-8">
        <Outlet />
        <BottomNav />
      </div>
    </>
  );
}

function SimpleLayout() {
  // 全局初始化用户（简单布局也需要）
  const { user, initUser } = useUserStore();
  
  // 全局检查过期任务
  const { checkExpiredTasks } = useExpiredTaskChecker({
    userId: user?.id,
  });
  
  // 全局番茄钟计时器（确保后台也能计时）
  useGlobalPomoTimer();
  
  useEffect(() => {
    if (!user) {
      initUser();
    }
  }, [user, initUser]);
  
  // 用户初始化完成后检查过期任务
  useEffect(() => {
    if (user?.id) {
      checkExpiredTasks();
    }
  }, [user?.id, checkExpiredTasks]);
  
  return (
    <>
      <TitleBar />
      <div className="min-h-screen-safe pt-safe landscape:pl-56 mt-8">
        <Outlet />
        {/* 横屏时显示导航栏 */}
        <div className="hidden landscape:block">
          <BottomNav />
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
        {/* Main layout with bottom navigation */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/pomo" element={<Pomo />} />
          <Route path="/store" element={<Store />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Simple layout without bottom navigation */}
        <Route element={<SimpleLayout />}>
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
