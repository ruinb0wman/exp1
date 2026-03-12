import { TrendingUp, CheckCircle, Gift, Flame } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProfileStats } from "@/hooks/useProfileStats";

interface StatItemConfig {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface StatsSectionProps {
  stats: ProfileStats;
  isLoading: boolean;
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function getStatsConfig(stats: ProfileStats): StatItemConfig[] {
  return [
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
}

export function StatsSection({ stats, isLoading }: StatsSectionProps) {
  const statsConfig = getStatsConfig(stats);

  return (
    <>
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
    </>
  );
}
