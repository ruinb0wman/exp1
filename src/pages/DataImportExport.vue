<script setup lang="ts">
import { ref } from "vue";
import {
	AlertTriangle,
	CheckCircle,
	Download,
	FileJson,
	Loader2,
} from "@lucide/vue";
import Header from "@/components/Header.vue";
import { BaseModal } from "@ruinb0w/ui";
import { fileSystem } from "@/libs/fileSystem";
import { toPlain } from "@/libs/plain";
import { useAlert } from "@ruinb0w/ui";
import { useUserStore } from "@/store/userStore";
import {
	exportAllData,
	generateExportFilename,
	validateImportData,
	importData,
	type ExportData,
	type ImportPreview,
	type ImportResult,
} from "@/db/services";

const userStore = useUserStore();

const isExporting = ref(false);
const exportSuccess = ref(false);

const isImporting = ref(false);
const importPreview = ref<ImportPreview | null>(null);
const pendingImportData = ref<ExportData | null>(null);
const showStrategyDialog = ref(false);
const importResult = ref<ImportResult | null>(null);
const showResultDialog = ref(false);

// 不用原生 alert()：Android WebView 会静默丢弃、Electron 里会阻塞渲染进程
const alertDialog = useAlert();

async function handleExport() {
	try {
		isExporting.value = true;
		exportSuccess.value = false;

		const exportData = await exportAllData();
		const jsonContent = JSON.stringify(exportData, null, 2);

		const success = await fileSystem.saveFile({
			content: jsonContent,
			filename: generateExportFilename(),
			mimeType: "application/json",
		});

		if (success) {
			exportSuccess.value = true;
			setTimeout(() => {
				exportSuccess.value = false;
			}, 3000);
		}
	} catch (error) {
		console.error("Export failed:", error);
		await alertDialog({
			title: "Export Failed",
			message: error instanceof Error ? error.message : "Error",
			confirmLabel: "OK",
		});
	} finally {
		isExporting.value = false;
	}
}

async function handleFileSelect() {
	try {
		isImporting.value = true;

		const file = await fileSystem.selectFile({
			accept: ".json",
			multiple: false,
		});

		if (file) {
			const data = JSON.parse(file.content) as ExportData;

			const preview = validateImportData(data);
			importPreview.value = preview;

			if (preview.isValid) {
				pendingImportData.value = data;
				showStrategyDialog.value = true;
			} else {
				showResultDialog.value = true;
			}
		}
	} catch (error) {
		console.error("Import failed:", error);
		importPreview.value = {
			isValid: false,
			error: error instanceof Error ? error.message : "Error",
		};
		showResultDialog.value = true;
	} finally {
		isImporting.value = false;
	}
}

async function executeImport() {
	if (!pendingImportData.value) return;

	showStrategyDialog.value = false;
	isImporting.value = true;

	try {
		const result = await importData(toPlain(pendingImportData.value));
		importResult.value = result;
		showResultDialog.value = true;

		if (result.success && result.userId) {
			await userStore.refreshUser();
		}
	} catch (error) {
		importResult.value = {
			success: false,
			message: `Import failed: ${error instanceof Error ? error.message : "Error"}`,
		};
		showResultDialog.value = true;
	} finally {
		isImporting.value = false;
		pendingImportData.value = null;
	}
}

function closeStrategyDialog() {
	showStrategyDialog.value = false;
	pendingImportData.value = null;
}

function closeResultDialog() {
	showResultDialog.value = false;
	importResult.value = null;
	importPreview.value = null;
}
</script>

<template>
	<div class="bg-background">
		<Header title="Import & Export" back />

		<div class="p-4">
			<div class="rounded-xl bg-surface p-5 border border-border mb-4">
				<div class="flex items-start gap-4">
					<div class="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
						<Download class="w-6 h-6 text-green-500" />
					</div>
					<div class="flex-1">
						<h2 class="text-text-primary font-bold text-lg mb-1">Export Data</h2>
						<p class="text-text-secondary text-sm mb-4">
							Export all your tasks, rewards, and points history as a JSON file for backup or use on another device.
						</p>
						<button
							:disabled="isExporting"
							class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							@click="handleExport"
						>
							<Loader2 v-if="isExporting" class="w-4 h-4 animate-spin" />
							<CheckCircle v-else-if="exportSuccess" class="w-4 h-4" />
							<FileJson v-else class="w-4 h-4" />
							{{ isExporting ? "Exporting..." : exportSuccess ? "Export successful" : "Export to File" }}
						</button>
					</div>
				</div>
			</div>

			<div class="rounded-xl bg-surface p-5 border border-border">
				<div class="flex items-start gap-4">
					<div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
						<Download class="w-6 h-6 text-blue-500 rotate-180" />
					</div>
					<div class="flex-1">
						<h2 class="text-text-primary font-bold text-lg mb-1">Import Data</h2>
						<p class="text-text-secondary text-sm mb-4">
							Restore data from a backup file. You can choose to overwrite existing data.
						</p>
						<button
							:disabled="isImporting"
							class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							@click="handleFileSelect"
						>
							<Loader2 v-if="isImporting" class="w-4 h-4 animate-spin" />
							<FileJson v-else class="w-4 h-4" />
							{{ isImporting ? "Reading..." : "Select File" }}
						</button>
					</div>
				</div>
			</div>

			<div class="mt-6 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
				<div class="flex gap-3">
					<AlertTriangle class="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
					<div>
						<h3 class="text-yellow-500 font-medium text-sm mb-1">Important Notes</h3>
						<ul class="text-text-secondary text-sm space-y-1">
							<li>• The exported file contains all your data. Keep it safe.</li>
							<li>• Export your current data as a backup before importing.</li>
							<li>• Full overwrite will delete all existing data. Proceed with caution.</li>
						</ul>
					</div>
				</div>
			</div>
		</div>

		<BaseModal
			:visible="showStrategyDialog"
			direction="center"
			width="92%"
			height="auto"
			title="Choose Import Method"
			@close="closeStrategyDialog"
		>
			<div class="p-4">
				<div v-if="importPreview?.stats" class="mb-4 p-3 rounded-lg bg-surface-light">
					<p class="text-text-secondary text-sm mb-2">File contents:</p>
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div class="text-text-secondary">
							Task Templates:
							<span class="text-text-primary">{{ importPreview.stats.taskTemplates }}</span>
						</div>
						<div class="text-text-secondary">
							Task Instances:
							<span class="text-text-primary">{{ importPreview.stats.taskInstances }}</span>
						</div>
						<div class="text-text-secondary">
							Reward Templates:
							<span class="text-text-primary">{{ importPreview.stats.rewardTemplates }}</span>
						</div>
						<div class="text-text-secondary">
							Purchases:
							<span class="text-text-primary">{{ importPreview.stats.rewardPurchases }}</span>
						</div>
						<div class="text-text-secondary">
							User Data:
							<span class="text-text-primary">{{ importPreview.stats.users }}</span>
						</div>
						<div class="text-text-secondary">
							Points History:
							<span class="text-text-primary">{{ importPreview.stats.pointsHistory }}</span>
						</div>
						<div class="text-text-secondary">
							Achievements:
							<span class="text-text-primary">{{ importPreview.stats.achievements }}</span>
						</div>
					</div>
				</div>

				<p class="text-text-secondary text-sm mb-4">
					Importing will overwrite all existing data. Please confirm before proceeding.
				</p>

				<div class="flex flex-col gap-3">
					<button
						class="flex flex-col items-start p-4 rounded-xl bg-surface border border-border hover:border-primary transition-colors text-left"
						@click="executeImport"
					>
						<span class="text-text-primary font-medium mb-1">Confirm Import</span>
						<span class="text-text-secondary text-sm">
							Delete all existing data and use backup file data
						</span>
					</button>
				</div>
			</div>
		</BaseModal>

		<BaseModal
			:visible="showResultDialog"
			direction="center"
			width="92%"
			height="auto"
			:title="importResult?.success ? 'Import Successful' : 'Import Failed'"
			@close="closeResultDialog"
		>
			<div class="p-4">
				<div v-if="importPreview && !importPreview.isValid" class="flex flex-col items-center text-center">
					<div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
						<AlertTriangle class="w-8 h-8 text-red-500" />
					</div>
					<p class="text-text-secondary">{{ importPreview.error }}</p>
				</div>

				<div v-else-if="importResult" class="flex flex-col items-center text-center">
					<div
						:class="`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
							importResult.success ? 'bg-green-500/10' : 'bg-red-500/10'
						}`"
					>
						<CheckCircle v-if="importResult.success" class="w-8 h-8 text-green-500" />
						<AlertTriangle v-else class="w-8 h-8 text-red-500" />
					</div>
					<p class="text-text-primary font-medium mb-2">{{ importResult.message }}</p>
					<div v-if="importResult.stats" class="w-full mt-4 p-3 rounded-lg bg-surface-light text-left">
						<p class="text-text-secondary text-sm mb-2">Import Stats:</p>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div class="text-text-secondary">
								Task Templates:
								<span class="text-text-primary">{{ importResult.stats.taskTemplates }}</span>
							</div>
							<div class="text-text-secondary">
								Task Instances:
								<span class="text-text-primary">{{ importResult.stats.taskInstances }}</span>
							</div>
							<div class="text-text-secondary">
								Reward Templates:
								<span class="text-text-primary">{{ importResult.stats.rewardTemplates }}</span>
							</div>
							<div class="text-text-secondary">
								Purchases:
								<span class="text-text-primary">{{ importResult.stats.rewardPurchases }}</span>
							</div>
							<div class="text-text-secondary">
								User Data:
								<span class="text-text-primary">{{ importResult.stats.users }}</span>
							</div>
							<div class="text-text-secondary">
								Points History:
								<span class="text-text-primary">{{ importResult.stats.pointsHistory }}</span>
							</div>
							<div class="text-text-secondary">
								Achievements:
								<span class="text-text-primary">{{ importResult.stats.achievements }}</span>
							</div>
						</div>
					</div>
				</div>

				<button
					class="w-full mt-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
					@click="closeResultDialog"
				>
					Confirm
				</button>
			</div>
		</BaseModal>
	</div>
</template>
