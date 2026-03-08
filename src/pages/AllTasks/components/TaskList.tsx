import { TaskCard } from "@/components/TaskCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import type { TaskTemplate } from "@/db/types";

interface TaskListProps {
  templates: TaskTemplate[];
  isLoading: boolean;
  error: string | null;
  deletingId: number | null;
  isActionLoading: boolean;
  filter: string;
  onRefresh: () => void;
  onEdit: (id: number) => void;
  onToggleEnabled: (id: number, currentEnabled: boolean) => void;
  onDelete: (id: number, title: string) => void;
}

export function TaskList({
  templates,
  isLoading,
  error,
  deletingId,
  isActionLoading,
  filter,
  onRefresh,
  onEdit,
  onToggleEnabled,
  onDelete,
}: TaskListProps) {
  if (isLoading) {
    return <LoadingState message="Loading tasks..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load tasks"
        retryLabel="Retry"
        onRetry={onRefresh}
      />
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        title="No tasks found"
        description={
          filter === "All" ? "Create your first task" : "Try a different filter"
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.map((template) => (
        <TaskCard
          key={template.id}
          id={template.id!}
          title={template.title}
          description={template.description}
          repeatMode={template.repeatMode}
          enabled={template.enabled}
          rewardPoints={template.rewardPoints}
          subtasks={template.subtasks}
          isRandomSubtask={template.isRandomSubtask}
          isDeleting={deletingId === template.id}
          isActionLoading={isActionLoading}
          onClick={() => onEdit(template.id!)}
          onToggleEnabled={(e) => {
            e.stopPropagation();
            onToggleEnabled(template.id!, template.enabled);
          }}
          onDelete={(e) => {
            e.stopPropagation();
            onDelete(template.id!, template.title);
          }}
        />
      ))}
    </div>
  );
}
