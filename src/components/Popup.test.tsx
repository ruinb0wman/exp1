import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// React 18+ 在测试环境里使用 act 需要这个开关
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

import { Popup } from "./Popup";
import { ConfirmDialog } from "./ConfirmDialog";

let container: HTMLDivElement;
let root: Root;

function render(node: React.ReactNode) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root.render(node);
	});
}

/** 刷新微任务（onBackButtonPress 是异步注册的） */
async function flush() {
	await act(async () => {});
}

/** 模拟 Android 返回手势：触发已注册的回调 */
function pressBack() {
	expect(mock.backPress, "没有注册返回手势监听").not.toBeNull();
	act(() => {
		mock.backPress!();
	});
}

function click(text: string) {
	const el = Array.from(container.querySelectorAll("button")).find((b) =>
		b.textContent?.includes(text),
	);
	expect(el, `找不到按钮：${text}`).toBeDefined();
	act(() => {
		el!.click();
	});
}

function detailPopup(onClose: () => void, isOpen = true) {
	return (
		<Popup isOpen={isOpen} onClose={onClose} position="center" title="任务详情">
			内容
		</Popup>
	);
}

beforeEach(() => {
	mock.backPress = null;
	mock.unregister.mockClear();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe("Android 返回手势处理浮层", () => {
	it("弹窗打开时，返回手势关闭弹窗", async () => {
		const onClose = vi.fn();
		render(detailPopup(onClose));
		await flush();

		pressBack();

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("嵌套浮层（详情 → 确认框）只关最上面那层", async () => {
		const closeDetail = vi.fn();
		const cancelConfirm = vi.fn();

		function Harness() {
			const [confirmOpen, setConfirmOpen] = useState(false);
			return (
				<>
					<Popup isOpen onClose={closeDetail} position="center" title="任务详情">
						<button onClick={() => setConfirmOpen(true)}>删除</button>
					</Popup>
					<ConfirmDialog
						isOpen={confirmOpen}
						message="确认删除？"
						onConfirm={() => setConfirmOpen(false)}
						onCancel={() => {
							cancelConfirm();
							setConfirmOpen(false);
						}}
					/>
				</>
			);
		}

		render(<Harness />);
		click("删除");
		await flush();

		// 第一次返回：只关确认框
		pressBack();
		expect(cancelConfirm).toHaveBeenCalledTimes(1);
		expect(closeDetail).not.toHaveBeenCalled();

		// 第二次返回：才轮到详情弹窗
		await flush();
		pressBack();
		expect(closeDetail).toHaveBeenCalledTimes(1);
	});

	it("浮层全部关闭后注销监听，把返回手势还给系统默认", async () => {
		const onClose = vi.fn();
		render(detailPopup(onClose));
		await flush();
		expect(mock.unregister).not.toHaveBeenCalled();

		// 关掉弹窗（点 × / 按 Esc / 点遮罩的等价路径）
		act(() => {
			root.render(detailPopup(onClose, false));
		});
		await flush();

		expect(mock.unregister).toHaveBeenCalledTimes(1);
		expect(mock.backPress).toBeNull();
	});
});
