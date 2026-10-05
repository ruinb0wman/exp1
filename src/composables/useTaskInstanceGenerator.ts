import { ref, toValue, type MaybeRefOrGetter } from "vue";
import type { TaskTemplate, TaskInstance } from "@/db/types";
import {
	getEnabledTaskTemplates,
	getAllTaskInstances,
	createTaskInstances,
} from "@/db/services";
import {
	filterTemplatesNeedingInstancesOnDate,
	generateTaskInstances,
	toUserDateString,
	toInUserDay,
	buildTemplateLevelMap,
	sortDisplayTasks,
} from "@/libs/task";
import { useUserStore } from "@/store";

interface GenerateResult {
	generatedCount: number;
	generatedInstances: Omit<TaskInstance, "id" | "createdAt">[];
}

interface UseTaskInstanceGeneratorOptions {
	userId: MaybeRefOrGetter<number | undefined>;
	onGenerated?: (result: GenerateResult) => void;
	onError?: (error: Error) => void;
}

export function useTaskInstanceGenerator(
	options: UseTaskInstanceGeneratorOptions,
) {
	const { onGenerated, onError } = options;
	const userStore = useUserStore();

	const isGenerating = ref(false);
	const hasGenerated = ref(false);

	async function getTemplatesForDate(
		date: Date = new Date(),
	): Promise<TaskTemplate[]> {
		const userId = toValue(options.userId);
		if (!userId) return [];

		const dayEndTime = userStore.user?.dayEndTime ?? "00:00";
		const templates = await getEnabledTaskTemplates(userId);
		const existingInstances = await getAllTaskInstances(userId);

		return filterTemplatesNeedingInstancesOnDate(
			templates,
			existingInstances,
			date,
			dayEndTime,
		);
	}

	async function shouldGenerateOnDate(date: Date = new Date()): Promise<boolean> {
		const templates = await getTemplatesForDate(date);
		return templates.length > 0;
	}

	async function generateForDate(
		date: Date = new Date(),
		runOptions: { skipIfAlreadyGenerated?: boolean } = {},
	): Promise<GenerateResult> {
		const { skipIfAlreadyGenerated = true } = runOptions;

		const userId = toValue(options.userId);
		if (!userId) {
			throw new Error("User ID is required");
		}

		if (skipIfAlreadyGenerated && hasGenerated.value) {
			return { generatedCount: 0, generatedInstances: [] };
		}

		isGenerating.value = true;

		if (skipIfAlreadyGenerated) {
			hasGenerated.value = true;
		}

		try {
			const templatesNeedingInstances = await getTemplatesForDate(date);

			let generatedInstances: Omit<TaskInstance, "id" | "createdAt">[] = [];
			if (templatesNeedingInstances.length > 0) {
				const dayEndTime = userStore.user?.dayEndTime ?? "00:00";
				generatedInstances = generateTaskInstances(
					templatesNeedingInstances,
					date,
					dayEndTime,
				);
				await createTaskInstances(generatedInstances);
			}

			const result: GenerateResult = {
				generatedCount: generatedInstances.length,
				generatedInstances,
			};

			onGenerated?.(result);
			return result;
		} catch (error) {
			if (skipIfAlreadyGenerated) {
				hasGenerated.value = false;
			}

			const err = error instanceof Error ? error : new Error(String(error));
			onError?.(err);
			throw err;
		} finally {
			isGenerating.value = false;
		}
	}

	/**
	 * 生成今天的任务实例
	 * 等同于 generateForDate(new Date())
	 */
	async function generateToday(
		runOptions: { skipIfAlreadyGenerated?: boolean } = {},
	): Promise<GenerateResult> {
		return generateForDate(new Date(), runOptions);
	}

	/**
	 * 获取指定日期应该显示的实例/预览列表
	 * 用于日历等需要显示某天任务列表的场景
	 */
	async function getDisplayTasksForDate(
		date: Date,
	): Promise<
		Array<{
			template: TaskTemplate;
			instance?: TaskInstance;
			isPreview: boolean;
		}>
	> {
		const userId = toValue(options.userId);
		if (!userId) return [];

		const dayEndTime = userStore.user?.dayEndTime ?? "00:00";

		// 日历选中的是"日历日"语义:把日期归一化到该用户日内部的一个时刻
		// (dayEndTime + 1s)。直接套用 toUserDateString 会因"当前时刻早于
		// dayEndTime 则回退到前一天"而把周日解析成周六(如 dayEndTime=01:00 时)。
		const inDayDate = toInUserDay(date, dayEndTime);
		const userDateStr = toUserDateString(inDayDate, dayEndTime);

		// getEnabledTaskTemplates 已按 level 排序
		const templates = await getEnabledTaskTemplates(userId);
		const allInstances = await getAllTaskInstances(userId);

		const existingInstancesOnDate = allInstances.filter((inst) => {
			if (!inst.instanceDate) return false;
			return inst.instanceDate === userDateStr;
		});

		const templateInstanceMap = new Map<string, TaskInstance>();
		existingInstancesOnDate.forEach((inst) => {
			templateInstanceMap.set(inst.template.id!, inst);
		});

		const templatesNeedingInstances = filterTemplatesNeedingInstancesOnDate(
			templates,
			allInstances,
			inDayDate,
			dayEndTime,
		);
		const needingIds = new Set(templatesNeedingInstances.map((t) => t.id));

		// 按模板顺序遍历：命中实例就用实例，否则（需要生成）出预览项。
		// 不再把「已有实例」和「预览」拼成两段，两者混排在同一模板顺序里。
		const result: Array<{
			template: TaskTemplate;
			instance?: TaskInstance;
			isPreview: boolean;
		}> = [];
		for (const template of templates) {
			const instance = templateInstanceMap.get(template.id!);
			if (instance) {
				result.push({ template, instance, isPreview: false });
			} else if (needingIds.has(template.id)) {
				result.push({ template, isPreview: true });
			}
		}

		return sortDisplayTasks(result, buildTemplateLevelMap(templates));
	}

	/**
	 * 重置生成标记，允许再次生成
	 */
	function resetGenerationFlag() {
		hasGenerated.value = false;
	}

	return {
		/** 是否正在生成 */
		isGenerating,
		/** 是否已经生成过 */
		hasGenerated,
		/** 生成今天的实例 */
		generateToday,
		/** 生成指定日期的实例 */
		generateForDate,
		/** 获取指定日期需要生成的模板列表 */
		getTemplatesForDate,
		/** 检查指定日期是否需要生成 */
		shouldGenerateOnDate,
		/** 获取指定日期应该显示的任务列表（包含预览） */
		getDisplayTasksForDate,
		/** 重置生成标记 */
		resetGenerationFlag,
	};
}

export type { GenerateResult };
