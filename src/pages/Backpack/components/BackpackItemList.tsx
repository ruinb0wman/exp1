import { Clock, CheckCircle2, ArrowLeft, Package } from "lucide-react";
import { DynamicIcon } from "@/components/DynamicIcon";
import { StatusBadge } from "./StatusBadge";
import { formatDate, getTimeLeft } from "../lib";
import type { RewardWithTemplate } from "../lib";

interface BackpackItemListProps {
  items: RewardWithTemplate[];
  isLoading: boolean;
  activeTab: "available" | "used" | "expired";
  onItemClick: (item: RewardWithTemplate) => void;
}

export function BackpackItemList({
  items,
  isLoading,
  activeTab,
  onItemClick,
}: BackpackItemListProps) {
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

  return (
    <div className="space-y-3">
      {items.map(({ instance, template }) => (
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
    </div>
  );
}
