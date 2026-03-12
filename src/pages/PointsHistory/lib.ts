import type { PointsHistory } from "@/db/types";
import { BookOpen, Gift, RotateCcw, Settings } from "lucide-react";
import type { PointsHistoryFilterType } from "@/hooks/usePointsHistory";

export const filterTabs: { key: PointsHistoryFilterType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "task_reward", label: "任务" },
  { key: "reward_exchange", label: "消费" },
];

// 获取类型图标
export function getTypeIcon(type: PointsHistory["type"]) {
  switch (type) {
    case "task_reward":
      return BookOpen;
    case "task_undo":
      return RotateCcw;
    case "reward_exchange":
      return Gift;
    case "admin_adjustment":
      return Settings;
    default:
      return BookOpen;
  }
}

// 获取类型标签
export function getTypeLabel(type: PointsHistory["type"]) {
  switch (type) {
    case "task_reward":
      return "任务奖励";
    case "task_undo":
      return "撤销扣除";
    case "reward_exchange":
      return "兑换奖励";
    case "admin_adjustment":
      return "系统调整";
    default:
      return "";
  }
}
