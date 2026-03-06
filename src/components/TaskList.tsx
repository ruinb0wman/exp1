import { ListTodo, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router";
import type { TaskInstance, TaskTemplate } from "@/db/types";

interface TaskWithTemplate {
  instance: TaskInstance;
  template: TaskTemplate;
}

interface TaskListProps {
  tasks: TaskWithTemplate[];
  isLoading: boolean;
  onComplete: (instanceId: number, rewardPoints: number) => void;
  onReset: (instanceId: number, rewardPoints: number) => void;
  title?: string;
  showViewAll?: boolean;
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
}

function TaskItem({ instance, template, onComplete, onReset }: TaskItemProps) {
  const isCompleted = instance.status === "completed";

  const handleChange = () => {
    if (instance.status === "pending") {
      onComplete(instance.id!, template.rewardPoints);
    } else if (instance.status === "completed") {
      onReset(instance.id!, template.rewardPoints);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border border-border">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={handleChange}
            className="custom-checkbox"
          />
        </div>
        <div className="flex flex-col justify-center flex-1">
          <p
            className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
              isCompleted
                ? "text-text-secondary line-through"
                : "text-text-primary"
            }`}
          >
            {template.title}
          </p>
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
  title = "Today's Tasks",
  showViewAll = true,
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
          {showViewAll && (
            <button
              onClick={() => navigate("/tasks")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface transition-colors"
            >
              <ListTodo className="w-4 h-4" />
              <span>All Tasks</span>
            </button>
          )}
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
        {showViewAll && (
          <button
            onClick={() => navigate("/tasks")}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface transition-colors"
          >
            <ListTodo className="w-4 h-4" />
            <span>All Tasks</span>
          </button>
        )}
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
              />
            ))}
      </div>
    </div>
  );
}
