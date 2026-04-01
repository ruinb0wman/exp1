import { useEffect, useState } from "react";
import { BookOpen, Gift, RotateCcw, Settings, type LucideIcon } from "lucide-react";
import type { PointsHistory, PointsHistoryType } from "@/db/types";
import { formatRelativeDate } from "@/libs/time";
import { getTaskInstanceById, getRewardInstanceById } from "@/db/services";


// 获取类型图标
export function getPointsHistoryIcon(type: PointsHistoryType): LucideIcon {
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
export function getPointsHistoryLabel(type: PointsHistoryType): string {
  switch (type) {
    case "task_reward":
      return "任务奖励";
    case "task_undo":
      return "撤销扣除";
    case "task_stage":
      return "阶段奖励";
    case "task_completion":
      return "完成奖励";
    case "task_deduction":
      return "进度回退";
    case "reward_exchange":
      return "兑换奖励";
    case "admin_adjustment":
      return "系统调整";
    default:
      return "";
  }
}

// 获取相关实体名称（任务或奖品）
export async function getRelatedEntityName(
  item: PointsHistory
): Promise<string | null> {
  if (!item.relatedInstanceId) return null;

  try {
    switch (item.type) {
      case "task_reward":
      case "task_undo": {
        const instance = await getTaskInstanceById(item.relatedInstanceId);
        return instance?.template?.title ?? null;
      }
      case "reward_exchange": {
        const instance = await getRewardInstanceById(item.relatedInstanceId);
        return instance?.template?.title ?? null;
      }
      case "admin_adjustment":
      default:
        return null;
    }
  } catch {
    return null;
  }
}

interface PointsHistoryCardProps {
  item: PointsHistory;
}

export function PointsHistoryCard({ item }: PointsHistoryCardProps) {
  const [entityName, setEntityName] = useState<string | null>(null);
  const Icon = getPointsHistoryIcon(item.type);
  const isPositive = item.amount > 0;
  const label = getPointsHistoryLabel(item.type);

  useEffect(() => {
    let mounted = true;
    getRelatedEntityName(item).then((name) => {
      if (mounted) {
        setEntityName(name);
      }
    });
    return () => {
      mounted = false;
    };
  }, [item]);

  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
      <div
        className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
          isPositive ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary"
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-primary font-medium">
          {entityName || label}
        </p>
        <p className="text-text-secondary text-sm truncate">
          {entityName ? label : ''}
          {item.description ? `${entityName ? ' · ' : ''}${item.description}` : ''}
        </p>
        <p className="text-text-muted text-xs">
          {formatRelativeDate(item.createdAt)}
        </p>
      </div>
      <p
        className={`font-bold text-lg ${
          isPositive ? "text-green-500" : "text-primary"
        }`}
      >
        {isPositive ? "+" : ""}
        {item.amount}
      </p>
    </div>
  );
}
