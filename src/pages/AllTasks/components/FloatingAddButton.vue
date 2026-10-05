<script setup lang="ts">
import { Plus } from "lucide-vue-next";

const emit = defineEmits<{ click: [] }>();
</script>

<template>
	<button
		class="fixed bottom-24 right-4 flex items-center justify-center w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-light transition-colors z-40"
		@click="emit('click')"
	>
		<Plus class="w-7 h-7" />
	</button>
</template>
