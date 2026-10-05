<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { Calendar } from "lucide-vue-next";

defineProps<{
	enabledCount: number;
	totalCount: number;
}>();

// 不声明 emits：父组件的 @calendar-click 留在 attrs，据此决定是否渲染按钮
const attrs = useAttrs();
const calendarHandler = computed(
	() => attrs.onCalendarClick as (() => void) | undefined,
);
</script>

<template>
	<div class="flex items-center justify-between text-text-secondary text-sm">
		<span>{{ enabledCount }} of {{ totalCount }} enabled</span>
		<button
			v-if="calendarHandler"
			class="flex items-center gap-1 text-primary hover:text-primary-light transition-colors"
			@click="calendarHandler && calendarHandler()"
		>
			<Calendar class="w-4 h-4" />
			<span>Calendar View</span>
		</button>
	</div>
</template>
