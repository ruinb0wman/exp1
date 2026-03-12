import { Sparkles, Clock } from "lucide-react";
import { NumberInput } from "@/components/NumberInput";
import { DynamicIcon } from "@/components/DynamicIcon";
import { formatDuration } from "@/libs/time";
import type { StoreReward } from "./RewardsGrid";

interface RewardDetailPopupProps {
  reward: StoreReward;
  redeemQuantity: number;
  onQuantityChange: (quantity: number) => void;
  maxQuantity: number;
  currentPoints: number;
  isActionLoading: boolean;
  redeemError: string | null;
  onRedeem: () => void;
}

export function RewardDetailPopup({
  reward,
  redeemQuantity,
  onQuantityChange,
  maxQuantity,
  currentPoints,
  isActionLoading,
  redeemError,
  onRedeem,
}: RewardDetailPopupProps) {
  const { template, availableCount } = reward;
  const totalCost = template.pointsCost * redeemQuantity;
  const canRedeem = 
    !isActionLoading && 
    currentPoints >= totalCost &&
    (template.replenishmentMode === 'none' || availableCount >= redeemQuantity);

  return (
    <div className="space-y-6 py-2">
      {/* Icon & Title */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${template.iconColor ?? '#f56565'}20` }}
        >
          <DynamicIcon
            name={template.icon}
            color={template.iconColor ?? '#f56565'}
            className="w-12 h-12"
          />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-text-primary">
            {template.title}
          </h3>
          {template.description && (
            <p className="text-text-secondary text-sm mt-1">
              {template.description}
            </p>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-primary mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-lg font-bold">{template.pointsCost}</span>
          </div>
          <p className="text-text-muted text-xs">需要积分</p>
        </div>
        <div className="bg-surface rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-lg font-bold">
              {formatDuration(template.validDuration)}
            </span>
          </div>
          <p className="text-text-muted text-xs">有效期</p>
        </div>
      </div>

      {/* Stock Info */}
      {template.replenishmentMode !== 'none' && (
        <div className="bg-surface rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">当前库存</span>
            <span className="text-text-primary font-medium">
              {availableCount} 个
            </span>
          </div>
          {template.replenishmentLimit !== undefined && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-text-secondary text-sm">库存上限</span>
              <span className="text-text-primary font-medium">
                {template.replenishmentLimit} 个
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quantity Selector */}
      <div className="bg-surface rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-secondary text-sm">兑换数量</span>
          <NumberInput
            value={redeemQuantity}
            onChange={onQuantityChange}
            min={1}
            max={maxQuantity}
            size="md"
          />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-text-secondary text-sm">总计</span>
          <span className="text-primary font-bold text-lg">
            {totalCost.toLocaleString()} PTS
          </span>
        </div>
      </div>

      {/* Error Message */}
      {redeemError && (
        <p className="text-primary text-sm text-center">{redeemError}</p>
      )}

      {/* Action Button */}
      <button
        onClick={onRedeem}
        disabled={!canRedeem}
        className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isActionLoading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : template.replenishmentMode !== 'none' && availableCount < redeemQuantity ? (
          "库存不足"
        ) : currentPoints < totalCost ? (
          "积分不足"
        ) : (
          `兑换 ${redeemQuantity} 个`
        )}
      </button>
    </div>
  );
}
