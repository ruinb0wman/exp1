import { ListTodo, ChevronRight, History, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { isExpired, getExpireTimeText } from "@/libs/time";
import { getTaskProgressPercent } from "@/db/services";

interface TaskWithTemplate {
  instance: TaskInstance;
  template: TaskTemplate;
}

interface TaskListProps {
  tasks: TaskWithTemplate[];
  isLoading: boolean;
  onComplete: (instanceId: number, rewardPoints: number) => void;
  onReset: (instanceId: number, rewardPoints: number) => void;
  onTaskClick?: (instance: TaskInstance, template: TaskTemplate) => void;
  title?: string;
  showViewAll?: boolean;
  showHistory?: boolean;
  emptyMessage?: string;
}

// Task item skeleton
function TaskSkeleton() {
  return (
    <div className="flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border border-border">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-5 h-5 rounded bg-surface-light animate-pulse" />
        <div className="flex flex-col justify-center flex-1 gap-2">
          <div className="h-4 w-32 bg-surface-light rounded animate-pulse" />
          <div className="h-3 w-20 bg-surface-light rounded animate-pulse" />
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <div className="h-3 w-8 bg-surface-light rounded animate-pulse" />
        <div className="h-5 w-5 bg-surface-light rounded animate-pulse" />
      </div>
    </div>
  );
}

// Single task item
interface TaskItemProps {
  instance: TaskInstance;
  template: TaskTemplate;
  onComplete: (instanceId: number, rewardPoints: number) => void;
  onReset: (instanceId: number, rewardPoints: number) => void;
  onClick?: (instance: TaskInstance, template: TaskTemplate) => void;
}

// 获取进度条颜色
function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 60) return "bg-primary";
  return "bg-yellow-500";
}

function TaskItem({ instance, template, onClick }: TaskItemProps) {
  const isCompleted = instance.status === "completed";
  const expired = isExpired(instance.expiredAt);
  const hasCompleteRule = !!template.completeRule;
  const progressPercent = getTaskProgressPercent(instance, template);
  const progressColor = getProgressColor(progressPercent);

  const handleClick = () => {
    onClick?.(instance, template);
  };

  // 进度文本
  const getProgressText = () => {
    if (!hasCompleteRule) return null;
    const progress = instance.completeProgress ?? 0;
    const target = template.completeTarget ?? 0;
    const unit = template.completeRule === "time" ? "min" : "times";
    return `${progress}/${target} ${unit}`;
  };

  return (
    <div 
      onClick={handleClick}
      className={`flex flex-col gap-2 bg-surface rounded-xl p-4 min-h-[72px] justify-between border cursor-pointer active:scale-[0.98] transition-transform ${
        expired ? "border-red-500/30 opacity-70" : "border-border"
      }`}
    >
      <div className="flex items-center gap-4 justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex flex-col justify-center flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
                  isCompleted
                    ? "text-text-secondary line-through"
                    : expired
                    ? "text-text-muted"
                    : "text-text-primary"
                }`}
              >
                {template.title}
              </p>
              {expired && (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
            </div>
            <p
              className={`text-sm font-normal leading-normal line-clamp-2 transition-all ${
                isCompleted
                  ? "text-text-muted line-through"
                  : "text-text-secondary"
              }`}
            >
              {template.description || `+${template.rewardPoints} exp`}
            </p>
            {instance.subtasks.length > 0 && (
              <p className="text-xs text-text-muted mt-1">
                {instance.subtasks.join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs text-primary font-medium">
            +{template.rewardPoints}
          </span>
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </div>
      </div>

      {/* 进度条和过期信息 */}
      {(hasCompleteRule || expired) && (
        <div className="flex flex-col gap-1.5 mt-1">
          {/* 进度条 */}
          {hasCompleteRule && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-surface-light rounded-full overflow-hidden">
                <div
                  className={`h-full ${progressColor} transition-all duration-300`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary min-w-[80px] text-right">
                {getProgressText()}
              </span>
            </div>
          )}

          {/* 过期提示 */}
          {expired && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              已过期
            </p>
          )}
          {!expired && instance.expiredAt && (
            <p className="text-xs text-text-muted">
              {getExpireTimeText(instance.expiredAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Empty state
interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-muted">
      <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
        <ListTodo className="w-8 h-8" />
      </div>
      <p className="text-base font-medium">{message}</p>
      <p className="text-sm mt-1">Create a task to get started</p>
    </div>
  );
}

export function TaskList({
  tasks,
  isLoading,
  onComplete,
  onReset,
  onTaskClick,
  title = "Today's Tasks",
  showViewAll = true,
  showHistory = false,
  emptyMessage = "No tasks for today",
}: TaskListProps) {
  const navigate = useNavigate();

  if (!isLoading && tasks.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary text-lg font-bold tracking-tight">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {showViewAll && (
              <button
                onClick={() => navigate("/tasks")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface transition-colors"
              >
                <ListTodo className="w-4 h-4" />
                <span>All Tasks</span>
              </button>
            )}
            {showHistory && (
              <button
                onClick={() => navigate("/task-history")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface transition-colors"
              >
                <History className="w-4 h-4" />
                <span>History</span>
              </button>
            )}
          </div>
        </div>
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-text-primary text-lg font-bold tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {showViewAll && (
            <button
              onClick={() => navigate("/tasks")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface transition-colors"
            >
              <ListTodo className="w-4 h-4" />
              <span>All Tasks</span>
            </button>
          )}
          {showHistory && (
            <button
              onClick={() => navigate("/task-history")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface transition-colors"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <TaskSkeleton key={index} />
            ))
          : tasks.map(({ instance, template }) => (
              <TaskItem
                key={instance.id}
                instance={instance}
                template={template}
                onComplete={onComplete}
                onReset={onReset}
                onClick={onTaskClick}
              />
            ))}
      </div>
    </div>
  );
}
