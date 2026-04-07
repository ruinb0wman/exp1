import { Play, AlertCircle, Flag, Eye } from "lucide-react";
import type { TaskHistoryItem } from "@/db/services";
import type { TaskTemplate, TaskInstance } from "@/db/types";
import { getTaskProgressPercent, getTotalPointsEarned } from "@/db/services";
import { useUserStore } from "@/store";
import { isExpiredByInstanceDate, getExpireTimeTextByInstanceDate } from "@/libs/time";
import { repeatModeMap, repeatModeColorMap } from "@/pages/AllTasks/lib";
import {
  getStatusIcon,
  getStatusStyle,
  getStatusLabel,
  formatDateTime,
} from "./lib";

interface TaskInstanceCardProps {
  item?: TaskHistoryItem;
  template?: TaskTemplate;
  instance?: TaskInstance;
  isPreview?: boolean;
  onClick: (data: { template: TaskTemplate; instance?: TaskInstance }) => void;
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 60) return "bg-primary";
  return "bg-yellow-500";
}

export function TaskInstanceCard({ 
  item, 
  template: propTemplate, 
  instance: propInstance, 
  isPreview = false,
  onClick 
}: TaskInstanceCardProps) {
  const { user } = useUserStore();
  const template = item?.template ?? propTemplate!;
  const instance = item?.instance ?? propInstance;
  const dayEndTime = user?.dayEndTime ?? "00:00";
  
  const ItemStatusIcon = isPreview ? Eye : getStatusIcon(instance?.status ?? "pending");
  const itemStatusStyle = isPreview 
    ? { color: "text-text-muted", bg: "bg-text-muted/20" } 
    : getStatusStyle(instance?.status ?? "pending");

  const hasCompleteRule = !isPreview && !!template.completeRule && template.completeRule.type !== 'simple';
  const progressPercent = instance ? getTaskProgressPercent(instance) : 0;
  const progressColor = getProgressColor(progressPercent);
  
  const earnedPoints = instance 
    ? (() => {
        const rule = template?.completeRule;
        if (rule?.type === 'simple' && instance.status === 'completed') {
          return rule.completionPoints || 0;
        }
        return getTotalPointsEarned(instance);
      })()
    : 0;

  const expireDays = template?.completeExpireDays;
  const expired = !isPreview && expireDays && expireDays > 0 
    ? isExpiredByInstanceDate(instance?.instanceDate ?? '', expireDays, dayEndTime)
    : false;
  const expireText = !isPreview && expireDays && expireDays > 0
    ? getExpireTimeTextByInstanceDate(instance?.instanceDate ?? '', expireDays, dayEndTime)
    : '';

  const getProgressText = () => {
    if (!hasCompleteRule) return null;
    
    const rule = template.completeRule;
    if (!rule) return null;

    if (rule.type === 'subtask') {
      const completedCount = (instance?.completedSubtasks || []).filter(Boolean).length;
      const config = rule.subtaskConfig;
      const targetCount = config?.mode === 'all' 
        ? instance?.subtasks.length || 0
        : (config?.requiredCount || 1);
      return `${completedCount}/${targetCount} 项`;
    }

    const progress = instance?.completeProgress ?? 0;
    const maxThreshold = rule.stages.length > 0 
      ? Math.max(...rule.stages.map(s => s.threshold))
      : 0;
    const unit = rule.type === "time" ? "分钟" : "次";
    return `${progress}/${maxThreshold} ${unit}`;
  };

  const handleClick = () => {
    if (isPreview) return;
    onClick({ template, instance });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPreview}
      className={`w-full flex items-center gap-4 rounded-xl bg-surface p-4 border border-border text-left transition-colors
        ${isPreview 
          ? "opacity-70 cursor-not-allowed" 
          : "hover:bg-surface-light cursor-pointer"
        }`}
    >
      <div
        className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${itemStatusStyle.bg} ${itemStatusStyle.color}`}
      >
        <ItemStatusIcon className="w-5 h-5" />
      </div>

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
          {isPreview ? (
            <span className="text-xs text-text-muted">预览模式</span>
          ) : (
            <>
              {instance?.startAt && (
                <span className="flex items-center gap-1">
                  <Play className="w-3 h-3 text-primary" />
                  {formatDateTime(instance.startAt)}
                </span>
              )}
              {expireText && (
                <span className="flex items-center gap-1">
                  <AlertCircle className={`w-3 h-3 ${expired ? "text-red-500" : "text-orange-500"}`} />
                  {expired ? "已过期" : `截止 ${expireText}`}
                </span>
              )}
              {instance?.completedAt && (
                <span className="flex items-center gap-1">
                  <Flag className="w-3 h-3 text-green-500" />
                  完成 {formatDateTime(instance.completedAt)}
                </span>
              )}
              {earnedPoints > 0 && (
                <span className="text-green-500">+{earnedPoints} exp</span>
              )}
            </>
          )}
        </div>

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

      <span className={`text-sm font-medium ${itemStatusStyle.color}`}>
        {isPreview ? "预览" : getStatusLabel(instance?.status ?? "pending")}
      </span>
    </button>
  );
}