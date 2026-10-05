import { shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { PluginListener } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { onBackButtonPress } from "@tauri-apps/api/app";

/**
 * Android 返回手势（返回键 / 全面屏返回手势）的浮层处理。
 *
 * 关键约束：Tauri 的 AppPlugin 一旦发现 JS 注册了 `back-button` 监听，
 * 就**不再自己处理返回**（不会回退 WebView 历史，也不会走 activity 默认返回）。
 * 而 JS 侧没有可用的「退出应用」能力，所以这里只在有浮层打开时占用返回手势，
 * 栈一空立刻注销，把返回交回系统默认：二级页回上一页 / tab 页退到后台。
 */

/** 按「打开顺序」排列的返回处理器，栈顶 = 最上层浮层 */
const stack: Array<() => void> = [];
let listener: PluginListener | null = null;
let attaching: Promise<void> | null = null;

function attach() {
	if (listener || attaching) return;

	attaching = onBackButtonPress(() => {
		// 只处理最上面那层（嵌套弹窗：任务详情 → 删除确认，返回只关确认）
		stack[stack.length - 1]?.();
	})
		.then((registered) => {
			// 极端竞态：await 期间浮层全关了，立刻注销，别把返回手势永久吞掉
			if (stack.length === 0) {
				void registered.unregister();
			} else {
				listener = registered;
			}
		})
		.catch((error) => {
			console.warn("注册返回手势监听失败", error);
		})
		.finally(() => {
			attaching = null;
		});
}

async function detach() {
	const registered = listener;
	listener = null;
	if (registered) {
		await registered.unregister().catch(() => {});
	}
}

/**
 * 让浮层响应 Android 返回手势（等价于按 Esc）。
 *
 * @param enabled 是否占用返回手势（浮层打开时传 true）
 * @param handler 返回手势回调（通常传 onClose / onCancel）
 */
export function useBackButtonHandler(
	enabled: MaybeRefOrGetter<boolean>,
	handler: () => void,
) {
	// 不把 handler 放进依赖：回调身份每次渲染都在变，重注册会打断栈顺序
	const handlerRef = shallowRef(handler);
	watch(
		() => handler,
		(next) => {
			handlerRef.value = next;
		},
		{ immediate: true },
	);

	watch(
		() => toValue(enabled),
		(isEnabled, _prev, onCleanup) => {
			if (!isEnabled || !isTauri()) return;

			const entry = () => handlerRef.value();
			stack.push(entry);
			attach();

			onCleanup(() => {
				const index = stack.indexOf(entry);
				if (index >= 0) stack.splice(index, 1);
				if (stack.length === 0) void detach();
			});
		},
		{ immediate: true },
	);
}
