import { useNavigate } from "react-router";
import { CheckCircle2, XCircle, Clock, RefreshCw, Calendar, AlignLeft, Pencil } from "lucide-react";
import { Popup } from "./Popup";
import { TaskContributionGraph } from "./TaskContributionGraph";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { isExpired, getExpireTimeText } from "@/libs/time";
import { getTaskProgressPercent } from "@/db/services";

export interface TaskDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  instance: TaskInstance | null;
  template: TaskTemplate | null;
  /** 完成按钮回调 */
  onComplete?: () => void;
  /** 重置按钮回调 */
  onReset?: () => void;
  /** 增加计数回调（用于count类型任务） */
  onIncrementCount?: () => void;
  /** 是否处于加载状态 */
  isLoading?: boolean;
  /** 是否禁用操作 */
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
  isLoading = false,
  disabled = false,
}: TaskDetailPopupProps) {
  const navigate = useNavigate();

  // 处理编辑按钮点击
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

// 内部内容组件
interface TaskDetailContentProps {
  instance: TaskInstance;
  template: TaskTemplate;
  onComplete?: () => void;
  onReset?: () => void;
  onIncrementCount?: () => void;
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
  onClose,
  isLoading,
  disabled,
}: TaskDetailContentProps) {
  const isCompleted = instance.status === "completed";
  const expired = isExpired(instance.expiredAt);
  const hasCompleteRule = !!template.completeRule;
  const isCountRule = template.completeRule === "count";
  const isTimeRule = template.completeRule === "time";
  const progressPercent = getTaskProgressPercent(instance, template);

  // 获取进度文本
  const getProgressText = () => {
    if (!hasCompleteRule) return null;
    const progress = instance.completeProgress ?? 0;
    const target = template.completeTarget ?? 0;
    const unit = template.completeRule === "time" ? "分钟" : "次";
    return `${progress} / ${target} ${unit}`;
  };

  // 获取重复模式文本
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
          <span className="text-lg font-bold text-primary">+{template.rewardPoints}</span>
          <p className="text-xs text-text-muted">经验值</p>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="h-px bg-border" />

      {/* 任务信息 */}
      <div className="space-y-3">
        {/* 描述 */}
        {template.description && (
          <div className="flex items-start gap-3">
            <AlignLeft className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted">描述</p>
              <p className="text-sm text-text-primary mt-0.5">{template.description}</p>
            </div>
          </div>
        )}

        {/* 重复模式 */}
        <div className="flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-text-muted shrink-0" />
          <div>
            <p className="text-xs text-text-muted">重复</p>
            <p className="text-sm text-text-primary mt-0.5">{getRepeatText()}</p>
          </div>
        </div>

        {/* 时间信息 */}
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

      {/* 进度条（如果有完成规则） */}
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
        </div>
      )}

      {/* 任务完成统计图 - 仅对重复任务显示 */}
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

      {/* 子任务 */}
      {instance.subtasks.length > 0 && (
        <div className="bg-surface rounded-lg p-3">
          <p className="text-xs text-text-muted mb-2">子任务</p>
          <div className="flex flex-wrap gap-2">
            {instance.subtasks.map((subtask, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-surface-light rounded text-xs text-text-secondary"
              >
                {subtask}
              </span>
            ))}
          </div>
        </div>
      )}

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
          // time 类型任务：不显示完成任务按钮，显示提示
          <div className="flex-1 py-3 px-4 bg-surface rounded-xl text-center">
            <p className="text-sm text-text-secondary">使用番茄钟记录时间</p>
            <p className="text-xs text-text-muted mt-1">达到目标时长后自动完成</p>
          </div>
        ) : isCountRule && onIncrementCount ? (
          // count 类型任务：显示"完成一次"按钮
          <button
            onClick={onIncrementCount}
            disabled={expired || disabled || isLoading}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {isLoading ? "处理中..." : expired ? "已过期" : "完成一次"}
          </button>
        ) : (
          // 普通任务：显示"完成任务"按钮
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
