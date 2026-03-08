import type { TaskHistoryItem } from "@/db/services";
import { TaskHistoryItemCard } from "./TaskHistoryItemCard";

interface TaskGroupProps {
  dateGroup: string;
  tasks: TaskHistoryItem[];
  onTaskClick: (item: TaskHistoryItem) => void;
}

export function TaskGroup({ dateGroup, tasks, onTaskClick }: TaskGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Date Group Header */}
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-text-muted text-sm font-medium">{dateGroup}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Tasks in this group */}
      <div className="flex flex-col gap-2">
        {tasks.map((item) => (
          <TaskHistoryItemCard
            key={item.instance.id}
            item={item}
            onClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
