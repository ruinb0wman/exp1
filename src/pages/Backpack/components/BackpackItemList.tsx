import { useState, useEffect } from "react";
import { Clock, CheckCircle2, ArrowLeft, Package, ChevronDown } from "lucide-react";
import { DynamicIcon } from "@/components/DynamicIcon";
import { StatusBadge } from "./StatusBadge";
import { formatDate, getTimeLeft, groupRewardsByTemplate } from "../lib";
import type { RewardWithTemplate, GroupedReward } from "../lib";

interface BackpackItemListProps {
  items: RewardWithTemplate[];
  isLoading: boolean;
  activeTab: "available" | "used" | "expired";
  onItemClick: (item: RewardWithTemplate) => void;
}

const PAGE_SIZE = 20;

export function BackpackItemList({
  items,
  isLoading,
  activeTab,
  onItemClick,
}: BackpackItemListProps) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // 当标签页或数据变化时重置显示数量
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [activeTab, items.length]);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <Package className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">
          {activeTab === "available" && "暂无可用奖励"}
          {activeTab === "used" && "暂无已使用奖励"}
          {activeTab === "expired" && "暂无过期奖励"}
        </p>
        <p className="text-sm mt-1">
          {activeTab === "available" && "去商店兑换奖励吧！"}
        </p>
      </div>
    );
  }

  // 可用标签页使用网格布局（合并相同模板）
  if (activeTab === "available") {
    const groupedItems = groupRewardsByTemplate(items);

    const handleGroupedItemClick = (grouped: GroupedReward) => {
      // 使用第一个可用实例
      const instance = grouped.instances[0];
      onItemClick({ instance, template: grouped.template });
    };

    return (
      <div className="grid grid-cols-5 gap-2">
        {groupedItems.map((grouped) => (
          <button
            key={`${grouped.template.id}-${grouped.instances[0]?.createdAt}`}
            onClick={() => handleGroupedItemClick(grouped)}
            className="relative flex flex-col items-center p-2 rounded-xl bg-surface border border-border hover:bg-surface-light active:scale-[0.98] transition-all"
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mb-2"
              style={{
                backgroundColor: `${grouped.template.iconColor ?? "#f56565"}20`,
              }}
            >
              <DynamicIcon
                name={grouped.template.icon}
                color={grouped.template.iconColor ?? "#f56565"}
                className="w-6 h-6"
              />
            </div>

            {/* Title */}
            <p className="text-text-primary text-xs font-medium text-center line-clamp-2 leading-tight">
              {grouped.template.title}
            </p>

            {/* Count Badge */}
            {grouped.count > 1 && (
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                {grouped.count}
              </div>
            )}
          </button>
        ))}
      </div>
    );
  }

  // 已使用和已过期标签页保持原有列表样式
  const displayItems = items.slice(0, displayCount);
  const hasMore = items.length > displayCount;
  const remainingCount = items.length - displayCount;

  return (
    <div className="space-y-3">
      {displayItems.map(({ instance, template }) => (
        <button
          key={instance.id}
          onClick={() => onItemClick({ instance, template })}
          disabled={instance.status !== "available"}
          className={`w-full flex items-center gap-4 p-4 rounded-xl bg-surface border border-border text-left transition-colors ${
            instance.status === "available"
              ? "hover:bg-surface-light active:scale-[0.99]"
              : "opacity-70"
          }`}
        >
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${template.iconColor ?? "#f56565"}20` }}
          >
            <DynamicIcon
              name={template.icon}
              color={template.iconColor ?? "#f56565"}
              className="w-7 h-7"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-text-primary font-medium truncate">
                {template.title}
              </h4>
              <StatusBadge status={instance.status} />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-text-muted text-xs">
              {instance.expiresAt && instance.status === "available" ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <Clock className="w-3 h-3" />
                  {getTimeLeft(instance.expiresAt)}
                </span>
              ) : instance.expiresAt ? (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  过期于 {formatDate(instance.expiresAt)}
                </span>
              ) : null}
              {instance.usedAt && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  使用于 {formatDate(instance.usedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          {instance.status === "available" && (
            <ArrowLeft className="w-5 h-5 text-text-muted -rotate-180" />
          )}
        </button>
      ))}

      {/* Load More Button */}
      {hasMore && (
        <button
          onClick={() => setDisplayCount(prev => prev + PAGE_SIZE)}
          className="w-full py-3 flex items-center justify-center gap-2 text-text-secondary hover:text-primary transition-colors border border-dashed border-border rounded-xl hover:border-primary/50"
        >
          <ChevronDown className="w-4 h-4" />
          <span className="text-sm">
            加载更多 ({remainingCount} 个)
          </span>
        </button>
      )}
    </div>
  );
}
