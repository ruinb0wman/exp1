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

/**
 * 计算交换顺序后的完整 id 列表
 *
 * 只与**可见**的邻居交换，因此在「Daily」等筛选视图里上移时会跳过被隐藏的模板，
 * 隐藏模板之间的相对顺序保持不变。
 *
 * @param orderedIds 当前全量顺序（含被筛选隐藏的模板）
 * @param visibleIds 当前筛选后可见的模板
 * @param movingId 被移动的模板
 * @param direction -1 上移 / 1 下移
 * @returns 交换后的完整顺序；没有可交换的可见邻居时返回 null
 */
export function moveTemplateOrder(
  orderedIds: string[],
  visibleIds: string[],
  movingId: string,
  direction: -1 | 1
): string[] | null {
  const from = orderedIds.indexOf(movingId);
  if (from === -1) return null;

  const visible = new Set(visibleIds);
  if (!visible.has(movingId)) return null;

  let target = -1;
  for (let i = from + direction; i >= 0 && i < orderedIds.length; i += direction) {
    if (visible.has(orderedIds[i])) {
      target = i;
      break;
    }
  }
  if (target === -1) return null;

  const next = [...orderedIds];
  [next[from], next[target]] = [next[target], next[from]];
  return next;
}
