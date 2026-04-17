import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { useEscHideWindow } from "@/hooks/useEscHideWindow";
import { useUserStore } from "@/store";
import { Home } from "@/pages/Home";
import { AllTasks } from "@/pages/AllTasks";
import { EditTask } from "@/pages/EditTask";
import { Store } from "@/pages/Store";
import { EditReward } from "@/pages/EditReward";
import { Stats } from "@/pages/Stats";
import { Profile } from "@/pages/Profile";
import { Pomo } from "@/pages/Pomo";
import { PointsHistory } from "@/pages/PointsHistory";
import { Backpack } from "@/pages/Backpack";
import { TaskHistory } from "@/pages/TaskHistory";
import { Settings } from "@/pages/Settings";
import { DataImportExport } from "@/pages/DataImportExport";
import { MainLayout, SimpleLayout } from "@/components/layouts";
import "@/libs/i18n";

function App() {
  const [, setIsMobile] = useState(false);
  const { user } = useUserStore();
  const { i18n } = useTranslation();

  // 同步用户语言设置到 i18n
  useEffect(() => {
    if (user?.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language, i18n]);

  // 应用启动初始化
  useAppBootstrap();

  // ESC 隐藏窗口
  useEscHideWindow();

  // 初始化平台检测
  useEffect(() => {
    const initPlatform = async () => {
      try {
        const platform = await invoke<string>("get_platform");
        const isMobilePlatform = platform === "mobile" || platform === "ios" || platform === "android";
        setIsMobile(isMobilePlatform);
      } catch (error) {
        console.error("Failed to detect platform:", error);
      }
    };
    initPlatform();
  }, []);

  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          {/* Main layout with bottom navigation */}
          <Route element={<MainLayout />}>
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
