import { Play, AlertCircle, Flag } from "lucide-react";
import type { TaskHistoryItem } from "@/db/services";
import {
  getStatusIcon,
  getStatusStyle,
  getStatusLabel,
  formatDateTime,
  formatShortDate,
} from "../lib";

interface TaskHistoryItemCardProps {
  item: TaskHistoryItem;
  onClick: (item: TaskHistoryItem) => void;
}

export function TaskHistoryItemCard({ item, onClick }: TaskHistoryItemCardProps) {
  const ItemStatusIcon = getStatusIcon(item.instance.status);
  const itemStatusStyle = getStatusStyle(item.instance.status);

  return (
    <button
      onClick={() => onClick(item)}
      className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border text-left hover:bg-surface-light transition-colors"
    >
      {/* Status Icon */}
      <div
        className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${itemStatusStyle.bg} ${itemStatusStyle.color}`}
      >
        <ItemStatusIcon className="w-5 h-5" />
      </div>

      {/* Task Info */}
      <div className="flex-1 min-w-0">
        <p className="text-text-primary font-medium truncate">
          {item.template.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary text-xs mt-1">
          {/* 开始时间 */}
          {item.instance.startAt && (
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3 text-primary" />
              {formatDateTime(item.instance.startAt)}
            </span>
          )}
          {/* 到期时间 */}
          {item.instance.expiredAt && (
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-orange-500" />
              截止 {formatShortDate(item.instance.expiredAt)}
            </span>
          )}
          {/* 完成时间 */}
          {item.instance.completedAt && (
            <span className="flex items-center gap-1">
              <Flag className="w-3 h-3 text-green-500" />
              完成 {formatDateTime(item.instance.completedAt)}
            </span>
          )}
          {/* 积分 */}
          {item.instance.rewardPoints > 0 && (
            <span className="text-green-500">+{item.instance.rewardPoints}积分</span>
          )}
        </div>
      </div>

      {/* Status Label */}
      <span className={`text-sm font-medium ${itemStatusStyle.color}`}>
        {getStatusLabel(item.instance.status)}
      </span>
    </button>
  );
}
