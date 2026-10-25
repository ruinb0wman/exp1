import { mount } from "@vue/test-utils";
import * as Lucide from "@lucide/vue";
import { describe, expect, it } from "vitest";
import DynamicIcon from "./DynamicIcon.vue";
import { ACHIEVEMENT_ICONS, REWARD_ICONS } from "@/db/types";

/** 拿真实的 @lucide/vue 导出做参照：名字打错或未注册都会露馅 */
const lucideExports = Lucide as unknown as Record<string, unknown>;

/** 渲染一次并把 <svg> 的 outerHTML 抄出来（副本比较，避免只比 className 漏掉别的属性） */
function renderDynamic(name: string, color?: string): string {
	const wrapper = mount(DynamicIcon, { props: { name, color } });
	const svg = wrapper.find("svg");
	expect(svg.exists(), "没有渲染出 svg").toBe(true);
	const html = svg.element.outerHTML;
	wrapper.unmount();
	return html;
}

function renderExpected(component: unknown): string {
	const wrapper = mount(component as never);
	const svg = wrapper.find("svg");
	expect(svg.exists(), "参照组件没有渲染出 svg").toBe(true);
	const html = svg.element.outerHTML;
	wrapper.unmount();
	return html;
}

describe("DynamicIcon 图标注册表", () => {
	const allNames = [...new Set([...REWARD_ICONS, ...ACHIEVEMENT_ICONS])];

	it.each(allNames)("%s 渲染出的就是 @lucide/vue 的同名图标", (name) => {
		const Expected = lucideExports[name];
		if (!Expected) throw new Error(`@lucide/vue 没有导出 ${name}`);

		// 注册表里漏了某个名字时，DynamicIcon 会静默回退 Trophy —— 这里用「和真身逐字节一致」卡死
		expect(renderDynamic(name)).toBe(renderExpected(Expected));
	});

	it("未知图标名回退 Trophy（既有行为不变）", () => {
		expect(renderDynamic("ThisIsNotARewardIcon")).toBe(renderDynamic("Trophy"));
	});

	it("奖励商店白名单包含宠物 / 网络 / 日用品三个新图标", () => {
		expect(REWARD_ICONS).toEqual(
			expect.arrayContaining(["PawPrint", "Wifi", "SoapDispenserDroplet"]),
		);
	});

	it("新图标用的是 lucide 的真实图标，而不是奖品以外的替代品", () => {
		expect(renderDynamic("PawPrint")).toBe(renderExpected(Lucide.PawPrint));
		expect(renderDynamic("Wifi")).toBe(renderExpected(Lucide.Wifi));
		expect(renderDynamic("SoapDispenserDroplet")).toBe(
			renderExpected(Lucide.SoapDispenserDroplet),
		);
	});
});
