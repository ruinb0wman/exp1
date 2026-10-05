import { onMounted, onUnmounted, ref } from "vue";

export interface SafeAreaInsets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/**
 * 获取安全区域（Safe Area）的 composable
 * 使用 CSS env(safe-area-inset-*) 获取安全区域值
 * 主要用于移动端处理刘海屏、状态栏、手势条等
 */
export function useSafeAreaInsets() {
	const insets = ref<SafeAreaInsets>({
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
	});

	const calculateInsets = () => {
		// 创建一个临时元素来获取计算后的 env() 值
		const div = document.createElement("div");
		div.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			padding-top: env(safe-area-inset-top);
			padding-right: env(safe-area-inset-right);
			padding-bottom: env(safe-area-inset-bottom);
			padding-left: env(safe-area-inset-left);
			pointer-events: none;
			visibility: hidden;
		`;
		document.body.appendChild(div);

		const styles = getComputedStyle(div);
		const top = parseFloat(styles.paddingTop) || 0;
		const right = parseFloat(styles.paddingRight) || 0;
		const bottom = parseFloat(styles.paddingBottom) || 0;
		const left = parseFloat(styles.paddingLeft) || 0;

		document.body.removeChild(div);

		insets.value = { top, right, bottom, left };
	};

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let stopIntervalId: ReturnType<typeof setTimeout> | null = null;

	onMounted(() => {
		// 初始计算
		calculateInsets();

		// 监听窗口变化
		window.addEventListener("resize", calculateInsets);
		window.addEventListener("orientationchange", calculateInsets);

		// 延迟再次计算，确保 WebView 已正确应用安全区域
		timeoutId = setTimeout(calculateInsets, 100);
		intervalId = setInterval(calculateInsets, 500);

		// 5秒后停止轮询
		stopIntervalId = setTimeout(() => {
			if (intervalId) clearInterval(intervalId);
			intervalId = null;
		}, 5000);
	});

	onUnmounted(() => {
		window.removeEventListener("resize", calculateInsets);
		window.removeEventListener("orientationchange", calculateInsets);
		if (timeoutId) clearTimeout(timeoutId);
		if (intervalId) clearInterval(intervalId);
		if (stopIntervalId) clearTimeout(stopIntervalId);
	});

	return insets;
}
