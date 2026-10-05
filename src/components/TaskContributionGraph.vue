<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { getDB } from "@/db";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import {
	formatLocalDate,
	formatLocalDateToYYYYMMDD,
	toLocalDateString,
} from "@/libs/time";
import { shouldGenerateInstanceOnDate } from "@/libs/task";
import { useUserStore } from "@/store/userStore";

const props = defineProps<{
	template: TaskTemplate;
	userId: number;
}>();

interface DayData {
	date: string;
	status: "completed" | "skipped" | "pending" | "none";
	instance?: TaskInstance;
}

interface RowData {
	days: DayData[];
}

const userStore = useUserStore();

const rowsData = ref<RowData[]>([]);
const isLoading = ref(true);
const totalStats = ref({ completed: 0, total: 0 });

async function fetchData() {
	isLoading.value = true;
	try {
		const db = getDB();
		const dayEndTime = userStore.user?.dayEndTime ?? "00:00";

		// 计算日期范围：180天前到今天
		const totalDays = 180;
		const daysPerRow = 30;
		const rows = 6;

		// 查询该模板的所有实例
		const instances = await db.taskInstances
			.where("templateId")
			.equals(props.template.id!)
			.and((instance) => instance.userId === props.userId)
			.toArray();

		// 按日期建立映射（使用本地日期）
		const instanceMap = new Map<string, TaskInstance>();
		instances.forEach((instance) => {
			if (instance.instanceDate) {
				const dateKey = instance.instanceDate;
				// 如果同一天有多个实例，优先保留已完成的
				const existing = instanceMap.get(dateKey);
				if (
					!existing ||
					(existing.status !== "completed" && instance.status === "completed")
				) {
					instanceMap.set(dateKey, instance);
				}
			}
		});

		// 生成行数据：180天，每行30天，共6行
		// 最后一格是今天，所以起始日期是今天往前推179天
		const newRowsData: RowData[] = [];
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - (totalDays - 1)); // 179天前

		let completedCount = 0;
		let totalCount = 0;

		for (let r = 0; r < rows; r++) {
			const rowDays: DayData[] = [];
			for (let d = 0; d < daysPerRow; d++) {
				const currentDate = new Date(startDate);
				// 计算当前格子的日期：行号 * 30 + 列号
				const dayOffset = r * daysPerRow + d;
				currentDate.setDate(startDate.getDate() + dayOffset);
				// 归一化到中午，避免 dayEndTime 导致 toUserDateString 回退日期
				currentDate.setHours(12, 0, 0, 0);

				// 使用本地日期生成 key
				const dateStr = formatLocalDateToYYYYMMDD(currentDate);
				const instance = instanceMap.get(dateStr);

				let status: DayData["status"] = "none";
				if (instance) {
					status = instance.status;
					totalCount++;
					if (instance.status === "completed") {
						completedCount++;
					}
				} else if (
					(!props.template.startAt ||
						dateStr >= toLocalDateString(props.template.startAt)) &&
					shouldGenerateInstanceOnDate(
						props.template,
						instances,
						currentDate,
						dayEndTime,
					)
				) {
					status = "skipped";
				}

				rowDays.push({
					date: dateStr,
					status,
					instance,
				});
			}
			newRowsData.push({ days: rowDays });
		}

		rowsData.value = newRowsData;
		totalStats.value = { completed: completedCount, total: totalCount };
	} catch (error) {
		console.error("加载任务贡献图数据失败:", error);
	} finally {
		isLoading.value = false;
	}
}

onMounted(() => void fetchData());
watch(() => [props.template.id, props.userId], () => void fetchData());

// 获取颜色类名
function getColorClass(status: DayData["status"]) {
	switch (status) {
		case "completed":
			return "bg-green-500";
		case "skipped":
			return "bg-yellow-600";
		case "pending":
			return "bg-surface-light";
		default:
			return "bg-surface-light/50";
	}
}

// 获取提示文本
function getTooltipText(day: DayData) {
	const dateText = formatLocalDate(day.date);
	switch (day.status) {
		case "completed":
			return `${dateText}: Completed`;
		case "skipped":
			return `${dateText}: Skipped`;
		case "pending":
			return `${dateText}: In Progress`;
		default:
			return `${dateText}: No task`;
	}
}
</script>

<template>
	<div class="bg-surface rounded-xl p-4">
		<div v-if="isLoading" class="flex items-center justify-center h-24">
			<div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
		</div>

		<template v-else>
			<div class="flex items-center justify-between mb-3">
				<h4 class="text-sm font-medium text-text-primary">Completion Record</h4>
				<span class="text-xs text-text-muted">
					{{ `${totalStats.completed} / ${totalStats.total} completed` }}
				</span>
			</div>

			<div class="flex flex-col gap-1 overflow-x-auto pb-2 scrollbar-hide">
				<div v-for="(row, rowIndex) in rowsData" :key="rowIndex" class="flex gap-1">
					<div
						v-for="(day, dayIndex) in row.days"
						:key="`${rowIndex}-${dayIndex}`"
						:class="`w-3 h-3 rounded-sm ${getColorClass(day.status)} transition-all duration-200 hover:ring-2 hover:ring-primary/50 cursor-pointer`"
						:title="getTooltipText(day)"
					/>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3 mt-3 text-[10px] text-text-muted">
				<div class="flex items-center gap-1">
					<div class="w-2.5 h-2.5 rounded-sm bg-green-500" />
					<span>Completed</span>
				</div>
				<div class="flex items-center gap-1">
					<div class="w-2.5 h-2.5 rounded-sm bg-yellow-600" />
					<span>Skipped</span>
				</div>
				<div class="flex items-center gap-1">
					<div class="w-2.5 h-2.5 rounded-sm bg-surface-light/50" />
					<span>No task</span>
				</div>
			</div>
		</template>
	</div>
</template>
