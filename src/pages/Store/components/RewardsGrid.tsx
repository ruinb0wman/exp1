import { Package, Sparkles } from "lucide-react";
import { DynamicIcon } from "@/components/DynamicIcon";
import { EmptyState } from "@/components/EmptyState";
import type { RewardTemplate } from "@/db/types";

export interface StoreReward {
  template: RewardTemplate;
  availableCount: number;
}

interface RewardsGridProps {
  rewards: StoreReward[];
  isLoading: boolean;
  onRewardClick: (reward: StoreReward) => void;
}

export function RewardsGrid({ rewards, isLoading, onRewardClick }: RewardsGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (rewards.length === 0) {
    return (
      <EmptyState
        icon={<Package className="w-8 h-8" />}
        title="暂无奖励"
        description="点击右上角 + 创建新奖励"
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {rewards.map(({ template, availableCount }) => (
        <button
          key={template.id}
          onClick={() => onRewardClick({ template, availableCount })}
          className="flex flex-col gap-2 text-left group"
        >
          <div
            className="w-full aspect-square rounded-xl flex items-center justify-center transition-transform group-active:scale-95"
            style={{ backgroundColor: `${template.iconColor ?? '#f56565'}20` }}
          >
            <DynamicIcon
              name={template.icon}
              color={template.iconColor ?? '#f56565'}
              className="w-16 h-16"
            />
          </div>
          <div>
            <p className="text-text-primary text-base font-medium truncate">
              {template.title}
            </p>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <p className="text-text-secondary text-sm">
                {template.pointsCost} PTS
              </p>
            </div>
            {template.replenishmentMode !== 'none' && availableCount > 0 && (
              <p className="text-text-muted text-xs mt-0.5">
                库存: {availableCount}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
