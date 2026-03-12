import type { PointsHistoryFilterType } from "@/hooks/usePointsHistory";

export const filterTabs: { key: PointsHistoryFilterType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "task_reward", label: "任务" },
  { key: "reward_exchange", label: "消费" },
];
