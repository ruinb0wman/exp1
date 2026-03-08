import { CheckCircle2, Circle, XCircle, type LucideIcon } from "lucide-react";
import type { TaskHistoryItem } from "@/db/services";

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
