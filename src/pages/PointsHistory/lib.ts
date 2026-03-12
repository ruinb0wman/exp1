import type { PointsHistory } from "@/db/types";
import { BookOpen, Gift, RotateCcw, Settings } from "lucide-react";
import type { PointsHistoryFilterType } from "@/hooks/usePointsHistory";
import { getTaskTemplateById } from "@/db/services/taskService";
import { getRewardTemplateById } from "@/db/services/rewardService";

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

// 获取相关实体名称（任务或奖品）
// 现在 relatedTemplateId 直接存储 templateId，无需通过 instance 查询
export async function getRelatedEntityName(
  item: PointsHistory
): Promise<string | null> {
  if (!item.relatedTemplateId) return null;

  try {
    switch (item.type) {
      case "task_reward":
      case "task_undo": {
        const template = await getTaskTemplateById(item.relatedTemplateId);
        return template?.title ?? null;
      }
      case "reward_exchange": {
        const template = await getRewardTemplateById(item.relatedTemplateId);
        return template?.title ?? null;
      }
      case "admin_adjustment":
      default:
        return null;
    }
  } catch {
    return null;
  }
}
