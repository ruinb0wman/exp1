import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import ConfirmDialog from "./ConfirmDialog.vue";
import { resolveConfirm, useAlert, useConfirm, useConfirmState } from "@/composables/useConfirm";

/** 复刻 App.vue 里 ConfirmDialog 的接线，把 composable 与对话框连起来测 */
const Host = defineComponent({
	setup() {
		const state = useConfirmState();
		return () =>
			h(ConfirmDialog, {
				isOpen: state.value.isOpen,
				title: state.value.options?.title,
				message: state.value.options?.message ?? "",
				confirmLabel: state.value.options?.confirmLabel,
				cancelLabel: state.value.options?.cancelLabel,
				variant: state.value.options?.variant,
				alertOnly: state.value.options?.alertOnly,
				onConfirm: () => resolveConfirm(true),
				onCancel: () => resolveConfirm(false),
			});
	},
});

function buttonsByText(wrapper: ReturnType<typeof mount>, text: string) {
	return wrapper.findAll("button").filter((b) => b.text().includes(text));
}

describe("ConfirmDialog 模式", () => {
	it("默认模式渲染 Cancel + Confirm", () => {
		const wrapper = mount(ConfirmDialog, {
			props: { isOpen: true, message: "确定？" },
		});

		expect(buttonsByText(wrapper, "Cancel")).toHaveLength(1);
		expect(buttonsByText(wrapper, "Confirm")).toHaveLength(1);

		wrapper.unmount();
	});

	it("alertOnly 模式不渲染 Cancel，只留一个按钮", () => {
		const wrapper = mount(ConfirmDialog, {
			props: {
				isOpen: true,
				message: "boom",
				confirmLabel: "OK",
				alertOnly: true,
			},
		});

		expect(buttonsByText(wrapper, "Cancel")).toHaveLength(0);
		expect(buttonsByText(wrapper, "OK")).toHaveLength(1);
		// 右上角关闭按钮仍在（也是一种关闭方式）
		expect(wrapper.findAll("button")).toHaveLength(2);

		wrapper.unmount();
	});

	it("点确认按钮 emit confirm", async () => {
		const wrapper = mount(ConfirmDialog, { props: { isOpen: true, message: "确定？" } });

		await buttonsByText(wrapper, "Confirm")[0]!.trigger("click");

		expect(wrapper.emitted("confirm")).toHaveLength(1);

		wrapper.unmount();
	});
});

describe("useAlert 应用内提示框", () => {
	it("只渲染一个按钮，且关掉之前 promise 不 resolve；点掉后 resolve", async () => {
		const wrapper = mount(Host);

		let resolved = false;
		const alertDialog = useAlert();
		void alertDialog({
			title: "Export Failed",
			message: "boom",
			confirmLabel: "OK",
		}).then(() => {
			resolved = true;
		});
		await flushPromises();

		// 内容与「只有一个按钮」的形态
		expect(wrapper.text()).toContain("Export Failed");
		expect(wrapper.text()).toContain("boom");
		expect(buttonsByText(wrapper, "Cancel")).toHaveLength(0);
		expect(buttonsByText(wrapper, "OK")).toHaveLength(1);
		// 没点掉之前不能 resolve（否则调用方 await 完就往下走，而弹窗还挂着）
		expect(resolved).toBe(false);

		await buttonsByText(wrapper, "OK")[0]!.trigger("click");
		await flushPromises();

		expect(resolved).toBe(true);
		expect(wrapper.text()).not.toContain("boom");

		wrapper.unmount();
	});

	it("点遮罩 / 关闭按钮这条「取消」路径也会 resolve，不会把调用方挂死", async () => {
		const wrapper = mount(Host);

		let resolved = false;
		void useAlert()({ message: "boom" }).then(() => {
			resolved = true;
		});
		await flushPromises();
		expect(resolved).toBe(false);

		// 右上角的 X
		await wrapper.findAll("button")[0]!.trigger("click");
		await flushPromises();

		expect(resolved).toBe(true);

		wrapper.unmount();
	});
});

describe("useConfirm 回归保护", () => {
	it("确认返回 true、取消返回 false", async () => {
		const wrapper = mount(Host);
		const confirmDialog = useConfirm();

		const accepted = confirmDialog({ message: "删？" });
		await flushPromises();
		await buttonsByText(wrapper, "Confirm")[0]!.trigger("click");
		await expect(accepted).resolves.toBe(true);

		const rejected = confirmDialog({ message: "删？" });
		await flushPromises();
		await buttonsByText(wrapper, "Cancel")[0]!.trigger("click");
		await expect(rejected).resolves.toBe(false);

		wrapper.unmount();
	});
});
