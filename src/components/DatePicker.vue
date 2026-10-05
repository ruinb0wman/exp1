<script setup lang="ts">
import { computed, ref } from "vue";
import { Calendar as CalendarIcon } from "lucide-vue-next";
import Popup from "./Popup.vue";
import Calendar, { type CalendarValue } from "./Calendar.vue";

/*
 * 默认日期格式化函数
 * 注意：不能在 withDefaults 的默认值里引用局部变量（会被提升到 setup 之外），
 * 所以默认值直接内联同样的实现。
 */
function formatDateDefault(date: Date): string {
	return date.toLocaleDateString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
}

const props = withDefaults(
	defineProps<{
		/** 选中的日期 */
		modelValue?: Date | null;
		/** 默认选中的日期（非受控） */
		defaultValue?: Date | null;
		/** 占位文本 */
		placeholder?: string;
		/** 是否禁用 */
		disabled?: boolean;
		/** 日期格式化函数 */
		format?: (date: Date) => string;
		minDate?: Date;
		maxDate?: Date;
		defaultMonth?: Date;
		weekStartsOn?: 0 | 1;
		weekDayLabels?: string[];
		monthLabel?: (date: Date) => string;
		showYearSwitcher?: boolean;
	}>(),
	{
		placeholder: "Select date",
		disabled: false,
		format: () => (date: Date) =>
			date.toLocaleDateString("zh-CN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			}),
	},
);

const emit = defineEmits<{
	"update:modelValue": [value: Date | null];
	change: [value: Date | null];
	monthChange: [date: Date];
}>();

// 是否为受控组件
const isControlled = computed(() => props.modelValue !== undefined);

// 内部状态（非受控模式）
const internalValue = ref<Date | null>(props.defaultValue ?? null);

// 当前选中的日期
const selectedDate = computed(() =>
	isControlled.value ? (props.modelValue ?? null) : internalValue.value,
);

// Popup 显示状态
const isOpen = ref(false);

const displayText = computed(() =>
	selectedDate.value
		? (props.format ?? formatDateDefault)(selectedDate.value)
		: props.placeholder,
);

function handleOpen() {
	if (!props.disabled) isOpen.value = true;
}

function handleClose() {
	isOpen.value = false;
}

// 处理日期选择
function handleDateChange(date: CalendarValue) {
	if (date instanceof Date) {
		if (!isControlled.value) internalValue.value = date;
		emit("update:modelValue", date);
		emit("change", date);
		// 选择后关闭弹窗
		isOpen.value = false;
	}
}

// 清除选择
function handleClear(e: MouseEvent) {
	e.stopPropagation();
	if (!isControlled.value) internalValue.value = null;
	emit("update:modelValue", null);
	emit("change", null);
}

function handleConfirm() {
	// 如果没有选择日期，默认选择今天
	if (!selectedDate.value) {
		const today = new Date();
		if (!isControlled.value) internalValue.value = today;
		emit("update:modelValue", today);
		emit("change", today);
	}
	handleClose();
}
</script>

<template>
	<div>
		<!-- 触发区域 -->
		<button
			type="button"
			:disabled="disabled"
			:class="`w-full flex items-center justify-between gap-2 px-4 py-3
				bg-surface border border-border rounded-xl
				text-left transition-all duration-200
				${disabled ? 'opacity-50 cursor-not-allowed bg-surface/50' : 'hover:border-primary/50 active:border-primary cursor-pointer'}
				${selectedDate ? 'text-text-primary' : 'text-text-muted'}`"
			@click="handleOpen"
		>
			<span class="flex-1 truncate">{{ displayText }}</span>
			<div class="flex items-center gap-2">
				<span
					v-if="selectedDate && !disabled"
					class="w-5 h-5 flex items-center justify-center rounded-full bg-text-muted/20 text-text-muted hover:bg-text-muted/30 transition-colors"
					@click="handleClear"
				>
					×
				</span>
				<CalendarIcon class="w-5 h-5 text-text-secondary flex-shrink-0" />
			</div>
		</button>

		<!-- 日期选择弹窗 -->
		<Popup
			:is-open="isOpen"
			position="bottom"
			:mask-closable="true"
			:show-close-button="false"
			max-height="auto"
			@close="handleClose"
		>
			<div class="py-2">
				<Calendar
					:model-value="selectedDate"
					mode="single"
					:min-date="minDate"
					:max-date="maxDate"
					:default-month="defaultMonth"
					:week-starts-on="weekStartsOn"
					:week-day-labels="weekDayLabels"
					:month-label="monthLabel"
					:show-year-switcher="showYearSwitcher"
					@change="handleDateChange"
					@month-change="(d) => emit('monthChange', d)"
				>
					<template v-if="$slots.cell" #cell="{ info }">
						<slot name="cell" :info="info" />
					</template>
				</Calendar>
			</div>

			<!-- 底部操作按钮 -->
			<div class="flex gap-3 mt-4 pt-4 border-t border-border">
				<button
					type="button"
					class="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-surface hover:bg-surface/80 rounded-lg transition-colors"
					@click="handleClose"
				>
					Cancel
				</button>
				<button
					type="button"
					class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
					@click="handleConfirm"
				>
					Confirm
				</button>
			</div>
		</Popup>
	</div>
</template>
