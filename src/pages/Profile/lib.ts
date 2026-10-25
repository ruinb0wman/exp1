import type { Component } from "vue";
import { BarChart3, ChartPie, Coins, History, Trophy } from "@lucide/vue";

export interface QuickAction {
  icon: Component;
  label: string;
  path: string;
  badge?: number;
}

export const quickActions: QuickAction[] = [
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Trophy, label: "Achievements", path: "/achievements" },
  { icon: ChartPie, label: "Spending", path: "/consumption" },
  { icon: History, label: "Task History", path: "/task-history" },
  { icon: Coins, label: "Points History", path: "/points-history" },
];
