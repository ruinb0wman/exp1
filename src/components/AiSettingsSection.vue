<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Bot, CheckCircle2, KeyRound, Loader2, Plug } from "lucide-vue-next";
import {
	getLlmSettings,
	setLlmSettings,
	testLlmConnection,
} from "@/services/llmService";

type TestState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ok"; message: string }
	| { status: "error"; message: string };

/**
 * 设置页「AI 成就」分组
 * API Key 由 Rust 侧持久化，前端不保存、不导出
 */
const baseUrl = ref("");
const model = ref("");
const apiKey = ref("");
const hasApiKey = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);
const saveMessage = ref<string | null>(null);
const testState = ref<TestState>({ status: "idle" });

async function load() {
	isLoading.value = true;
	try {
		const settings = await getLlmSettings();
		baseUrl.value = settings.baseUrl;
		model.value = settings.model;
		hasApiKey.value = settings.hasApiKey;
	} catch (error) {
		saveMessage.value = error instanceof Error ? error.message : "Error";
	} finally {
		isLoading.value = false;
	}
}

onMounted(() => void load());

async function handleSave(clearApiKey = false) {
	isSaving.value = true;
	saveMessage.value = null;
	testState.value = { status: "idle" };
	try {
		await setLlmSettings({
			baseUrl: baseUrl.value,
			model: model.value,
			apiKey: clearApiKey ? undefined : apiKey.value,
			clearApiKey,
		});
		apiKey.value = "";
		await load();
		saveMessage.value = "Saved";
	} catch (error) {
		saveMessage.value = error instanceof Error ? error.message : "Error";
	} finally {
		isSaving.value = false;
	}
}

async function handleTest() {
	testState.value = { status: "loading" };
	try {
		const result = await testLlmConnection();
		testState.value = {
			status: "ok",
			message: result.model ? `Connected · ${result.model}` : "Connected",
		};
	} catch (error) {
		testState.value = {
			status: "error",
			message: error instanceof Error ? error.message : "Error",
		};
	}
}
</script>

<template>
	<div class="mb-6">
		<h2 class="text-text-secondary text-sm font-medium px-2 mb-3">
			AI Achievements
		</h2>

		<div class="rounded-xl bg-surface border border-border p-4">
			<div class="flex items-center gap-4 mb-4">
				<div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
					<Bot class="w-5 h-5 text-primary" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-text-primary font-medium">AI Achievements</p>
					<p class="text-text-secondary text-sm">
						Configure an OpenAI-compatible API to generate personalized achievements
					</p>
				</div>
			</div>

			<label class="block text-text-secondary text-xs mb-1.5">Base URL</label>
			<input
				v-model="baseUrl"
				placeholder="https://api.openai.com/v1"
				:disabled="isLoading || isSaving"
				class="w-full rounded-lg bg-surface-light border border-border px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary mb-3 disabled:opacity-50"
			/>

			<label class="block text-text-secondary text-xs mb-1.5">Model</label>
			<input
				v-model="model"
				placeholder="gpt-4o-mini"
				:disabled="isLoading || isSaving"
				class="w-full rounded-lg bg-surface-light border border-border px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary mb-3 disabled:opacity-50"
			/>

			<label class="block text-text-secondary text-xs mb-1.5">API Key</label>
			<div class="relative mb-3">
				<KeyRound class="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
				<input
					v-model="apiKey"
					type="password"
					:placeholder="hasApiKey ? 'Saved (••••)' : 'sk-...'"
					:disabled="isLoading || isSaving"
					class="w-full rounded-lg bg-surface-light border border-border pl-9 pr-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary disabled:opacity-50"
				/>
			</div>

			<div class="flex gap-2">
				<button
					:disabled="isLoading || isSaving"
					class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
					@click="handleSave(false)"
				>
					<Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
					Save
				</button>
				<button
					:disabled="isLoading || isSaving || testState.status === 'loading'"
					class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-light border border-border text-text-primary text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
					@click="handleTest"
				>
					<Loader2 v-if="testState.status === 'loading'" class="w-4 h-4 animate-spin" />
					<Plug v-else class="w-4 h-4" />
					Test Connection
				</button>
			</div>

			<button
				v-if="hasApiKey"
				:disabled="isLoading || isSaving"
				class="w-full mt-2 py-2 rounded-lg text-text-secondary text-xs hover:text-primary transition-colors disabled:opacity-50"
				@click="handleSave(true)"
			>
				Clear API Key
			</button>

			<p v-if="saveMessage" class="text-text-secondary text-xs mt-3">{{ saveMessage }}</p>

			<p
				v-if="testState.status === 'ok'"
				class="flex items-center gap-1.5 text-green-500 text-xs mt-3"
			>
				<CheckCircle2 class="w-3.5 h-3.5" />
				{{ testState.message }}
			</p>
			<p v-if="testState.status === 'error'" class="text-primary text-xs mt-3">
				{{ testState.message }}
			</p>
		</div>
	</div>
</template>
