import { ChevronRight, Power, Trash2 } from "lucide-react";
import type { RepeatMode } from "@/db/types";
import { repeatModeMap, repeatModeColorMap } from "@/pages/AllTasks/lib";

interface TaskTemplateCardProps {
  id: number;
  title: string;
  description?: string;
  repeatMode: RepeatMode;
  enabled: boolean;
  rewardPoints: number;
  subtasks: string[];
  isRandomSubtask: boolean;
  isDeleting: boolean;
  isActionLoading: boolean;
  onClick: () => void;
  onToggleEnabled: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function TaskTemplateCard({
  title,
  description,
  repeatMode,
  enabled,
  rewardPoints,
  subtasks,
  isRandomSubtask,
  isDeleting,
  isActionLoading,
  onClick,
  onToggleEnabled,
  onDelete,
}: TaskTemplateCardProps) {
  return (
    <div
      className={`flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border transition-colors ${
        enabled ? "border-border hover:border-surface-light" : "border-border/50 opacity-60"
      }`}
    >
      <div
        className="flex items-center gap-4 flex-1 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex flex-col justify-center flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
                enabled ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              {title}
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${repeatModeColorMap[repeatMode]}`}
            >
              {repeatModeMap[repeatMode]}
            </span>
          </div>
          <p
            className={`text-sm font-normal leading-normal line-clamp-1 transition-all ${
              enabled ? "text-text-secondary" : "text-text-muted"
            }`}
          >
            {description || `+${rewardPoints} exp`}
          </p>
          {subtasks.length > 0 && (
            <p className="text-xs text-text-muted mt-1">
              {subtasks.length} checklist item
              {subtasks.length > 1 ? "s" : ""}
              {isRandomSubtask && " (random)"}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Enable/Disable Toggle */}
        <button
          onClick={onToggleEnabled}
          disabled={isActionLoading}
          className={`p-2 rounded-lg transition-colors ${
            enabled
              ? "text-primary hover:bg-primary/10"
              : "text-text-muted hover:bg-surface-light"
          }`}
          title={enabled ? "Disable" : "Enable"}
        >
          <Power className="w-4 h-4" />
        </button>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          disabled={isDeleting || isActionLoading}
          className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Delete"
        >
          {isDeleting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>

        <ChevronRight className="w-5 h-5 text-text-muted" />
      </div>
    </div>
  );
}
