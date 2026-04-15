import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { Sparkles, Clock } from "lucide-react";
import { NumberInput } from "@/components/NumberInput";
import { DynamicIcon } from "@/components/DynamicIcon";
import { formatDuration, formatDurationToString } from "@/libs/time";
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
  const { t } = useTranslation();
  const { template, availableCount } = reward;
  const totalCost = template.pointsCost * redeemQuantity;
  const canRedeem = 
    !isActionLoading && 
    currentPoints >= totalCost &&
    (template.replenishmentMode === 'none' || availableCount >= redeemQuantity);

  const durationResult = formatDuration(template.validDuration);
  const durationText = durationResult.type === "permanent" 
    ? t("store.forever") 
    : formatDurationToString(durationResult);

  return (
    <div className="space-y-6 py-2">
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

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-primary mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-lg font-bold">{template.pointsCost}</span>
          </div>
          <p className="text-text-muted text-xs">{i18n.language === 'zh' ? `需要 ${t("common.exp")} 积分` : `Costs ${t("common.exp")} exp`}</p>
        </div>
        <div className="bg-surface rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-lg font-bold">
              {durationText}
            </span>
          </div>
          <p className="text-text-muted text-xs">{t("store.validDuration")}</p>
        </div>
      </div>

      {template.replenishmentMode !== 'none' && (
        <div className="bg-surface rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">{t("store.currentStock")}</span>
            <span className="text-text-primary font-medium">
              {availableCount} {t("common.items")}
            </span>
          </div>
          {template.replenishmentLimit !== undefined && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-text-secondary text-sm">{t("store.stockLimit")}</span>
              <span className="text-text-primary font-medium">
                {template.replenishmentLimit} {t("common.items")}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="bg-surface rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-secondary text-sm">{t("store.redeemQuantity")}</span>
          <NumberInput
            value={redeemQuantity}
            onChange={onQuantityChange}
            min={1}
            max={maxQuantity}
            size="md"
          />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-text-secondary text-sm">{t("store.total")}</span>
          <span className="text-primary font-bold text-lg">
            {totalCost.toLocaleString()} {t("common.exp")}
          </span>
        </div>
      </div>

      {redeemError && (
        <p className="text-primary text-sm text-center">{redeemError}</p>
      )}

      <button
        onClick={onRedeem}
        disabled={!canRedeem}
        className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isActionLoading ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : template.replenishmentMode !== 'none' && availableCount < redeemQuantity ? (
          t("store.stockShortage")
        ) : currentPoints < totalCost ? (
          t("store.pointsShortage")
        ) : (
          i18n.language === 'zh' ? `兑换 ${redeemQuantity} 个` : `Redeem ${redeemQuantity}`
        )}
      </button>
    </div>
  );
}
