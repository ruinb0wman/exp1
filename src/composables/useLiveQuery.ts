import {
	getCurrentScope,
	onScopeDispose,
	shallowRef,
	watch,
	type WatchSource,
} from "vue";
import { liveQuery, type Subscription } from "dexie";

/**
 * 把 Dexie 的 liveQuery 包成 Vue 响应式。
 *
 * - 只在组件 / composable 作用域内自动退订（onScopeDispose）
 * - 在 Pinia store 里没有作用域，用返回值里的 start/stop 手动管理
 */
export function useLiveQuery<T>(
	querier: () => T | Promise<T>,
	deps: WatchSource[] = [],
) {
	const data = shallowRef<T | undefined>(undefined);
	const error = shallowRef<unknown>(null);

	let subscription: Subscription | null = null;

	const stop = () => {
		subscription?.unsubscribe();
		subscription = null;
	};

	const start = () => {
		stop();
		subscription = liveQuery(querier).subscribe({
			next: (value) => {
				data.value = value as T;
				error.value = null;
			},
			error: (err) => {
				error.value = err;
			},
		});
	};

	if (deps.length > 0) {
		watch(deps, start, { immediate: true });
	} else {
		start();
	}

	// 函数式组件 / 组件外调用时没有作用域，交给调用方手动 stop
	if (getCurrentScope()) {
		onScopeDispose(stop);
	}

	return { data, error, start, stop };
}
