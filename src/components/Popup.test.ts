import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 假 Tauri：捕获注册进来的返回手势回调，注销时清空 */
const mock = vi.hoisted(() => {
	const state = {
		backPress: null as (() => void) | null,
		unregister: vi.fn(async () => {
			state.backPress = null;
		}),
	};
	return state;
});

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/app", () => ({
	onBackButtonPress: async (cb: () => void) => {
		mock.backPress = cb;
		return { unregister: mock.unregister };
	},
}));

import Popup from "./Popup.vue";
import ConfirmDialog from "./ConfirmDialog.vue";

let wrapper: VueWrapper | null = null;

function render(node: unknown) {
	wrapper = mount(node as never);
}

/** 模拟 Android 返回手势：触发已注册的回调 */
function pressBack() {
	expect(mock.backPress, "没有注册返回手势监听").not.toBeNull();
	mock.backPress!();
}

async function click(text: string) {
	const el = wrapper!.findAll("button").find((b) => b.text().includes(text));
	expect(el, `找不到按钮：${text}`).toBeDefined();
	await el!.trigger("click");
}

function detailPopup(onClose: () => void, isOpen = true) {
	return defineComponent({
		setup() {
			return () =>
				h(
					Popup,
					{ isOpen, position: "center", title: "任务详情", onClose },
					{ default: () => "内容" },
				);
		},
	});
}

beforeEach(() => {
	mock.backPress = null;
	mock.unregister.mockClear();
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

describe("Android 返回手势处理浮层", () => {
	it("弹窗打开时，返回手势关闭弹窗", async () => {
		const onClose = vi.fn();
		render(detailPopup(onClose));
		await flushPromises();

		pressBack();

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("嵌套浮层（详情 → 确认框）只关最上面那层", async () => {
		const closeDetail = vi.fn();
		const cancelConfirm = vi.fn();

		const Harness = defineComponent({
			setup() {
				const confirmOpen = ref(false);
				return () =>
					h("div", [
						h(
							Popup,
							{
								isOpen: true,
								position: "center",
								title: "任务详情",
								onClose: closeDetail,
							},
							{
								default: () =>
									h(
										"button",
										{ onClick: () => (confirmOpen.value = true) },
										"删除",
									),
							},
						),
						h(ConfirmDialog, {
							isOpen: confirmOpen.value,
							message: "确认删除？",
							onConfirm: () => (confirmOpen.value = false),
							onCancel: () => {
								cancelConfirm();
								confirmOpen.value = false;
							},
						}),
					]);
			},
		});

		render(Harness);
		await click("删除");
		await flushPromises();

		// 第一次返回：只关确认框
		pressBack();
		expect(cancelConfirm).toHaveBeenCalledTimes(1);
		expect(closeDetail).not.toHaveBeenCalled();

		// 第二次返回：才轮到详情弹窗
		await flushPromises();
		pressBack();
		expect(closeDetail).toHaveBeenCalledTimes(1);
	});

	it("浮层全部关闭后注销监听，把返回手势还给系统默认", async () => {
		const onClose = vi.fn();
		render(detailPopup(onClose));
		await flushPromises();
		expect(mock.unregister).not.toHaveBeenCalled();

		// 关掉弹窗（点 × / 按 Esc / 点遮罩的等价路径）
		await wrapper!.setProps({ isOpen: false });
		await flushPromises();

		expect(mock.unregister).toHaveBeenCalledTimes(1);
		expect(mock.backPress).toBeNull();
	});
});
