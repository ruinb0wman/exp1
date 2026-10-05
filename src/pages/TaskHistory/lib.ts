import type { TaskHistoryItem } from "@/db/services";
import type { TaskHistoryFilterStatus } from "@/composables/useTaskHistory";

// 过滤标签配置
export const filterTabs: { key: TaskHistoryFilterStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "skipped", label: "Skipped" },
];

// 按日期分组任务
export function groupTasksByDate(tasks: TaskHistoryItem[]): Map<string, TaskHistoryItem[]> {
  const groups = new Map<string, TaskHistoryItem[]>();

  tasks.forEach((task) => {
    const dateKey = formatDateGroup(task.instance.createdAt);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(task);
  });

  return groups;
}

// 格式化日期（仅日期部分，用于分组）
export function formatDateGroup(dateStr: string | undefined): string {
  if (!dateStr) return "No Date";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
  }
}
