<script setup lang="ts">
import { Search } from "lucide-vue-next";

withDefaults(
	defineProps<{
		modelValue: string;
		placeholder?: string;
	}>(),
	{
		placeholder: "Search for rewards",
	},
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

function handleInput(event: Event) {
	emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
	<div class="flex items-center bg-surface rounded-xl px-4 h-12 border border-border">
		<Search class="w-5 h-5 text-text-muted" />
		<input
			type="text"
			:placeholder="placeholder"
			:value="modelValue"
			class="flex-1 bg-transparent ml-2 text-text-primary placeholder:text-text-muted focus:outline-none"
			@input="handleInput"
		/>
	</div>
</template>
