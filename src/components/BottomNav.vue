<script setup lang="ts">
import { BarChart3, Home, Store, Timer, User } from "lucide-vue-next";
import { RouterLink, useRoute } from "vue-router";

const route = useRoute();

const items = [
	{ name: "home", to: "/", icon: Home, label: "Home" },
	{ name: "pomo", to: "/pomo", icon: Timer, label: "Pomo" },
	{ name: "store", to: "/store", icon: Store, label: "Store" },
	{ name: "stats", to: "/stats", icon: BarChart3, label: "Stats" },
	{ name: "profile", to: "/profile", icon: User, label: "Profile" },
] as const;

// 不用 RouterLink 的 isActive：Home 的路由 path 是 ""（解析后与父级 "/" 同值），会被
// vue-router 的「父记录回退」判定为所有 tab 页都激活。tab 路由名唯一，直接比 name。
const isActive = (name: string) => route.name === name;
</script>

<template>
	<nav class="fixed bottom-0 left-0 right-0 landscape:top-0 landscape:bottom-0 landscape:left-0 landscape:right-auto landscape:w-56 landscape:h-screen landscape:pb-0 landscape:pt-safe landscape:border-t-0 landscape:border-r landscape:flex-col landscape:justify-start landscape:gap-2 landscape:px-3 landscape:py-4 h-20 pb-safe bg-background/80 landscape:bg-background backdrop-blur-lg landscape:backdrop-blur-none border-t border-border flex items-start justify-around px-4 pt-2 z-50">
		<RouterLink
			v-for="item in items"
			:key="item.to"
			v-slot="{ navigate }"
			:to="item.to"
			replace
			custom
		>
			<!-- replace：底部 tab 页不参与返回手势的历史（否则 Home → Profile 再按返回会回到 Home） -->
			<a
				:class="`flex flex-col landscape:flex-row landscape:w-full landscape:px-4 landscape:py-3 landscape:rounded-lg landscape:gap-3 items-center gap-1 w-16 transition-colors ${
					isActive(item.name)
						? 'text-primary landscape:bg-primary/10'
						: 'text-text-secondary hover:text-text-primary landscape:hover:bg-surface-light'
				}`"
				@click="navigate"
			>
				<div class="w-6 h-6">
					<component
						:is="item.icon"
						:stroke-width="1.5"
						:fill="isActive(item.name) ? 'currentColor' : 'none'"
					/>
				</div>
				<span class="text-xs landscape:text-sm font-medium font-display landscape:font-normal">{{ item.label }}</span>
			</a>
		</RouterLink>
	</nav>
</template>
