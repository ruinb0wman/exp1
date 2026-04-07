import type { RepeatMode } from "@/db/types";

// 重复模式映射
export const repeatModeMap: Record<RepeatMode, string> = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// 重复模式颜色映射
export const repeatModeColorMap: Record<RepeatMode, string> = {
  none: "bg-text-muted/20 text-text-muted",
  daily: "bg-blue-500/20 text-blue-400",
  weekly: "bg-purple-500/20 text-purple-400",
  monthly: "bg-orange-500/20 text-orange-400",
};

// 分类类型
export const categories = ["All", "Daily", "Weekly", "Monthly", "One-time"] as const;
export type Category = (typeof categories)[number];

// 分类到重复模式的映射
const categoryToRepeatMode: Record<string, RepeatMode> = {
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
  "One-time": "none",
};

/**
 * 根据分类筛选任务模板
 */
export function filterTemplatesByCategory<T extends { repeatMode: RepeatMode }>(
  templates: T[],
  category: Category
): T[] {
  if (category === "All") return templates;
  const mode = categoryToRepeatMode[category];
  return templates.filter((template) => template.repeatMode === mode);
}

/**
 * 获取任务统计信息
 */
export function getTaskStats<T extends { enabled: boolean }>(templates: T[]) {
  const enabledCount = templates.filter((t) => t.enabled).length;
  const totalCount = templates.length;
  return { enabledCount, totalCount };
}
