import { CheckCircle2, Circle, XCircle, type LucideIcon } from "lucide-react";
import type { TaskHistoryItem } from "@/db/services";

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

export type StatusLabelKey = "completed" | "skipped" | "pending";
export function getStatusLabel(status: TaskHistoryItem["instance"]["status"]): StatusLabelKey {
  switch (status) {
    case "completed":
      return "completed";
    case "skipped":
      return "skipped";
    default:
      return "pending";
  }
}

export type DateTimeResult = 
  | { type: "today"; time: string }
  | { type: "yesterday"; time: string }
  | { type: "daysAgo"; value: number; time: string }
  | { type: "monthDay"; month: number; day: number; time: string };

export function formatDateTime(dateStr: string | undefined): DateTimeResult | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  if (diffDays === 0) {
    return { type: "today", time: timeStr };
  } else if (diffDays === 1) {
    return { type: "yesterday", time: timeStr };
  } else if (diffDays < 7) {
    return { type: "daysAgo", value: diffDays, time: timeStr };
  } else {
    return { type: "monthDay", month: date.getMonth() + 1, day: date.getDate(), time: timeStr };
  }
}

export type ShortDateResult = 
  | { type: "today" }
  | { type: "yesterday" }
  | { type: "daysAgo"; value: number }
  | { type: "monthDay"; month: number; day: number };

export function formatShortDate(dateStr: string | undefined): ShortDateResult | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { type: "today" };
  } else if (diffDays === 1) {
    return { type: "yesterday" };
  } else if (diffDays < 7) {
    return { type: "daysAgo", value: diffDays };
  } else {
    return { type: "monthDay", month: date.getMonth() + 1, day: date.getDate() };
  }
}
