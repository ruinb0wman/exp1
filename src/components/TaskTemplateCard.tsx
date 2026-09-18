import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, ChevronUp, Power } from "lucide-react";
import type { RepeatMode, CompleteRule } from "@/db/types";
import { calculateMaxPoints } from "@/db/types/task";
import { repeatModeMap, repeatModeColorMap } from "@/pages/AllTasks/lib";

interface TaskTemplateCardProps {
  id: string;
  title: string;
  description?: string;
  repeatMode: RepeatMode;
  enabled: boolean;
  completeRule?: CompleteRule;
  subtasks: string[];
  isActionLoading: boolean;
  onClick: () => void;
  onToggleEnabled: (e: React.MouseEvent) => void;
  /** 传了才渲染排序按钮 */
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function TaskTemplateCard({
  title,
  description,
  repeatMode,
  enabled,
  completeRule,
  subtasks,
  isActionLoading,
  onClick,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: TaskTemplateCardProps) {
  const { t } = useTranslation();
  const maxPoints = completeRule ? calculateMaxPoints(completeRule) : 0;
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
            {description || (maxPoints > 0 ? `+${maxPoints} ${t("common.exp")}` : t("task.simpleTask"))}
          </p>
          {subtasks.length > 0 && (
            <p className="text-xs text-text-muted mt-1">
              {subtasks.length} checklist item{subtasks.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Reorder Buttons */}
        {onMoveUp && onMoveDown && (
          <div className="flex items-center">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp || isActionLoading}
              className="p-1.5 rounded-lg text-text-muted transition-colors hover:bg-surface-light disabled:opacity-30 disabled:hover:bg-transparent"
              title={t("allTasks.moveUp")}
              aria-label={t("allTasks.moveUp")}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown || isActionLoading}
              className="p-1.5 rounded-lg text-text-muted transition-colors hover:bg-surface-light disabled:opacity-30 disabled:hover:bg-transparent"
              title={t("allTasks.moveDown")}
              aria-label={t("allTasks.moveDown")}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}

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

        <ChevronRight className="w-5 h-5 text-text-muted" />
      </div>
    </div>
  );
}
