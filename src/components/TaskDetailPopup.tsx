import { useNavigate } from "react-router";
import { CheckCircle2, XCircle, Clock, RefreshCw, Calendar, AlignLeft, Pencil, CheckSquare, Square, Timer, ChevronRight } from "lucide-react";
import { Popup } from "./Popup";
import { TaskContributionGraph } from "./TaskContributionGraph";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { isExpired, getExpireTimeText } from "@/libs/time";
import { getTaskProgressPercent, getNextStage, getTotalPointsEarned } from "@/db/services";
import { usePomoStore } from "@/store/pomoStore";

export interface TaskDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  instance: TaskInstance | null;
  template: TaskTemplate | null;
  onComplete?: () => void;
  onReset?: () => void;
  onIncrementCount?: () => void;
  onToggleSubtask?: (index: number) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function TaskDetailPopup({
  isOpen,
  onClose,
  instance,
  template,
  onComplete,
  onReset,
  onIncrementCount,
  onToggleSubtask,
  isLoading = false,
  disabled = false,
}: TaskDetailPopupProps) {
  const navigate = useNavigate();

  const handleEdit = () => {
    onClose();
    if (template?.id) {
      navigate(`/tasks/${template.id}`);
    }
  };

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      position="bottom"
      title="任务详情"
      maskClosable={true}
      maxHeight="80vh"
      headerRight={(
        <button
          onClick={handleEdit}
          disabled={isLoading}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="编辑任务模板"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>编辑</span>
        </button>
      )}
    >
      {instance && template ? (
        <TaskDetailContent
          instance={instance}
          template={template}
          onComplete={onComplete}
          onReset={onReset}
          onIncrementCount={onIncrementCount}
          onToggleSubtask={onToggleSubtask}
          onClose={onClose}
          isLoading={isLoading}
          disabled={disabled}
        />
      ) : (
        <div className="py-8 text-center text-text-secondary">加载中...</div>
      )}
    </Popup>
  );
}

interface TaskDetailContentProps {
  instance: TaskInstance;
  template: TaskTemplate;
  onComplete?: () => void;
  onReset?: () => void;
  onIncrementCount?: () => void;
  onToggleSubtask?: (index: number) => void;
  onClose: () => void;
  isLoading: boolean;
  disabled: boolean;
}

function TaskDetailContent({
  instance,
  template,
  onComplete,
  onReset,
  onIncrementCount,
  onToggleSubtask,
  onClose,
  isLoading,
  disabled,
}: TaskDetailContentProps) {
  const navigate = useNavigate();
  const isCompleted = instance.status === "completed";
  const expired = isExpired(instance.expiredAt);
  const rule = template.completeRule;
  const hasCompleteRule = !!rule;
  const progressPercent = getTaskProgressPercent(instance);
  const earnedPoints = getTotalPointsEarned(instance);
  
  // 计算预计总积分
  const expectedPoints = hasCompleteRule
    ? (rule.stages?.reduce((sum, stage) => sum + stage.points, 0) || 0) + 
      (rule.completionPoints || 0)
    : 0;

  // 判断任务类型
  const isCountRule = rule?.type === "count";
  const isTimeRule = rule?.type === "time";
  const isSubtaskRule = rule?.type === "subtask";

  // 获取进度文本
  const getProgressText = () => {
    if (!hasCompleteRule) return null;
    
    if (isSubtaskRule) {
      const completedCount = (instance.completedSubtasks || []).filter(Boolean).length;
      const config = rule?.subtaskConfig;
      const targetCount = config?.mode === 'all' 
        ? instance.subtasks.length 
        : (config?.requiredCount || 1);
      return `${completedCount}/${targetCount} 项`;
    }

    const progress = instance.completeProgress ?? 0;
    const maxThreshold = rule?.stages.length ? Math.max(...rule.stages.map(s => s.threshold)) : 0;
    const unit = rule?.type === "time" ? "分钟" : "次";
    return `${progress}/${maxThreshold} ${unit}`;
  };

  // 获取下一阶段提示
  const getNextStageHint = () => {
    if (!rule || isSubtaskRule || !instance) return null;
    
    const nextStage = getNextStage(instance);
    if (!nextStage) return null;

    const progress = instance.completeProgress ?? 0;
    const remaining = nextStage.threshold - progress;
    const unit = rule.type === 'time' ? '分钟' : '次';
    
    return `再${remaining}${unit}可获得+${nextStage.points}积分`;
  };

  const getRepeatText = () => {
    switch (template.repeatMode) {
      case "daily":
        return template.repeatInterval && template.repeatInterval > 1
          ? `每 ${template.repeatInterval} 天`
          : "每天";
      case "weekly":
        if (template.repeatDaysOfWeek && template.repeatDaysOfWeek.length > 0) {
          const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
          const dayNames = template.repeatDaysOfWeek.map((d) => days[d]).join("、");
          return template.repeatInterval && template.repeatInterval > 1
            ? `每 ${template.repeatInterval} 周的 ${dayNames}`
            : `每周 ${dayNames}`;
        }
        return "每周";
      case "monthly":
        if (template.repeatDaysOfMonth && template.repeatDaysOfMonth.length > 0) {
          const days = template.repeatDaysOfMonth.map((d) => `${d}日`).join("、");
          return template.repeatInterval && template.repeatInterval > 1
            ? `每 ${template.repeatInterval} 个月的 ${days}`
            : `每月 ${days}`;
        }
        return "每月";
      default:
        return "一次性任务";
    }
  };

  // 渲染子任务列表
  const renderSubtasks = () => {
    if (!isSubtaskRule || instance.subtasks.length === 0) return null;

    const completedSubtasks = instance.completedSubtasks || [];
    const pointsPerSubtask = rule?.subtaskConfig?.pointsPerSubtask || [];

    return (
      <div className="bg-surface rounded-lg p-3 space-y-2">
        <p className="text-xs text-text-muted mb-2">子任务</p>
        {instance.subtasks.map((subtask, index) => {
          const isCompleted = completedSubtasks[index];
          const points = pointsPerSubtask[index] || 0;

          return (
            <button
              key={index}
              onClick={() => !expired && !disabled && onToggleSubtask?.(index)}
              disabled={expired || disabled || isLoading}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors
                ${isCompleted 
                  ? 'bg-green-500/10' 
                  : 'bg-surface-light hover:bg-surface-light/80'
                } ${(expired || disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isCompleted ? (
                <CheckSquare className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-text-muted shrink-0" />
              )}
              <span className={`flex-1 text-sm text-left ${isCompleted ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                {subtask}
              </span>
              {points > 0 && (
                <span className={`text-xs ${isCompleted ? 'text-green-500' : 'text-text-muted'}`}>
                  +{points}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 py-2">
      {/* 任务标题 */}
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? "bg-green-500/20" : expired ? "bg-red-500/20" : "bg-primary/20"
            }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : expired ? (
            <XCircle className="w-5 h-5 text-red-500" />
          ) : (
            <Clock className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <h3
            className={`text-lg font-semibold ${isCompleted ? "text-text-secondary line-through" : "text-text-primary"
              }`}
          >
            {template.title}
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            {isCompleted ? "已完成" : expired ? "已过期" : "进行中"}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <span className="text-lg font-bold text-primary">
            +{earnedPoints}{expectedPoints > 0 && <span className="text-sm text-text-muted font-normal">/{expectedPoints}</span>}
          </span>
          <p className="text-xs text-text-muted">exp</p>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* 任务信息 */}
      <div className="space-y-3">
        {template.description && (
          <div className="flex items-start gap-3">
            <AlignLeft className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted">描述</p>
              <p className="text-sm text-text-primary mt-0.5">{template.description}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-text-muted shrink-0" />
          <div>
            <p className="text-xs text-text-muted">重复</p>
            <p className="text-sm text-text-primary mt-0.5">{getRepeatText()}</p>
          </div>
        </div>

        {instance.startAt && (
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-text-muted shrink-0" />
            <div>
              <p className="text-xs text-text-muted">日期</p>
              <p className="text-sm text-text-primary mt-0.5">
                {new Date(instance.startAt).toLocaleDateString("zh-CN")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 进度条 */}
      {hasCompleteRule && (
        <div className="bg-surface rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">完成进度</span>
            <span className="text-sm font-medium text-primary">{getProgressText()}</span>
          </div>
          <div className="h-2 bg-surface-light rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${progressPercent >= 100 ? "bg-green-500" : progressPercent >= 60 ? "bg-primary" : "bg-yellow-500"
                }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          {/* 下一阶段提示 */}
          {!isCompleted && !expired && getNextStageHint() && (
            <p className="text-xs text-text-muted mt-2">{getNextStageHint()}</p>
          )}
        </div>
      )}

      {/* 任务完成统计图 */}
      {template.repeatMode !== "none" && (
        <TaskContributionGraph template={template} userId={instance.userId} weeks={20} />
      )}

      {/* 过期提示 */}
      {expired && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm text-red-500 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            此任务已过期
          </p>
        </div>
      )}
      {!expired && instance.expiredAt && (
        <div className="bg-surface rounded-lg p-3">
          <p className="text-xs text-text-muted">{getExpireTimeText(instance.expiredAt)}</p>
        </div>
      )}

      {/* 子任务列表（如果是 subtask 类型） */}
      {renderSubtasks()}

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        {isCompleted ? (
          <button
            onClick={onReset}
            disabled={disabled || isLoading}
            className="flex-1 py-3 px-4 bg-surface hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-xl font-medium transition-colors"
          >
            {isLoading ? "处理中..." : "标记为未完成"}
          </button>
        ) : isTimeRule ? (
          <button
            onClick={() => {
              usePomoStore.getState().setSelectedTask(instance.id!);
              navigate('/pomo');
            }}
            disabled={expired || disabled || isLoading}
            className="flex-1 py-3 px-4 bg-surface hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed text-text-primary rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Timer className="w-4 h-4" />
            <span>{isLoading ? "处理中..." : expired ? "已过期" : "使用番茄钟"}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : isCountRule && onIncrementCount ? (
          <button
            onClick={onIncrementCount}
            disabled={expired || disabled || isLoading}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {isLoading ? "处理中..." : expired ? "已过期" : "完成一次"}
          </button>
        ) : isSubtaskRule ? (
          // subtask 类型：通过点击子任务完成，不需要额外按钮
          <div className="flex-1 py-3 px-4 bg-surface rounded-xl text-center">
            <p className="text-sm text-text-secondary">点击上方子任务完成</p>
          </div>
        ) : (
          <button
            onClick={onComplete}
            disabled={expired || disabled || isLoading}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {isLoading ? "处理中..." : expired ? "已过期" : "完成任务"}
          </button>
        )}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="py-3 px-6 bg-surface hover:bg-surface-light disabled:opacity-50 text-text-secondary rounded-xl font-medium transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
