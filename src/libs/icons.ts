/**
 * 全项目唯一的图标登记点。
 *
 * 为什么要手写这张表：@ruinb0w/ui 的 RLucideIcon 只认注册表，不认命名空间导入
 * （`import * as icons` 摇不掉，会把约 1500 个图标 / 1MB 打进产物，手机上还要走网络下载）。
 * 所以库按名字取组件，这里按名字显式登记。
 *
 * 加图标 = 加名字 + 这里加 import 和键。漏登记不会白屏：显示英文图标名 + 控制台 warn。
 * 库内组件自用的 19 个（AlertTriangle Bell BellRing Calendar Check ChevronDown ChevronLeft
 * ChevronRight ChevronsLeft ChevronsRight Clock Eye EyeOff Info Loader Plus Search WifiOff X）
 * 已内置，不用在这里重复。
 */
import { registerIcons } from "@ruinb0w/ui";
import type { Component } from "vue";
import {
	Award,
	Beer,
	Bike,
	BookOpen,
	CakeSlice,
	CalendarCheck,
	Car,
	ChartColumn,
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
	Store,
	Swords,
	Target,
	Ticket,
	Timer,
	TrendingUp,
	Trophy,
	Tv,
	User,
	Wifi,
	Zap,
} from "@lucide/vue";

/** 名字必须与 @lucide/vue 的导出名一致（REWARD_ICONS / ACHIEVEMENT_ICONS / tab / 成就预设都用这名字） */
export const ICONS: Record<string, Component> = {
	Award,
	Beer,
	Bike,
	BookOpen,
	CakeSlice,
	CalendarCheck,
	Car,
	ChartColumn,
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
	Store,
	Swords,
	Target,
	Ticket,
	Timer,
	TrendingUp,
	Trophy,
	Tv,
	User,
	Wifi,
	Zap,
};

registerIcons(ICONS);

/** 按名字查本项目的图标组件（未登记返回 undefined） */
export const iconFor = (name: string): Component | undefined => ICONS[name];
