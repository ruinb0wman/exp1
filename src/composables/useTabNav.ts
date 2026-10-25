import { useRoute, useRouter } from "vue-router";
import type { TabBarItem } from "@ruinb0w/ui";

/**
 * 底部标签栏的路由胶水。
 * 库的 BTabBar 只认 items / isActive / select 三个参数，路由与 replace 语义留在这里
 * （见 @ruinb0w/ui DESIGN.md「壳在库、容器在项目」）。
 */
const items: TabBarItem[] = [
	{ key: "home", label: "Home", icon: "House" },
	{ key: "pomo", label: "Pomo", icon: "Timer" },
	{ key: "store", label: "Store", icon: "Store" },
	{ key: "stats", label: "Stats", icon: "ChartColumn" },
	{ key: "profile", label: "Profile", icon: "User" },
];

export function useTabNav() {
	const route = useRoute();
	const router = useRouter();

	// 不用 RouterLink 的 isActive：Home 的 path 是 ""（与父级 "/" 同值），
	// vue-router 的「父记录回退」会把所有 tab 页都判成激活。tab 路由名唯一，直接比 name。
	const isActive = (item: TabBarItem) => route.name === item.key;

	// replace：底部 tab 页不参与返回手势的历史（否则 Home → Profile 再按返回会回 Home）
	const select = (key: string) => void router.replace({ name: key });

	return { items, isActive, select };
}
