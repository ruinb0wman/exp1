<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

const props = defineProps<{
	options: number[];
	modelValue: number;
	format: (value: number) => string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const containerRef = ref<HTMLDivElement | null>(null);
const itemHeight = 40;
const visibleCount = 5;
const paddingHeight = ((visibleCount - 1) / 2) * itemHeight;

function handleScroll(event: Event) {
	const target = event.currentTarget as HTMLDivElement;
	const scrollTop = target.scrollTop;
	const index = Math.round(scrollTop / itemHeight);
	const newValue =
		props.options[Math.max(0, Math.min(index, props.options.length - 1))];
	if (newValue !== props.modelValue) {
		emit("update:modelValue", newValue);
	}
}

// 外部值 / 选项变化时把滚动位置对齐到当前值
watch(
	[() => props.modelValue, () => props.options],
	() => {
		if (containerRef.value) {
			const index = props.options.indexOf(props.modelValue);
			containerRef.value.scrollTop = index * itemHeight;
		}
	},
	{ immediate: true },
);

onMounted(() => {
	if (containerRef.value) {
		const index = props.options.indexOf(props.modelValue);
		containerRef.value.scrollTop = index * itemHeight;
	}
});
</script>

<template>
	<div class="relative h-[200px] w-full">
		<div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-10 bg-primary/10 rounded-lg pointer-events-none" />

		<div
			ref="containerRef"
			class="h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory"
			:style="{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }"
			@scroll="handleScroll"
		>
			<div :style="{ height: `${paddingHeight}px` }" />

			<div
				v-for="option in options"
				:key="option"
				class="h-10 flex items-center justify-center snap-center cursor-pointer"
				@click="emit('update:modelValue', option)"
			>
				<span
					:class="`text-lg font-medium transition-colors ${
						option === modelValue ? 'text-primary' : 'text-text-secondary'
					}`"
				>
					{{ format(option) }}
				</span>
			</div>

			<div :style="{ height: `${paddingHeight}px` }" />
		</div>
	</div>
</template>
