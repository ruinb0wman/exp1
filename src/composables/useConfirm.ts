import { ref } from "vue";

export type ConfirmVariant = "danger" | "warning" | "info";

export interface ConfirmOptions {
	title?: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
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
			options,
			resolve,
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
