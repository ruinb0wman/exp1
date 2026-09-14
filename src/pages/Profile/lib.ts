import type { LucideIcon } from "lucide-react";
import { Backpack, BarChart3, History, Coins, Trophy } from "lucide-react";

export interface QuickAction {
  icon: LucideIcon;
  label: string;
  path: string;
}

export const quickActions: QuickAction[] = [
  { icon: BarChart3, label: "分析报告", path: "/reports" },
  { icon: Trophy, label: "Achievements", path: "/achievements" },
  { icon: Backpack, label: "My Backpack", path: "/backpack" },
  { icon: History, label: "Task History", path: "/task-history" },
  { icon: Coins, label: "Points History", path: "/points-history" },
];
