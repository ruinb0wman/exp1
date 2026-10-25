<script setup lang="ts">
import { computed, ref } from "vue";
import { CheckCircle2, FileJson, FileText, Loader2 } from "@lucide/vue";
import { fileSystem } from "@/libs/fileSystem";
import { generateReportFilename, renderReportJson } from "@/db/services";
import { renderReportMarkdown } from "@/libs/report/renderMarkdown";
import type { ReportModel } from "@/libs/report/types";

const props = defineProps<{
	model: ReportModel;
	includePrompt: boolean;
}>();

const emit = defineEmits<{ "update:includePrompt": [value: boolean] }>();

type ExportStatus = "idle" | "success" | "cancelled" | "failed";

const exporting = ref<"md" | "json" | null>(null);
const status = ref<ExportStatus>("idle");

async function handleExport(format: "md" | "json") {
	exporting.value = format;
	status.value = "idle";
	try {
		const content =
			format === "md"
				? renderReportMarkdown(props.model, { includePrompt: props.includePrompt })
				: renderReportJson(props.model);

		const saved = await fileSystem.saveFile({
			content,
			filename: generateReportFilename(props.model, format),
			mimeType: format === "md" ? "text/markdown" : "application/json",
			extensions: [format],
		});

		status.value = saved ? "success" : "cancelled";
	} catch (error) {
		console.error("[Reports] export failed:", error);
		status.value = "failed";
	} finally {
		exporting.value = null;
	}
}

const statusText = computed(() => {
	switch (status.value) {
		case "success":
			return { text: "Report saved", className: "text-emerald-400" };
		case "cancelled":
			return { text: "Save cancelled", className: "text-text-muted" };
		case "failed":
			return { text: "Failed to save", className: "text-primary" };
		default:
			return null;
	}
});

function handleCheckbox(event: Event) {
	emit("update:includePrompt", (event.target as HTMLInputElement).checked);
}
</script>

<template>
	<div class="rounded-xl bg-surface p-4 border border-border">
		<label class="flex items-center gap-3 mb-4 cursor-pointer select-none">
			<input
				type="checkbox"
				:checked="includePrompt"
				class="custom-checkbox"
				@change="handleCheckbox"
			/>
			<span class="text-text-secondary text-sm">Append analysis prompt</span>
		</label>

		<div class="flex gap-3">
			<button
				:disabled="exporting !== null"
				class="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-white py-3 font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
				@click="handleExport('md')"
			>
				<Loader2 v-if="exporting === 'md'" class="w-4 h-4 animate-spin" />
				<FileText v-else class="w-4 h-4" />
				Export Markdown
			</button>
			<button
				:disabled="exporting !== null"
				class="flex-1 flex items-center justify-center gap-2 rounded-lg bg-surface-light text-text-primary py-3 font-medium hover:bg-border transition-colors disabled:opacity-50"
				@click="handleExport('json')"
			>
				<Loader2 v-if="exporting === 'json'" class="w-4 h-4 animate-spin" />
				<FileJson v-else class="w-4 h-4" />
				Export JSON
			</button>
		</div>

		<p v-if="exporting !== null" class="text-text-muted text-xs mt-3 text-center">
			Exporting…
		</p>

		<p
			v-if="statusText && exporting === null"
			:class="`text-xs mt-3 flex items-center justify-center gap-1 ${statusText.className}`"
		>
			<CheckCircle2 v-if="status === 'success'" class="w-3.5 h-3.5" />
			{{ statusText.text }}
		</p>
	</div>
</template>
