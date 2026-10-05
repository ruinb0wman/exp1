<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Minus, Plus } from "lucide-vue-next";
import {
	applyBounds,
	isTextAllowed,
	resolveBlurValue,
	textToNumber,
	valueToText,
} from "@/libs/numberInput";

const props = withDefaults(
	defineProps<{
		modelValue: number;
		min?: number;
		max?: number;
		step?: number;
		label?: string;
		suffix?: string;
		disabled?: boolean;
		size?: "sm" | "md" | "lg";
		inputWidth?: string;
		/** 允许输入小数（默认关闭，保持既有调用点行为不变） */
		allowDecimal?: boolean;
	}>(),
	{
		min: 0,
		max: Infinity,
		step: 1,
		disabled: false,
		size: "md",
		allowDecimal: false,
	},
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const sizeConfig = {
	sm: {
		button: "h-6 w-6",
		input: "h-6 w-10 text-sm",
		icon: "w-3 h-3",
		gap: "gap-1.5",
	},
	md: {
		button: "h-7 w-7",
		input: "h-7 w-12 text-base",
		icon: "w-4 h-4",
		gap: "gap-2",
	},
	lg: {
		button: "h-8 w-8",
		input: "h-8 w-14 text-base",
		icon: "w-4 h-4",
		gap: "gap-2",
	},
} as const;

const config = computed(() => sizeConfig[props.size]);

// 输入框由本地文本态驱动：聚焦时可以删到空，失焦时再兜底归一
const text = ref(valueToText(props.modelValue));
const isFocused = ref(false);

// 外部 value 变化时同步文本；聚焦中不同步，避免打断正在进行的输入
watch(
	() => props.modelValue,
	(value) => {
		if (!isFocused.value) text.value = valueToText(value);
	},
);

function commit(next: number) {
	emit(
		"update:modelValue",
		applyBounds(next, props.min, props.max, props.allowDecimal),
	);
}

function handleDecrease() {
	if (props.disabled) return;
	commit(props.modelValue - props.step);
}

function handleIncrease() {
	if (props.disabled) return;
	commit(props.modelValue + props.step);
}

function handleInputChange(event: Event) {
	if (props.disabled) return;
	const target = event.target as HTMLInputElement;
	// 小数键盘在部分区域设置下输出逗号，先归一为小数点
	const raw = props.allowDecimal
		? target.value.replace(",", ".")
		: target.value;

	// 非法字符：忽略本次输入，把 DOM 回滚到上一次文本
	// （Vue 不控制 input 的 value，不回滚的话非法字符会留在界面上）
	if (!isTextAllowed(raw, props.allowDecimal, props.min < 0)) {
		target.value = text.value;
		return;
	}

	text.value = raw;

	// "" / "-" / "." 这类中间态只改文本，不写回父组件，否则会立刻被夹取成 min 而删不干净
	const num = textToNumber(raw, props.allowDecimal);
	if (num !== null) commit(num);
}

function handleFocus() {
	isFocused.value = true;
}

function handleBlur() {
	isFocused.value = false;
	const next = resolveBlurValue(
		text.value,
		props.min,
		props.max,
		props.allowDecimal,
	);
	text.value = valueToText(next);
	commit(next);
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === "Enter") {
		(e.currentTarget as HTMLInputElement).blur();
		return;
	}
	if (e.key === "ArrowUp") {
		e.preventDefault();
		handleIncrease();
		return;
	}
	if (e.key === "ArrowDown") {
		e.preventDefault();
		handleDecrease();
	}
}

const isMinReached = computed(() => props.modelValue <= props.min);
const isMaxReached = computed(() => props.modelValue >= props.max);
</script>

<template>
	<div :class="`flex items-center ${config.gap}`">
		<span v-if="label" class="text-text-secondary text-sm shrink-0">{{ label }}</span>
		<button
			:disabled="disabled || isMinReached"
			:class="`${config.button} rounded-full bg-surface-light flex items-center justify-center text-text-primary hover:bg-surface-light/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed`"
			@click="handleDecrease"
		>
			<Minus :class="config.icon" />
		</button>
		<input
			type="text"
			:inputmode="allowDecimal ? 'decimal' : 'numeric'"
			:value="text"
			:disabled="disabled"
			:class="`${config.input} ${inputWidth || ''} p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none text-text-primary font-medium disabled:opacity-50`"
			@input="handleInputChange"
			@focus="handleFocus"
			@blur="handleBlur"
			@keydown="handleKeyDown"
		/>
		<button
			:disabled="disabled || isMaxReached"
			:class="`${config.button} rounded-full bg-surface-light flex items-center justify-center text-text-primary hover:bg-surface-light/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed`"
			@click="handleIncrease"
		>
			<Plus :class="config.icon" />
		</button>
		<span v-if="suffix" class="text-text-secondary text-sm shrink-0">{{ suffix }}</span>
	</div>
</template>
