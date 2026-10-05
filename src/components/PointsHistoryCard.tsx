import { useEffect, useState } from "react";
import { BookOpen, Gift, RotateCcw, Settings, Trophy, type LucideIcon } from "lucide-react";
import type { PointsHistory, PointsHistoryType } from "@/db/types";
import { formatRelativeDate } from "@/libs/time";
import { getAchievementById, getTaskInstanceById, getRewardPurchaseById } from "@/db/services";

export function getPointsHistoryIcon(type: PointsHistoryType): LucideIcon {
  switch (type) {
    case "task_reward":
      return BookOpen;
    case "task_undo":
      return RotateCcw;
    case "reward_exchange":
      return Gift;
    case "achievement":
      return Trophy;
    case "admin_adjustment":
      return Settings;
    default:
      return BookOpen;
  }
}

const POINTS_HISTORY_LABEL: Record<PointsHistoryType, string> = {
  task_reward: "Task Reward",
  task_undo: "Undo Deduction",
  task_stage: "Stage Reward",
  task_completion: "Completion Reward",
  task_deduction: "Progress Reverted",
  reward_exchange: "Purchase",
  achievement: "Achievement Reward",
  admin_adjustment: "Admin Adjustment",
};

export function getPointsHistoryLabel(type: PointsHistoryType): string {
  return POINTS_HISTORY_LABEL[type] ?? POINTS_HISTORY_LABEL.task_reward;
}

export async function getRelatedEntityName(
  item: PointsHistory
): Promise<string | null> {
  if (!item.relatedInstanceId) return null;

  try {
    switch (item.type) {
      case "task_reward":
      case "task_undo":
      case "task_completion":
      case "task_stage":
      case "task_deduction": {
        const instance = await getTaskInstanceById(item.relatedInstanceId);
        return instance?.template?.title ?? null;
      }
      case "reward_exchange": {
        const purchase = await getRewardPurchaseById(item.relatedInstanceId);
        return purchase?.template?.title ?? null;
      }
      case "achievement": {
        const achievement = await getAchievementById(item.relatedInstanceId);
        return achievement?.title ?? null;
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
  const relativeDate = formatRelativeDate(item.createdAt);

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

  const getRelativeDateText = () => {
    switch (relativeDate.type) {
      case "today":
        return `Today ${relativeDate.time}`;
      case "yesterday":
        return `Yesterday ${relativeDate.time}`;
      case "daysAgo":
        return `${relativeDate.value} days ago ${relativeDate.time}`;
      case "monthDay":
        return `${relativeDate.month}/${relativeDate.day}`;
    }
  };

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
          {item.description || label}
        </p>
        <p className="text-text-muted text-xs">
          {getRelativeDateText()}
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
