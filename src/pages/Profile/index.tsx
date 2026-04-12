import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useSync } from "@/hooks/useSync";
import { getDeviceId } from "@/db";
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
  const { state: syncState } = useSync();
  const isMobile = getDeviceId() === "mobile";

  // 进入页面时重新计算积分
  useEffect(() => {
    calculatePoints();
  }, [calculatePoints]);

  const { stats, recentHistory, isLoading: statsLoading } = useProfileStats(
    user?.id ?? null
  );

  const isLoading = userLoading || statsLoading;

  return (
    <div className="min-h-screen pb-24 bg-background">
      <ProfileHeader onSettingsClick={() => navigate("/settings")} />
      <UserInfoSection
        user={user}
        onSyncClick={isMobile ? () => navigate("/sync") : undefined}
        lastSyncAt={isMobile ? syncState.lastSyncAt : undefined}
      />
      <PointsCard currentPoints={currentPoints} />
      <QuickActions
        actions={quickActions}
        onActionClick={(path) => navigate(path)}
      />
      <StatsSection stats={stats} isLoading={isLoading} />
      <RecentHistoryList history={recentHistory} isLoading={isLoading} />
    </div>
  );
}
