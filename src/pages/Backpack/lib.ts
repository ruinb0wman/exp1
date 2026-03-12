import type { RewardInstance, RewardTemplate } from "@/db/types";

export interface RewardWithTemplate {
  instance: RewardInstance;
  template: RewardTemplate;
}

export type TabKey = "available" | "used" | "expired";

export interface Tab {
  key: TabKey;
  label: string;
  count: number;
}

// 格式化日期
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 计算剩余时间
export function getTimeLeft(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return "已过期";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  if (days > 0) return `剩余 ${days} 天`;
  if (hours > 0) return `剩余 ${hours} 小时`;
  return "即将过期";
}

// 生成 tabs 配置
export function getTabs(
  items: RewardWithTemplate[]
): Tab[] {
  return [
    {
      key: "available",
      label: "可用",
      count: items.filter((i) => i.instance.status === "available").length,
    },
    {
      key: "used",
      label: "已使用",
      count: items.filter((i) => i.instance.status === "used").length,
    },
    {
      key: "expired",
      label: "已过期",
      count: items.filter((i) => i.instance.status === "expired").length,
    },
  ];
}
