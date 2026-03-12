import type { LucideIcon } from "lucide-react";
import { Backpack, History, Coins } from "lucide-react";

export interface QuickAction {
  icon: LucideIcon;
  label: string;
  path: string;
}

export const quickActions: QuickAction[] = [
  { icon: Backpack, label: "My Backpack", path: "/backpack" },
  { icon: History, label: "Task History", path: "/task-history" },
  { icon: Coins, label: "Points History", path: "/points-history" },
];
