import { TaskTemplateCard } from "@/components/TaskTemplateCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import type { TaskTemplate } from "@/db/types";

interface TaskListProps {
  templates: TaskTemplate[];
  isLoading: boolean;
  error: string | null;
  isActionLoading: boolean;
  filter: string;
  onRefresh: () => void;
  onEdit: (id: string) => void;
  onToggleEnabled: (id: string, currentEnabled: boolean) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}

export function TaskList({
  templates,
  isLoading,
  error,
  isActionLoading,
  filter,
  onRefresh,
  onEdit,
  onToggleEnabled,
  onMove,
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
      {templates.map((template, index) => (
        <TaskTemplateCard
          key={template.id}
          id={template.id!}
          title={template.title}
          description={template.description}
          repeatMode={template.repeatMode}
          enabled={template.enabled}
          completeRule={template.completeRule}
          subtasks={template.subtasks}
          isActionLoading={isActionLoading}
          canMoveUp={index > 0}
          canMoveDown={index < templates.length - 1}
          onClick={() => onEdit(template.id!)}
          onToggleEnabled={(e) => {
            e.stopPropagation();
            onToggleEnabled(template.id!, template.enabled);
          }}
          onMoveUp={(e) => {
            e.stopPropagation();
            onMove(template.id!, -1);
          }}
          onMoveDown={(e) => {
            e.stopPropagation();
            onMove(template.id!, 1);
          }}
        />
      ))}
    </div>
  );
}
