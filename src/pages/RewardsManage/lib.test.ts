import { describe, expect, it } from "vitest";
import {
	filterTemplatesByEnabled,
	formatRewardSubtitle,
	getRewardStats,
} from "./lib";

const templates = [
	{ enabled: true },
	{ enabled: false },
	{ enabled: true },
];

describe("filterTemplatesByEnabled", () => {
	it("All 原样返回", () => {
		expect(filterTemplatesByEnabled(templates, "All")).toHaveLength(3);
	});

	it("Enabled / Disabled 各自只留对应状态", () => {
		expect(filterTemplatesByEnabled(templates, "Enabled")).toEqual([
			{ enabled: true },
			{ enabled: true },
		]);
		expect(filterTemplatesByEnabled(templates, "Disabled")).toEqual([
			{ enabled: false },
		]);
	});

	it("空列表返回空数组", () => {
		expect(filterTemplatesByEnabled([], "Enabled")).toEqual([]);
	});
});

describe("getRewardStats", () => {
	it("统计启用数、停用数与总数", () => {
		expect(getRewardStats(templates)).toEqual({
			enabledCount: 2,
			disabledCount: 1,
			totalCount: 3,
		});
	});
});

describe("formatRewardSubtitle", () => {
	it("有金额时显示积分 + 金额", () => {
		expect(
			formatRewardSubtitle({ pointsCost: 100, moneyCost: 10 }),
		).toBe("100 exp · ¥10");
	});

	it("金额为 0 时只显示积分", () => {
		expect(formatRewardSubtitle({ pointsCost: 0, moneyCost: 0 })).toBe("0 exp");
	});

	it("关闭计入统计时标注 not counted 且不显示金额", () => {
		expect(
			formatRewardSubtitle({
				pointsCost: 30,
				moneyCost: 5,
				countInConsumption: false,
			}),
		).toBe("30 exp · not counted");
	});
});
