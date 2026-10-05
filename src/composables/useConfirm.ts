import { ref } from "vue";

export type ConfirmVariant = "danger" | "warning" | "info";

export interface ConfirmOptions {
	title?: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: ConfirmVariant;
	/** 只显示一个按钮（useAlert 用），不渲染 Cancel */
	alertOnly?: boolean;
}

/** 应用内提示框参数：没有「取消」语义，所以没有 cancelLabel */
export interface AlertOptions {
	title?: string;
	message: string;
	confirmLabel?: string;
	variant?: ConfirmVariant;
}

interface ConfirmState {
	isOpen: boolean;
	options: ConfirmOptions | null;
	resolve: ((value: boolean) => void) | null;
}

const state = ref<ConfirmState>({
	isOpen: false,
	options: null,
	resolve: null,
});

/** 供 ConfirmHost 读取当前对话框状态 */
export function useConfirmState() {
	return state;
}

function confirm(options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => {
		state.value = {
			isOpen: true,
			options: { ...options, alertOnly: false },
			resolve,
		};
	});
}

/**
 * 应用内提示框，替代原生 alert()。
 *
 * 原生 alert 在这套环境里是坏的：Android WebView 没实现 onJsAlert，
 * WebChromeClient 默认返回 false → 提示被静默丢弃（错误用户看不见）；
 * Electron（bow）里是原生模态，会阻塞渲染进程。
 */
function showAlert(options: AlertOptions): Promise<void> {
	return new Promise((resolve) => {
		state.value = {
			isOpen: true,
			options: { ...options, alertOnly: true },
			// 没有「取消」语义：只要对话框被关掉（按钮 / X / 遮罩 / Esc / 返回手势）就算完成
			resolve: () => resolve(),
		};
	});
}

/** 关闭对话框并回传结果 */
export function resolveConfirm(value: boolean) {
	state.value.resolve?.(value);
	state.value = { isOpen: false, options: null, resolve: null };
}

/** 与 React 版同形的调用方式：const confirm = useConfirm(); await confirm({...}) */
export function useConfirm() {
	return confirm;
}

/** const alertDialog = useAlert(); await alertDialog({...}) */
export function useAlert() {
	return showAlert;
}
