import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import type { RewardPurchase } from "@/db/types";
import { groupPurchasesByReward } from "../lib";
import RewardRecordGroups from "./RewardRecordGroups.vue";

/** 记录行用桩替换：删除要经过确认弹层，这里只验证事件转发 */
const PurchaseRowStub = defineComponent({
	name: "PurchaseRow",
	props: { purchase: { type: Object, required: true } },
	emits: ["delete"],
	template: '<div class="purchase-row">{{ purchase.id }}</div>',
});

function makePurchase(
	templateId: string,
	title: string,
	createdAt: string,
	quantity = 1,
): RewardPurchase {
	return {
		id: `${templateId}-${createdAt}`,
		userId: 1,
		templateId,
		template: {
			templateId,
			title,
			icon: "Coffee",
			pointsCost: 100,
			moneyCost: 10,
		},
		quantity,
		pointsCost: 100,
		pointsSpent: 100 * quantity,
		moneyAmount: 10 * quantity,
		createdAt,
	};
}

function mountGroups(
	groups: ReturnType<typeof groupPurchasesByReward>,
	expandedTemplateId: string | null = null,
) {
	return mount(RewardRecordGroups, {
		props: { groups, expandedTemplateId },
		global: { stubs: { PurchaseRow: PurchaseRowStub } },
	});
}

const groups = groupPurchasesByReward([
	makePurchase("a", "Coffee", "2026-09-14T05:00:00.000Z", 2),
	makePurchase("a", "Coffee", "2026-09-12T05:00:00.000Z"),
	makePurchase("b", "Game", "2026-09-13T05:00:00.000Z"),
]);

describe("RewardRecordGroups", () => {
	it("每个奖品一个分组，默认展开并渲染组内记录", () => {
		const wrapper = mountGroups(groups);

		expect(wrapper.findAll("[data-record-group]")).toHaveLength(2);
		expect(wrapper.text()).toContain("Coffee");
		expect(wrapper.text()).toContain("2 purchases · 3 items");
		expect(wrapper.text()).toContain("Game");
		// 默认展开：3 条记录全在
		expect(wrapper.findAll(".purchase-row")).toHaveLength(3);
	});

	it("点组头折叠、再点展开", async () => {
		const wrapper = mountGroups(groups);
		const header = wrapper.findAll("button")[0];

		await header.trigger("click");
		expect(wrapper.findAll(".purchase-row")).toHaveLength(1);

		await header.trigger("click");
		expect(wrapper.findAll(".purchase-row")).toHaveLength(3);
	});

	it("外部选中（expandedTemplateId）会把已折叠的组重新展开", async () => {
		const wrapper = mountGroups(groups);
		await wrapper.findAll("button")[0].trigger("click");
		expect(wrapper.findAll(".purchase-row")).toHaveLength(1);

		await wrapper.setProps({ expandedTemplateId: groups[0].templateId });
		expect(wrapper.findAll(".purchase-row")).toHaveLength(3);
	});

	it("把记录行的删除事件带上 purchaseId 转发出去", async () => {
		const wrapper = mountGroups(groups);
		const rows = wrapper.findAllComponents(PurchaseRowStub);

		rows[0].vm.$emit("delete", "purchase-1");
		expect(wrapper.emitted("delete")).toEqual([["purchase-1"]]);
	});

	it("无记录时显示空状态", () => {
		const wrapper = mountGroups([]);
		expect(wrapper.findAll("[data-record-group]")).toHaveLength(0);
		expect(wrapper.text()).toContain("No spending in this period");
	});
});
