import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useAchievements } from "@/hooks/useAchievements";
import { quickActions } from "./lib";
import {
  ProfileHeader,
  UserInfoSection,
  PointsCard,
  QuickActions,
} from "./components/ProfileSections";
import { StatsSection } from "./components/StatsSection";
import { RecentHistoryList } from "./components/RecentHistoryList";

export function Profile() {
  const navigate = useNavigate();
  const { user, currentPoints, isLoading: userLoading, calculatePoints } = useUserStore();

  useEffect(() => {
    calculatePoints();
  }, [calculatePoints]);

  const { stats, recentHistory, isLoading: statsLoading } = useProfileStats(
    user?.id ?? null
  );

  const { achievements } = useAchievements(user?.id ?? null);
  const unlockedCount = useMemo(
    () => achievements.filter((item) => item.status === 'unlocked').length,
    [achievements]
  );

  const actions = useMemo(
    () =>
      quickActions.map((action) =>
        action.path === "/achievements"
          ? { ...action, badge: unlockedCount }
          : action
      ),
    [unlockedCount]
  );

  const isLoading = userLoading || statsLoading;

  return (
    <div className="min-h-screen pb-24 bg-background">
      <ProfileHeader onSettingsClick={() => navigate("/settings")} />
      <UserInfoSection user={user} />
      <PointsCard currentPoints={currentPoints} />
      <QuickActions
        actions={actions}
        onActionClick={(path) => navigate(path)}
      />
      <StatsSection stats={stats} isLoading={isLoading} />
      <RecentHistoryList history={recentHistory} isLoading={isLoading} />
    </div>
  );
}
