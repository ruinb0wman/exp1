import { act } from "react";
import type { ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import { DynamicIcon } from "./DynamicIcon";
import { ACHIEVEMENT_ICONS, REWARD_ICONS } from "@/db/types";

// React 18+ 在测试环境里使用 act 需要这个开关
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 拿真实的 lucide-react 导出做参照：名字打错或未注册都会露馅 */
const lucideExports = Lucide as unknown as Record<string, ComponentType<LucideProps> | undefined>;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/** 渲染一次并把 <svg> 的 outerHTML 抄出来（副本比较，避免只比 className 漏掉别的属性） */
function renderSvg(node: ReactNode): string {
	const el = document.createElement("div");
	document.body.appendChild(el);
	const localRoot = createRoot(el);
	container = el;
	root = localRoot;
	act(() => {
		localRoot.render(node);
	});

	const svg = el.querySelector("svg");
	expect(svg, "没有渲染出 svg").not.toBeNull();
	const html = svg!.outerHTML;

	act(() => {
		localRoot.unmount();
	});
	el.remove();
	container = null;
	root = null;

	return html;
}

afterEach(() => {
	if (root) {
		act(() => {
			root!.unmount();
		});
	}
	container?.remove();
	container = null;
	root = null;
});

describe("DynamicIcon 图标注册表", () => {
	const allNames = [...new Set([...REWARD_ICONS, ...ACHIEVEMENT_ICONS])];

	it.each(allNames)("%s 渲染出的就是 lucide-react 的同名图标", (name) => {
		const Expected = lucideExports[name];
		if (!Expected) throw new Error(`lucide-react 没有导出 ${name}`);

		// 注册表里漏了某个名字时，DynamicIcon 会静默回退 Trophy —— 这里用「和真身逐字节一致」卡死
		const actual = renderSvg(<DynamicIcon name={name} />);
		const expected = renderSvg(<Expected />);

		expect(actual).toBe(expected);
	});

	it("未知图标名回退 Trophy（既有行为不变）", () => {
		const fallback = renderSvg(<DynamicIcon name="ThisIsNotARewardIcon" />);
		const trophy = renderSvg(<DynamicIcon name="Trophy" />);

		expect(fallback).toBe(trophy);
	});

	it("奖励商店白名单包含宠物 / 网络 / 日用品三个新图标", () => {
		expect(REWARD_ICONS).toEqual(
			expect.arrayContaining(["PawPrint", "Wifi", "SoapDispenserDroplet"]),
		);
	});

	it("新图标用的是 lucide 的真实图标，而不是奖品以外的替代品", () => {
		expect(renderSvg(<DynamicIcon name="PawPrint" />)).toBe(renderSvg(<Lucide.PawPrint />));
		expect(renderSvg(<DynamicIcon name="Wifi" />)).toBe(renderSvg(<Lucide.Wifi />));
		expect(renderSvg(<DynamicIcon name="SoapDispenserDroplet" />)).toBe(
			renderSvg(<Lucide.SoapDispenserDroplet />),
		);
	});
});
