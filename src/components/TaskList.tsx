import { ListTodo, History } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { TaskInstanceCard } from "@/components/TaskInstanceCard";

interface TaskWithTemplate {
  instance: TaskInstance;
  template: TaskTemplate;
}

interface TaskListProps {
  tasks: TaskWithTemplate[];
  isLoading: boolean;
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
        <div className="w-10 h-10 rounded-lg bg-surface-light animate-pulse" />
        <div className="flex flex-col justify-center flex-1 gap-2">
          <div className="h-4 w-32 bg-surface-light rounded animate-pulse" />
          <div className="h-3 w-20 bg-surface-light rounded animate-pulse" />
        </div>
      </div>
      <div className="h-4 w-12 bg-surface-light rounded animate-pulse" />
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
  onTaskClick,
  title = "Today's Tasks",
  showViewAll = true,
  showHistory = false,
  emptyMessage = "No tasks for today",
}: TaskListProps) {
  const navigate = useNavigate();

  // 包装点击回调，将 TaskHistoryItem 解包为 instance 和 template
  const handleTaskClick = useCallback(
    (item: { instance: TaskInstance; template: TaskTemplate }) => {
      onTaskClick?.(item.instance, item.template);
    },
    [onTaskClick]
  );

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
              <TaskInstanceCard
                key={instance.id}
                item={{ instance, template }}
                onClick={handleTaskClick}
              />
            ))}
      </div>
    </div>
  );
}
