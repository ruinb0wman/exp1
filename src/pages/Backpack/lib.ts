import type { RewardInstance, RewardTemplate } from "@/db/types";

export interface RewardWithTemplate {
  instance: RewardInstance;
  template: RewardTemplate;
}

// 合并后的奖励类型（用于可用标签页的网格显示）
export interface GroupedReward {
  template: RewardTemplate;
  instances: RewardInstance[];
  count: number;
}

export type TabKey = "available" | "used" | "expired";

export interface Tab {
  key: TabKey;
  label: string; // translation key, e.g. "backpack.tabs.available"
  count: number;
}

export type TimeLeftResult =
  | { type: "expired" }
  | { type: "daysLeft"; value: number }
  | { type: "hoursLeft"; value: number }
  | { type: "aboutToExpire" };

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

// 计算剩余时间（返回结构化数据，由组件使用 t() 翻译）
export function getTimeLeft(expiresAt: string): TimeLeftResult {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return { type: "expired" };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  if (days > 0) return { type: "daysLeft", value: days };
  if (hours > 0) return { type: "hoursLeft", value: hours };
  return { type: "aboutToExpire" };
}

// 生成 tabs 配置（label 为翻译 key）
export function getTabs(
  items: RewardWithTemplate[]
): Tab[] {
  return [
    {
      key: "available",
      label: "backpack.tabs.available",
      count: items.filter((i) => i.instance.status === "available").length,
    },
    {
      key: "used",
      label: "backpack.tabs.used",
      count: items.filter((i) => i.instance.status === "used").length,
    },
    {
      key: "expired",
      label: "backpack.tabs.expired",
      count: items.filter((i) => i.instance.status === "expired").length,
    },
  ];
}

// 按模板和实例特征合并奖励（用于可用标签页的网格显示）
export function groupRewardsByTemplate(
  items: RewardWithTemplate[]
): GroupedReward[] {
  const groups = new Map<string, GroupedReward>();

  for (const { instance, template } of items) {
    if (instance.status !== "available") continue;

    // 创建复合键：模板ID + 实例特征（createdAt + expiresAt）
    // 使用 instance.template.id 作为模板ID（快照中的模板ID）
    const templateId = instance.template?.id ?? template.id;
    const key = `${templateId}-${instance.createdAt}-${instance.expiresAt ?? 'null'}`;

    if (!groups.has(key)) {
      groups.set(key, {
        template,
        instances: [],
        count: 0,
      });
    }

    const group = groups.get(key)!;
    group.instances.push(instance);
    group.count++;
  }

  // 对每个分组内的实例按创建时间排序（FIFO）
  for (const group of groups.values()) {
    group.instances.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  return Array.from(groups.values());
}
