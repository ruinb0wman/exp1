<script setup lang="ts">
import { computed } from "vue";
import { LucideIcon } from "@ruinb0w/ui";
import { ACHIEVEMENT_ICONS, REWARD_ICONS } from "@/db/types";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
	name: string;
	color?: string;
}>();

/**
 * 白名单 = 奖励图标 ∪ 成就图标（业务边界在项目里，库的 LucideIcon 认全部 Lucide 图标）。
 * 未注册的名字回落到 Trophy，避免脏数据把界面渲染成空白。
 */
const KNOWN_ICONS = new Set<string>([...REWARD_ICONS, ...ACHIEVEMENT_ICONS]);

const iconName = computed(() => (KNOWN_ICONS.has(props.name) ? props.name : "Trophy"));
</script>

<template>
	<!-- size 24 = 项目既有默认；调用方用 w-5/h-5 或 size 属性覆盖 -->
	<LucideIcon :name="iconName" :color="color" :size="24" v-bind="$attrs" />
</template>
