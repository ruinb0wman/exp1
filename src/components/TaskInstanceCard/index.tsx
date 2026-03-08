import { Play, AlertCircle, Flag } from "lucide-react";
import type { TaskHistoryItem } from "@/db/services";
import { getTaskProgressPercent } from "@/db/services";
import { repeatModeMap, repeatModeColorMap } from "@/pages/AllTasks/lib";
import {
  getStatusIcon,
  getStatusStyle,
  getStatusLabel,
  formatDateTime,
  formatShortDate,
} from "./lib";

interface TaskHistoryItemCardProps {
  item: TaskHistoryItem;
  onClick: (item: TaskHistoryItem) => void;
}

// 获取进度条颜色
function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 60) return "bg-primary";
  return "bg-yellow-500";
}

export function TaskInstanceCard({ item, onClick }: TaskHistoryItemCardProps) {
  const { template, instance } = item;
  const ItemStatusIcon = getStatusIcon(instance.status);
  const itemStatusStyle = getStatusStyle(instance.status);

  // 进度相关
  const hasCompleteRule = !!template.completeRule;
  const progressPercent = getTaskProgressPercent(instance, template);
  const progressColor = getProgressColor(progressPercent);

  // 进度文本
  const getProgressText = () => {
    if (!hasCompleteRule) return null;
    const progress = instance.completeProgress ?? 0;
    const target = template.completeTarget ?? 0;
    const unit = template.completeRule === "time" ? "分钟" : "次";
    return `${progress}/${target} ${unit}`;
  };

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
        <div className="flex items-center gap-2">
          <p className="text-text-primary font-medium truncate">
            {template.title}
          </p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${repeatModeColorMap[template.repeatMode]}`}
          >
            {repeatModeMap[template.repeatMode]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary text-xs mt-1">
          {/* 开始时间 */}
          {instance.startAt && (
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3 text-primary" />
              {formatDateTime(instance.startAt)}
            </span>
          )}
          {/* 到期时间 */}
          {instance.expiredAt && (
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-orange-500" />
              截止 {formatShortDate(instance.expiredAt)}
            </span>
          )}
          {/* 完成时间 */}
          {instance.completedAt && (
            <span className="flex items-center gap-1">
              <Flag className="w-3 h-3 text-green-500" />
              完成 {formatDateTime(instance.completedAt)}
            </span>
          )}
          {/* 积分 */}
          {instance.rewardPoints > 0 && (
            <span className="text-green-500">+{instance.rewardPoints}积分</span>
          )}
        </div>

        {/* 进度条 */}
        {hasCompleteRule && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-surface-light rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor} transition-all duration-300`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-text-secondary min-w-[60px] text-right">
              {getProgressText()}
            </span>
          </div>
        )}
      </div>

      {/* Status Label */}
      <span className={`text-sm font-medium ${itemStatusStyle.color}`}>
        {getStatusLabel(instance.status)}
      </span>
    </button>
  );
}
