/**
 * 奖品管理页的筛选与统计（纯函数，便于单测）
 *
 * 停用（enabled = false）只是下架：不进商店、不参与补货，但消费记录、补货记录
 * 与历史分组都保留 —— 所以需要一个能列出停用奖品的地方，否则停用是单向操作。
 */

/** 筛选维度：全部 / 已启用 / 已停用 */
export const rewardFilters = ["All", "Enabled", "Disabled"] as const;
export type RewardFilter = (typeof rewardFilters)[number];

/**
 * 按启用状态筛选奖品模板
 */
export function filterTemplatesByEnabled<T extends { enabled: boolean }>(
	templates: T[],
	filter: RewardFilter,
): T[] {
	if (filter === "All") return templates;
	const wantEnabled = filter === "Enabled";
	return templates.filter((template) => template.enabled === wantEnabled);
}

/**
 * 奖品数量统计
 */
export function getRewardStats<T extends { enabled: boolean }>(templates: T[]) {
	const enabledCount = templates.filter((template) => template.enabled).length;
	return {
		enabledCount,
		disabledCount: templates.length - enabledCount,
		totalCount: templates.length,
	};
}

/**
 * 列表副标题：积分价 + 金额（关闭「计入消费统计」时标注，不显示金额）
 */
export function formatRewardSubtitle(template: {
	pointsCost: number;
	moneyCost?: number;
	countInConsumption?: boolean;
}): string {
	const cost = `${template.pointsCost.toLocaleString()} exp`;
	if (template.countInConsumption === false) {
		return `${cost} · not counted`;
	}
	return (template.moneyCost ?? 0) > 0
		? `${cost} · ¥${Number((template.moneyCost ?? 0).toFixed(2))}`
		: cost;
}
