import { useEffect } from "react";
import { Settings, Backpack, History, Coins, BookOpen, Coffee, Dumbbell } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";

const quickActions = [
  { icon: Backpack, label: "My Backpack", path: "/backpack" },
  { icon: History, label: "Task History", path: "/task-history" },
  { icon: Coins, label: "Points History", path: "/points-history" },
];

const stats = [
  { label: "Total Points Earned", value: "2,480" },
  { label: "Tasks Completed", value: "112" },
  { label: "Items Redeemed", value: "15" },
  { label: "Current Streak", value: "21 Days" },
];

const recentActivity = [
  {
    id: 1,
    icon: BookOpen,
    title: "Read a chapter",
    subtitle: "Completed today",
    points: "+10",
    positive: true,
  },
  {
    id: 2,
    icon: Coffee,
    title: "Redeemed 'Coffee'",
    subtitle: "2 days ago",
    points: "-50",
    positive: false,
  },
  {
    id: 3,
    icon: Dumbbell,
    title: "30-minute workout",
    subtitle: "3 days ago",
    points: "+25",
    positive: true,
  },
];

export function Profile() {
  const navigate = useNavigate();
  const { user, initUser, isLoading } = useUserStore();

  useEffect(() => {
    if (!user && !isLoading) {
      initUser();
    }
  }, [user, isLoading, initUser]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10">
        <div className="w-12" />
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center">
          My Profile
        </h1>
        <button className="w-12 flex justify-end text-text-secondary hover:text-primary transition-colors">
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
          <p className="text-white text-4xl font-bold mt-1">{user?.currentPoints ?? 0}</p>
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
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-surface p-4 border border-border"
            >
              <p className="text-text-secondary text-sm font-medium mb-1">
                {stat.label}
              </p>
              <p className="text-text-primary text-2xl font-bold">
                {stat.value}
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
        {recentActivity.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center gap-4 rounded-xl bg-surface p-3 border border-border"
          >
            <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <activity.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-text-primary font-medium">
                {activity.title}
              </p>
              <p className="text-text-secondary text-sm">
                {activity.subtitle}
              </p>
            </div>
            <p
              className={`font-bold ${
                activity.positive
                  ? "text-green-500"
                  : "text-primary"
              }`}
            >
              {activity.points}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
