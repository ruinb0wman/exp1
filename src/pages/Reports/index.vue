<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { BarChart3 } from "lucide-vue-next";
import Header from "@/components/Header.vue";
import EmptyState from "@/components/EmptyState.vue";
import ErrorState from "@/components/ErrorState.vue";
import LoadingState from "@/components/LoadingState.vue";
import { useUserStore } from "@/store/userStore";
import { useReport } from "@/composables/useReport";
import { noteText } from "@/libs/report/renderMarkdown";
import type { ReportScope } from "@/libs/report/types";
import { formatLocalDate } from "@/libs/time";
import PeriodSelector from "./components/PeriodSelector.vue";
import SummaryCards from "./components/SummaryCards.vue";
import TrendChart from "./components/TrendChart.vue";
import TemplateTable from "./components/TemplateTable.vue";
import LevelTable from "./components/LevelTable.vue";
import ExportActions from "./components/ExportActions.vue";

/**
 * 分析报告页：周/月/年任务执行数据 → Markdown / JSON 导出
 * 报告为纯确定性统计，不调用 LLM
 */
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const scope = ref<ReportScope>("week");
const anchor = ref<Date>(new Date());
const customStart = ref<Date>(
	(() => {
		const date = new Date();
		date.setDate(date.getDate() - 6);
		return date;
	})(),
);
const customEnd = ref<Date>(new Date());
const includePrompt = ref(true);

const anchorStr = computed(() => formatLocalDate(anchor.value));
const customStartStr = computed(() => formatLocalDate(customStart.value));
const customEndStr = computed(() => formatLocalDate(customEnd.value));

const { model, isLoading, error, refresh } = useReport({
	userId: () => user.value?.id ?? null,
	scope,
	anchor: anchorStr,
	customStart: customStartStr,
	customEnd: customEndStr,
});

function handleCustomRangeChange(start: Date, end: Date) {
	customStart.value = start;
	customEnd.value = end;
}

const rangeText = computed(() => {
	if (!model.value) return "";
	const partial = model.value.period.isPartial
		? ` (as of ${model.value.period.end})`
		: "";
	return `${model.value.period.start} ~ ${model.value.period.end}${partial}`;
});
</script>

<template>
	<div class="min-h-screen bg-background">
		<Header title="Reports" back />

		<main class="px-4 pb-24">
			<EmptyState v-if="!user" title="Reports">
				<BarChart3 class="w-8 h-8" />
			</EmptyState>

			<template v-else>
				<p class="text-text-muted text-xs mb-4">
					Export weekly/monthly/yearly task data to feed an LLM alongside your Logseq journal
				</p>

				<PeriodSelector
					:scope="scope"
					:anchor="anchor"
					:custom-start="customStart"
					:custom-end="customEnd"
					@scope-change="(s) => (scope = s)"
					@anchor-change="(d) => (anchor = d)"
					@custom-range-change="handleCustomRangeChange"
				/>

				<LoadingState v-if="isLoading && !model" message="Generating report…" />

				<ErrorState
					v-else-if="error"
					:title="error"
					retry-label="Retry"
					@retry="refresh"
				/>

				<div v-else-if="model" class="space-y-6">
					<p class="text-text-secondary text-sm">
						<span class="text-text-muted mr-2">Range</span>
						{{ rangeText }}
					</p>

					<SummaryCards :model="model" />

					<section>
						<h2 class="text-text-primary font-bold mb-3">Trend</h2>
						<div class="rounded-xl bg-surface p-4 border border-border">
							<TrendChart :trend="model.trend" />
						</div>
					</section>

					<section>
						<h2 class="text-text-primary font-bold mb-3">Task breakdown</h2>
						<div class="rounded-xl bg-surface p-4 border border-border">
							<TemplateTable :templates="model.templates" />
						</div>
					</section>

					<section>
						<h2 class="text-text-primary font-bold mb-3">By level</h2>
						<div class="rounded-xl bg-surface p-4 border border-border">
							<LevelTable :levels="model.levels" />
						</div>
					</section>

					<section
						v-if="model.notes.length > 0"
						class="rounded-xl bg-surface-light p-4 border border-border"
					>
						<ul class="space-y-1">
							<li
								v-for="note in model.notes"
								:key="note.code"
								class="text-text-secondary text-xs"
							>
								· {{ noteText(note) }}
							</li>
						</ul>
					</section>

					<ExportActions
						:model="model"
						v-model:include-prompt="includePrompt"
					/>
				</div>
			</template>
		</main>
	</div>
</template>
