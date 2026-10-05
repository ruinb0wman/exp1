<script lang="ts">
// ==================== 类型定义 ====================

export type CalendarValue = Date | [Date, Date] | null;

export interface CalendarCellInfo {
	date: Date; // 当前日期
	isToday: boolean; // 是否是今天
	isSelected: boolean; // 是否被选中（单选）或在范围内（范围选择）
	isRangeStart: boolean; // 是否是范围开始（仅范围模式）
	isRangeEnd: boolean; // 是否是范围结束（仅范围模式）
	isInRange: boolean; // 是否在范围内（仅范围模式）
	isCurrentMonth: boolean; // 是否在当前月份（上下月为 false）
	isDisabled: boolean; // 是否禁用（超出 min/max）
	dayOfWeek: number; // 星期几 0-6
}
</script>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-vue-next";

// ==================== 工具函数 ====================

/**
 * 判断两个日期是否是同一天
 */
function isSameDay(d1: Date, d2: Date): boolean {
	return (
		d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate()
	);
}

/**
 * 判断日期 d 是否在 [start, end] 范围内（包含边界）
 */
function isDateInRange(d: Date, start: Date, end: Date): boolean {
	const date = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const startTime = new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate(),
	).getTime();
	const endTime = new Date(
		end.getFullYear(),
		end.getMonth(),
		end.getDate(),
	).getTime();
	return date >= startTime && date <= endTime;
}

/**
 * 获取月份第一天的星期几，考虑 weekStartsOn
 */
function getFirstDayOfMonth(date: Date, weekStartsOn: 0 | 1): number {
	const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
	if (weekStartsOn === 1) {
		return firstDay === 0 ? 6 : firstDay - 1;
	}
	return firstDay;
}

/**
 * 获取月份的天数
 */
function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

/**
 * 判断日期是否在 min/max 范围内
 */
function isDateDisabled(date: Date, minDate?: Date, maxDate?: Date): boolean {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	if (minDate) {
		const min = new Date(
			minDate.getFullYear(),
			minDate.getMonth(),
			minDate.getDate(),
		);
		if (d < min) return true;
	}
	if (maxDate) {
		const max = new Date(
			maxDate.getFullYear(),
			maxDate.getMonth(),
			maxDate.getDate(),
		);
		if (d > max) return true;
	}
	return false;
}

// ==================== 主组件 ====================

const props = withDefaults(
	defineProps<{
		// === 模式 ===
		mode?: "single" | "range";

		// === 受控 ===
		modelValue?: CalendarValue;

		// === 非受控 ===
		defaultValue?: CalendarValue;
		defaultMonth?: Date; // 默认显示哪个月，默认今天

		// === 外观 ===
		showYearSwitcher?: boolean;

		// === 本地化 ===
		weekStartsOn?: 0 | 1;
		weekDayLabels?: string[];
		monthLabel?: (date: Date) => string;

		// === 限制 ===
		minDate?: Date;
		maxDate?: Date;
	}>(),
	{
		mode: "single",
		showYearSwitcher: false,
		weekStartsOn: 0,
		weekDayLabels: () => ["S", "M", "T", "W", "T", "F", "S"],
	},
);

const emit = defineEmits<{
	"update:modelValue": [value: CalendarValue];
	change: [value: CalendarValue];
	monthChange: [date: Date];
}>();

// 获取今天的日期（组件生命周期内固定）
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

function initialMonth(): Date {
	if (props.defaultMonth)
		return new Date(props.defaultMonth.getFullYear(), props.defaultMonth.getMonth(), 1);
	if (props.defaultValue instanceof Date)
		return new Date(props.defaultValue.getFullYear(), props.defaultValue.getMonth(), 1);
	if (Array.isArray(props.defaultValue) && props.defaultValue[0])
		return new Date(
			props.defaultValue[0].getFullYear(),
			props.defaultValue[0].getMonth(),
			1,
		);
	return new Date(today.getFullYear(), today.getMonth(), 1);
}

// 内部状态：当前显示的月份
const internalMonth = ref(initialMonth());

// 内部状态：非受控模式的选中值
const internalValue = ref<CalendarValue>(props.defaultValue ?? null);

// 范围选择时的临时状态（记录第一次点击）
const rangeTemp = ref<Date | null>(null);

// 判断是否为受控组件
const isControlled = computed(() => props.modelValue !== undefined);
const selectedValue = computed(() =>
	isControlled.value ? props.modelValue : internalValue.value,
);

const currentMonth = internalMonth;

function createCellInfo(date: Date, isCurrentMonth: boolean): CalendarCellInfo {
	const isTodayDate = isSameDay(date, today);
	const isDisabled = isDateDisabled(date, props.minDate, props.maxDate);

	let isSelected = false;
	let isRangeStart = false;
	let isRangeEnd = false;
	let isInRange = false;

	const selected = selectedValue.value;
	if (props.mode === "single" && selected instanceof Date) {
		isSelected = isSameDay(date, selected);
	} else if (props.mode === "range" && Array.isArray(selected)) {
		const [start, end] = selected;
		if (start && isSameDay(date, start)) {
			isRangeStart = true;
			isSelected = true;
		}
		if (end && isSameDay(date, end)) {
			isRangeEnd = true;
			isSelected = true;
		}
		if (start && end && !isRangeStart && !isRangeEnd) {
			isInRange = isDateInRange(date, start, end);
			isSelected = isInRange;
		}
	}

	return {
		date,
		isToday: isTodayDate,
		isSelected,
		isRangeStart,
		isRangeEnd,
		isInRange,
		isCurrentMonth,
		isDisabled,
		dayOfWeek: date.getDay(),
	};
}

// 计算日历数据
const calendarDays = computed<CalendarCellInfo[]>(() => {
	const year = currentMonth.value.getFullYear();
	const month = currentMonth.value.getMonth();

	const firstDayOffset = getFirstDayOfMonth(currentMonth.value, props.weekStartsOn);
	const daysInCurrentMonth = getDaysInMonth(year, month);
	const daysInPrevMonth = getDaysInMonth(year, month - 1);

	const days: CalendarCellInfo[] = [];

	// 上月日期
	for (let i = firstDayOffset - 1; i >= 0; i--) {
		const day = daysInPrevMonth - i;
		days.push(createCellInfo(new Date(year, month - 1, day), false));
	}

	// 当月日期
	for (let day = 1; day <= daysInCurrentMonth; day++) {
		days.push(createCellInfo(new Date(year, month, day), true));
	}

	// 下月日期（补全到 42 格，即 6 行）
	const remainingCells = 42 - days.length;
	for (let day = 1; day <= remainingCells; day++) {
		days.push(createCellInfo(new Date(year, month + 1, day), false));
	}

	return days;
});

function setValue(value: CalendarValue) {
	if (!isControlled.value) internalValue.value = value;
	emit("update:modelValue", value);
	emit("change", value);
}

// 处理日期点击
function handleDateClick(cellInfo: CalendarCellInfo) {
	if (cellInfo.isDisabled) return;

	const clickedDate = new Date(
		cellInfo.date.getFullYear(),
		cellInfo.date.getMonth(),
		cellInfo.date.getDate(),
	);

	if (props.mode === "single") {
		setValue(clickedDate);
	} else if (props.mode === "range") {
		if (!rangeTemp.value) {
			// 第一次点击：设置开始日期
			rangeTemp.value = clickedDate;
			setValue([clickedDate, clickedDate]);
		} else {
			// 第二次点击：设置结束日期
			const start = rangeTemp.value;
			const end = clickedDate;

			// 确保开始 <= 结束
			const newValue: [Date, Date] = start <= end ? [start, end] : [end, start];

			rangeTemp.value = null;
			setValue(newValue);
		}
	}
}

function changeMonth(newMonth: Date) {
	internalMonth.value = newMonth;
	emit("monthChange", newMonth);
}

function handlePrevMonth() {
	changeMonth(
		new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1),
	);
}

function handleNextMonth() {
	changeMonth(
		new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1),
	);
}

function handlePrevYear() {
	changeMonth(
		new Date(currentMonth.value.getFullYear() - 1, currentMonth.value.getMonth(), 1),
	);
}

function handleNextYear() {
	changeMonth(
		new Date(currentMonth.value.getFullYear() + 1, currentMonth.value.getMonth(), 1),
	);
}

// 月份标题格式化
const monthTitle = computed(() =>
	props.monthLabel
		? props.monthLabel(currentMonth.value)
		: currentMonth.value.toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
			}),
);

// 调整星期标签顺序
const adjustedWeekDayLabels = computed(() =>
	props.weekStartsOn === 1
		? [...props.weekDayLabels.slice(1), props.weekDayLabels[0]]
		: props.weekDayLabels,
);

// 默认 cell 样式
function defaultCellClass(info: CalendarCellInfo): string {
	let className =
		"w-full h-full flex items-center justify-center rounded-lg text-sm font-medium";

	if (info.isDisabled) {
		className += " text-gray-600 cursor-not-allowed";
	} else if (!info.isCurrentMonth) {
		className += " text-gray-600"; // 上下月灰色
	} else if (info.isRangeStart || info.isRangeEnd) {
		className += " bg-primary text-white";
	} else if (info.isInRange) {
		className += " bg-primary/20 text-primary";
	} else if (info.isSelected) {
		className += " bg-primary text-white";
	} else if (info.isToday) {
		className += " border border-primary text-primary";
	} else {
		className += " text-text-primary hover:bg-surface transition-colors";
	}

	return className;
}
</script>

<template>
	<div class="w-full">
		<!-- Header - Month Navigation -->
		<div class="flex items-center justify-between mb-2">
			<button
				v-if="showYearSwitcher"
				class="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
				aria-label="Previous year"
				@click="handlePrevYear"
			>
				<ChevronsLeft class="w-4 h-4" />
			</button>
			<div v-else class="w-10" />

			<button
				class="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
				aria-label="Previous month"
				@click="handlePrevMonth"
			>
				<ChevronLeft class="w-4 h-4" />
			</button>

			<p class="text-base font-bold text-text-primary px-4">{{ monthTitle }}</p>

			<button
				class="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
				aria-label="Next month"
				@click="handleNextMonth"
			>
				<ChevronRight class="w-4 h-4" />
			</button>

			<button
				v-if="showYearSwitcher"
				class="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
				aria-label="Next year"
				@click="handleNextYear"
			>
				<ChevronsRight class="w-4 h-4" />
			</button>
			<div v-else class="w-10" />
		</div>

		<!-- Week Days -->
		<div class="grid grid-cols-7">
			<p
				v-for="(day, index) in adjustedWeekDayLabels"
				:key="`${day}-${index}`"
				class="h-10 flex items-center justify-center text-[13px] font-bold text-text-muted"
			>
				{{ day }}
			</p>

			<!-- Calendar Days -->
			<button
				v-for="(cellInfo, index) in calendarDays"
				:key="`${cellInfo.date.toISOString()}-${index}`"
				:disabled="cellInfo.isDisabled"
				class="h-12 p-0.5"
				@click="handleDateClick(cellInfo)"
			>
				<slot name="cell" :info="cellInfo">
					<div :class="defaultCellClass(cellInfo)">{{ cellInfo.date.getDate() }}</div>
				</slot>
			</button>
		</div>
	</div>
</template>
