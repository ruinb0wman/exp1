<script setup lang="ts">
import { useRouter } from "vue-router";
import { MobileHeader } from "@ruinb0w/ui";

/**
 * 项目壳：把 MobileHeader 的 back 事件接到 vue-router。
 * 库不 import router，路由胶水只能留在项目侧（见 DESIGN.md「壳在库、容器在项目」）。
 */
withDefaults(
	defineProps<{
		title: string;
		back?: boolean;
	}>(),
	{
		back: false,
	},
);

const router = useRouter();
</script>

<template>
	<MobileHeader :title="title" :back="back" @back="router.back()">
		<template v-if="$slots.left" #left>
			<slot name="left" />
		</template>
		<template v-if="$slots.right" #right>
			<slot name="right" />
		</template>
	</MobileHeader>
</template>
