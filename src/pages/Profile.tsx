import { Settings, Backpack, History, Coins, TrendingUp, CheckCircle, Gift, Flame, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";
import { useProfileStats } from "@/hooks/useProfileStats";

const quickActions = [
  { icon: Backpack, label: "My Backpack", path: "/backpack" },
  { icon: History, label: "Task History", path: "/task-history" },
  { icon: Coins, label: "Points History", path: "/points-history" },
];

// 图标映射：根据活动类型选择合适的图标
function getActivityIcon(_type: string, title: string) {
  if (title.includes('兑换')) {
    return { component: Gift, color: '#f56565' };
  }
  if (title.includes('撤销')) {
    return { component: RotateCcw, color: '#6b6b6b' };
  }
  return { component: CheckCircle, color: '#48bb78' };
}

export function Profile() {
  const navigate = useNavigate();
  const { user, currentPoints, isLoading: userLoading } = useUserStore();
  const { stats, recentActivity, isLoading: statsLoading } = useProfileStats(user?.id ?? null);

  const isLoading = userLoading || statsLoading;

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  const statsConfig = [
    { 
      label: "Total Points Earned", 
      value: formatNumber(stats.totalPointsEarned),
      icon: TrendingUp,
    },
    { 
      label: "Tasks Completed", 
      value: formatNumber(stats.tasksCompleted),
      icon: CheckCircle,
    },
    { 
      label: "Items Redeemed", 
      value: formatNumber(stats.itemsRedeemed),
      icon: Gift,
    },
    { 
      label: "Current Streak", 
      value: `${stats.currentStreak} Days`,
      icon: Flame,
    },
  ];

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10">
        <div className="w-12" />
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center">
          My Profile
        </h1>
        <button 
          onClick={() => navigate("/settings")}
          className="w-12 flex justify-end text-text-secondary hover:text-primary transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Profile Header */}
      <div className="p-4">
        <div className="flex gap-4 items-center">
          <div className="w-20 h-20 rounded-xl bg-surface flex items-center justify-center text-text-primary text-2xl font-bold border border-border">
            {user?.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-text-primary text-[22px] font-bold">
              {user?.name ?? "User"}
            </p>
            <p className="text-text-secondary text-base">
              @{user?.name?.toLowerCase().replace(/\s+/g, "_") ?? "user"}
            </p>
          </div>
        </div>
      </div>

      {/* Points Card */}
      <div className="p-4">
        <div className="rounded-xl bg-primary p-6">
          <p className="text-white/80 text-sm font-normal">CURRENT BALANCE</p>
          <p className="text-white text-4xl font-bold mt-1">{currentPoints}</p>
          <p className="text-white/80 text-base mt-1">
            Well done! Keep up the great work.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 px-4 py-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-3 rounded-xl bg-surface p-4 text-center border border-border hover:bg-surface-light transition-colors"
          >
            <action.icon className="w-6 h-6 text-primary" />
            <h2 className="text-text-primary text-sm font-bold">
              {action.label}
            </h2>
          </button>
        ))}
      </div>

      {/* Stats */}
      <h2 className="text-text-primary text-[22px] font-bold px-4 pb-3 pt-5">
        Progress Stats
      </h2>
      <div className="p-4 pt-0">
        <div className="grid grid-cols-2 gap-4">
          {statsConfig.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-surface p-4 border border-border"
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="w-4 h-4 text-primary" />
                <p className="text-text-secondary text-sm font-medium">
                  {stat.label}
                </p>
              </div>
              <p className="text-text-primary text-2xl font-bold">
                {isLoading ? "-" : stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <h2 className="text-text-primary text-[22px] font-bold px-4 pb-3 pt-2">
        Recent Activity
      </h2>
      <div className="flex flex-col px-4 gap-2 pb-8">
        {isLoading ? (
          // 加载状态
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-xl bg-surface p-3 border border-border animate-pulse"
            >
              <div className="w-10 h-10 shrink-0 rounded-lg bg-surface-light" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-light rounded w-3/4" />
                <div className="h-3 bg-surface-light rounded w-1/2" />
              </div>
              <div className="h-4 bg-surface-light rounded w-12" />
            </div>
          ))
        ) : recentActivity.length === 0 ? (
          // 空状态
          <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
            <History className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-base">No recent activity</p>
            <p className="text-sm opacity-70">Complete tasks to see your progress</p>
          </div>
        ) : (
          // 活动列表
          recentActivity.map((activity) => {
            const iconInfo = getActivityIcon(activity.type, activity.title);
            const IconComponent = iconInfo.component;
            return (
              <div
                key={activity.id}
                className="flex items-center gap-4 rounded-xl bg-surface p-3 border border-border"
              >
                <div 
                  className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
                  style={{ 
                    backgroundColor: activity.type === 'income' ? 'rgba(72, 187, 120, 0.2)' : 'rgba(245, 101, 101, 0.2)',
                    color: activity.type === 'income' ? '#48bb78' : '#f56565'
                  }}
                >
                  <IconComponent 
                    className="w-5 h-5" 
                    color={activity.type === 'income' ? '#48bb78' : '#f56565'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-medium truncate">
                    {activity.title}
                  </p>
                  <p className="text-text-secondary text-sm">
                    {activity.subtitle}
                  </p>
                </div>
                <p
                  className={`font-bold shrink-0 ${
                    activity.type === 'income'
                      ? "text-green-500"
                      : "text-primary"
                  }`}
                >
                  {activity.points > 0 ? `+${activity.points}` : activity.points}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
