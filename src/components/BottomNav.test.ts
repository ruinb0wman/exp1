import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import BottomNav from "@/components/BottomNav.vue";
import router from "@/router";

// 顺序与 BottomNav 里的 items 一致
const TABS: Array<[path: string, label: string]> = [
	["/", "Home"],
	["/pomo", "Pomo"],
	["/store", "Store"],
	["/stats", "Stats"],
	["/profile", "Profile"],
];

async function mountAt(path: string) {
	const wrapper = mount(BottomNav, { global: { plugins: [router] } });
	await router.push(path);
	await router.isReady();
	await flushPromises();
	return wrapper;
}

function activeLabels(wrapper: Awaited<ReturnType<typeof mountAt>>) {
	return wrapper
		.findAll("a")
		.filter((a) => a.classes().includes("text-primary"))
		.map((a) => a.text());
}

describe("BottomNav", () => {
	// 回归：Home 的路由 path 是 ""（解析后与父级 "/" 同值），曾因 RouterLink 的 isActive
	// 「父记录回退」而在所有 tab 页上都显示为激活
	it.each(TABS)("在 %s 上只激活 %s", async (path, label) => {
		const wrapper = await mountAt(path);
		expect(activeLabels(wrapper)).toEqual([label]);
		wrapper.unmount();
	});

	it("末尾斜杠不影响激活判断", async () => {
		const wrapper = await mountAt("/store/");
		expect(activeLabels(wrapper)).toEqual(["Store"]);
		wrapper.unmount();
	});

	it("次级页面（不走 MainLayout）时不激活任何 tab", async () => {
		const wrapper = await mountAt("/settings");
		expect(activeLabels(wrapper)).toEqual([]);
		wrapper.unmount();
	});

	it("点击 tab 会切到对应路由", async () => {
		const wrapper = await mountAt("/");
		const links = wrapper.findAll("a");
		await links.find((a) => a.text() === "Stats")!.trigger("click");
		await flushPromises();
		expect(router.currentRoute.value.path).toBe("/stats");
		wrapper.unmount();
	});

	it("tab 的 name 与 path 一一对应（防路由表漂移）", () => {
		const expected = [
			{ name: "home", to: "/" },
			{ name: "pomo", to: "/pomo" },
			{ name: "store", to: "/store" },
			{ name: "stats", to: "/stats" },
			{ name: "profile", to: "/profile" },
		];
		for (const { name, to } of expected) {
			expect(router.resolve({ name }).path).toBe(to);
		}
	});
});
