import { ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { generateReport } from "@/db/services";
import type { ReportModel, ReportScope } from "@/libs/report/types";

interface UseReportParams {
	userId: MaybeRefOrGetter<number | null>;
	scope: MaybeRefOrGetter<ReportScope>;
	/** 锚点用户日 YYYY-MM-DD */
	anchor: MaybeRefOrGetter<string>;
	customStart?: MaybeRefOrGetter<string | undefined>;
	customEnd?: MaybeRefOrGetter<string | undefined>;
}

/**
 * 生成并持有当前周期报告
 * 参数变化时重新聚合；用请求序号避免旧请求覆盖新结果
 */
export function useReport(params: UseReportParams) {
	const model = ref<ReportModel | null>(null);
	const isLoading = ref(false);
	const error = ref<string | null>(null);
	let requestId = 0;

	async function load() {
		const userId = toValue(params.userId);
		if (!userId) {
			model.value = null;
			error.value = null;
			isLoading.value = false;
			return;
		}

		const currentRequest = requestId + 1;
		requestId = currentRequest;

		isLoading.value = true;
		error.value = null;
		try {
			const result = await generateReport({
				userId,
				scope: toValue(params.scope),
				anchor: toValue(params.anchor),
				customStart: toValue(params.customStart),
				customEnd: toValue(params.customEnd),
			});
			if (requestId !== currentRequest) return;
			model.value = result;
		} catch (loadError) {
			if (requestId !== currentRequest) return;
			error.value =
				loadError instanceof Error
					? loadError.message
					: "Failed to generate report";
			model.value = null;
		} finally {
			if (requestId === currentRequest) {
				isLoading.value = false;
			}
		}
	}

	watch(
		[
			() => toValue(params.userId),
			() => toValue(params.scope),
			() => toValue(params.anchor),
			() => toValue(params.customStart),
			() => toValue(params.customEnd),
		],
		() => void load(),
		{ immediate: true },
	);

	return { model, isLoading, error, refresh: load };
}
