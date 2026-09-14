import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { useTranslation } from "react-i18next";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
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
import { ReplenishmentHistory } from "@/pages/ReplenishmentHistory";
import { Achievements } from "@/pages/Achievements";
import { Settings } from "@/pages/Settings";
import { DataImportExport } from "@/pages/DataImportExport";
import { MainLayout, SimpleLayout } from "@/components/layouts";
import { AchievementUnlockDialog } from "@/pages/Achievements/components/AchievementUnlockDialog";
import "@/libs/i18n";

function App() {
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
            <Route path="/replenishment/:templateId" element={<ReplenishmentHistory />} />
            <Route path="/points-history" element={<PointsHistory />} />
            <Route path="/backpack" element={<Backpack />} />
            <Route path="/task-history" element={<TaskHistory />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/data-import-export" element={<DataImportExport />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <AchievementUnlockDialog />
    </ConfirmProvider>
  );
}

export default App;
