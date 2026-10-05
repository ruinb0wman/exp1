<script setup lang="ts">
import { computed } from "vue";
import Popup from "@/components/Popup.vue";
import { CheckCircle2, Circle } from "lucide-vue-next";
import type { TaskWithTemplate } from "@/composables/useTasks";

const props = defineProps<{
	isOpen: boolean;
	tasks: TaskWithTemplate[];
	selectedTaskId: string | null;
}>();

const emit = defineEmits<{
	close: [];
	selectTask: [taskId: string | null];
}>();

function handleSelectTask(taskId: string | null) {
	emit("selectTask", taskId);
	emit("close");
}

// 只显示状态为 pending 且 completeRule 为 time 的任务
const pendingTasks = computed(() =>
	props.tasks.filter(
		(t) =>
			t.instance.status === "pending" &&
			t.template.completeRule?.type === "time",
	),
);
</script>

<template>
	<Popup
		:is-open="isOpen"
		position="bottom"
		title="Select Focus Task"
		@close="emit('close')"
	>
		<div class="space-y-2 max-h-80 overflow-y-auto">
			<!-- 自由专注选项 -->
			<button
				:class="`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${
					selectedTaskId === null ? 'bg-primary/10' : 'hover:bg-surface-light'
				}`"
				@click="handleSelectTask(null)"
			>
				<Circle
					:class="`w-5 h-5 ${selectedTaskId === null ? 'text-primary' : 'text-text-muted'}`"
				/>
				<span
					:class="selectedTaskId === null ? 'text-primary font-medium' : 'text-text-primary'"
				>
					Free Focus
				</span>
			</button>

			<!-- 待办任务列表 -->
			<button
				v-for="{ instance, template } in pendingTasks"
				:key="instance.id"
				:class="`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${
					selectedTaskId === instance.id ? 'bg-primary/10' : 'hover:bg-surface-light'
				}`"
				@click="handleSelectTask(instance.id!)"
			>
				<CheckCircle2 v-if="selectedTaskId === instance.id" class="w-5 h-5 text-primary" />
				<Circle v-else class="w-5 h-5 text-text-muted" />
				<span
					:class="
						selectedTaskId === instance.id
							? 'text-primary font-medium'
							: 'text-text-primary'
					"
				>
					{{ template.title }}
				</span>
			</button>

			<!-- 空状态 -->
			<p v-if="pendingTasks.length === 0" class="text-center text-text-muted py-4">
				No pending tasks for today
			</p>
		</div>
	</Popup>
</template>
