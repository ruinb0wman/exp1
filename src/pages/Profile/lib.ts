import type { LucideIcon } from "lucide-react";
import { ChartPie, BarChart3, History, Coins, Trophy } from "lucide-react";

export interface QuickAction {
  icon: LucideIcon;
  label: string;
  path: string;
}

export const quickActions: QuickAction[] = [
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Trophy, label: "Achievements", path: "/achievements" },
  { icon: ChartPie, label: "Spending", path: "/consumption" },
  { icon: History, label: "Task History", path: "/task-history" },
  { icon: Coins, label: "Points History", path: "/points-history" },
];
