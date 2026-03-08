import { CheckCircle2, Circle, XCircle, type LucideIcon } from "lucide-react";
import type { TaskHistoryItem } from "@/db/services";
import type { TaskHistoryFilterStatus } from "@/hooks/useTaskHistory";

// 过滤标签配置
export const filterTabs: { key: TaskHistoryFilterStatus; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待完成" },
  { key: "completed", label: "已完成" },
  { key: "skipped", label: "已跳过" },
];

// 获取状态图标
export function getStatusIcon(status: TaskHistoryItem["instance"]["status"]): LucideIcon {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "skipped":
      return XCircle;
    default:
      return Circle;
  }
}

// 获取状态样式
export function getStatusStyle(status: TaskHistoryItem["instance"]["status"]) {
  switch (status) {
    case "completed":
      return { color: "text-green-500", bg: "bg-green-500/20" };
    case "skipped":
      return { color: "text-text-muted", bg: "bg-text-muted/20" };
    default:
      return { color: "text-primary", bg: "bg-primary/20" };
  }
}

// 获取状态标签
export function getStatusLabel(status: TaskHistoryItem["instance"]["status"]): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "skipped":
      return "已跳过";
    default:
      return "待完成";
  }
}

// 格式化日期时间
export function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  if (diffDays === 0) {
    return `今天 ${timeStr}`;
  } else if (diffDays === 1) {
    return `昨天 ${timeStr}`;
  } else if (diffDays < 7) {
    return `${diffDays}天前 ${timeStr}`;
  } else {
    return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
  }
}

// 格式化日期（仅日期部分，用于显示）
export function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "今天";
  } else if (diffDays === 1) {
    return "昨天";
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

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
  if (!dateStr) return "无日期";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "今天";
  } else if (diffDays === 1) {
    return "昨天";
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
  }
}
