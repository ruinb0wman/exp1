<script setup lang="ts">
import { computed } from "vue";
import {
	Award,
	Beer,
	Bike,
	BookOpen,
	CakeSlice,
	CalendarCheck,
	Car,
	Cigarette,
	Coffee,
	Compass,
	Cookie,
	Crown,
	Dumbbell,
	Film,
	Flame,
	Gamepad2,
	Gem,
	Gift,
	GraduationCap,
	Heart,
	House,
	IceCream,
	Lightbulb,
	Medal,
	Mountain,
	Music,
	Package,
	PawPrint,
	Pizza,
	Plane,
	Rocket,
	Shield,
	ShoppingBag,
	ShoppingCart,
	SoapDispenserDroplet,
	Sparkles,
	Star,
	Swords,
	Target,
	Ticket,
	Timer,
	TrendingUp,
	Trophy,
	Tv,
	Wifi,
	Zap,
} from "lucide-vue-next";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
	name: string;
	color?: string;
}>();

/** 奖励图标 ∪ 成就图标的合并注册表 */
const iconMap: Record<string, unknown> = {
	Gift,
	Coffee,
	Beer,
	Cigarette,
	Gamepad2,
	ShoppingBag,
	BookOpen,
	Dumbbell,
	Pizza,
	IceCream,
	Cookie,
	CakeSlice,
	Film,
	Music,
	Ticket,
	Tv,
	ShoppingCart,
	Package,
	Bike,
	Plane,
	Mountain,
	GraduationCap,
	Lightbulb,
	Heart,
	Star,
	Zap,
	Trophy,
	Crown,
	Medal,
	Flame,
	Target,
	Rocket,
	Award,
	Shield,
	Swords,
	Gem,
	Compass,
	Timer,
	CalendarCheck,
	TrendingUp,
	Sparkles,
	PawPrint,
	Wifi,
	SoapDispenserDroplet,
	Car,
	House,
};

const iconComponent = computed(() => iconMap[props.name] ?? Trophy);
</script>

<template>
	<component :is="iconComponent" v-bind="$attrs" :color="color" />
</template>
