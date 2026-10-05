import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";
import MainLayout from "@/components/layouts/MainLayout.vue";
import SimpleLayout from "@/components/layouts/SimpleLayout.vue";
import Home from "@/pages/Home/index.vue";
import AllTasks from "@/pages/AllTasks/index.vue";
import EditTask from "@/pages/EditTask.vue";
import Store from "@/pages/Store/index.vue";
import EditReward from "@/pages/EditReward.vue";
import Stats from "@/pages/Stats.vue";
import Profile from "@/pages/Profile/index.vue";
import Pomo from "@/pages/Pomo/index.vue";
import PointsHistory from "@/pages/PointsHistory/index.vue";
import Consumption from "@/pages/Consumption/index.vue";
import TaskHistory from "@/pages/TaskHistory/index.vue";
import Reports from "@/pages/Reports/index.vue";
import ReplenishmentHistory from "@/pages/ReplenishmentHistory.vue";
import Achievements from "@/pages/Achievements/index.vue";
import Settings from "@/pages/Settings.vue";
import DataImportExport from "@/pages/DataImportExport.vue";

const routes: RouteRecordRaw[] = [
	// 带底部导航的主页面
	{
		path: "/",
		component: MainLayout,
		children: [
			{ path: "", name: "home", component: Home },
			{ path: "pomo", name: "pomo", component: Pomo },
			{ path: "store", name: "store", component: Store },
			{ path: "stats", name: "stats", component: Stats },
			{ path: "profile", name: "profile", component: Profile },
		],
	},
	// 不带底部导航（横屏才显示）的次级页面
	{
		path: "/",
		component: SimpleLayout,
		children: [
			{ path: "tasks", name: "tasks", component: AllTasks },
			{ path: "tasks/new", name: "task-new", component: EditTask },
			{ path: "tasks/:id", name: "task-edit", component: EditTask },
			{ path: "rewards/new", name: "reward-new", component: EditReward },
			{ path: "rewards/:id", name: "reward-edit", component: EditReward },
			{
				path: "replenishment/:templateId",
				name: "replenishment-history",
				component: ReplenishmentHistory,
			},
			{ path: "points-history", name: "points-history", component: PointsHistory },
			{ path: "consumption", name: "consumption", component: Consumption },
			{ path: "task-history", name: "task-history", component: TaskHistory },
			{ path: "reports", name: "reports", component: Reports },
			{ path: "achievements", name: "achievements", component: Achievements },
			{ path: "settings", name: "settings", component: Settings },
			{
				path: "data-import-export",
				name: "data-import-export",
				component: DataImportExport,
			},
		],
	},
];

const router = createRouter({
	// Tauri WebView 里没有服务端路由，hash 模式免去 404 问题
	history: createWebHashHistory(),
	routes,
});

export default router;
