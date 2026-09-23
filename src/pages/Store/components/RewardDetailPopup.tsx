import { useTranslation } from "react-i18next";
import { Sparkles, Banknote } from "lucide-react";
import { NumberInput } from "@/components/NumberInput";
import { DynamicIcon } from "@/components/DynamicIcon";
import { formatMoney, isCountedInConsumption, MAX_PURCHASE_NOTE_LENGTH } from "@/libs/reward";
import type { StoreReward } from "./RewardsGrid";
import { getPurchaseMoney } from "../lib";

interface RewardDetailPopupProps {
  reward: StoreReward;
  redeemQuantity: number;
  onQuantityChange: (quantity: number) => void;
  note: string;
  onNoteChange: (note: string) => void;
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
  note,
  onNoteChange,
  maxQuantity,
  currentPoints,
  isActionLoading,
  redeemError,
  onRedeem,
}: RewardDetailPopupProps) {
  const { t } = useTranslation();
  const { template, availableCount } = reward;
  const totalCost = template.pointsCost * redeemQuantity;
  const purchaseMoney = getPurchaseMoney(template, redeemQuantity);
  // 关闭「计入消费统计」的奖品不折合金额，也不计入消费统计
  const counted = isCountedInConsumption(template.countInConsumption);
  const canRedeem =
    !isActionLoading &&
    currentPoints >= totalCost &&
    (template.replenishmentMode === 'none' || availableCount >= redeemQuantity);

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

      <div className={`grid gap-3 ${counted ? "grid-cols-2" : "grid-cols-1"}`}>
        <div className="bg-surface rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-primary mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-lg font-bold">{template.pointsCost}</span>
          </div>
          <p className="text-text-muted text-xs">{t("common.exp")}</p>
        </div>
        {counted && (
          <div className="bg-surface rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
              <Banknote className="w-4 h-4" />
              <span className="text-lg font-bold">{formatMoney(purchaseMoney)}</span>
            </div>
            <p className="text-text-muted text-xs">{t("store.moneyValue")}</p>
          </div>
        )}
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
          <span className="text-text-secondary text-sm">{t("store.purchaseQuantity")}</span>
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
            {counted && (
              <span className="text-text-secondary font-normal text-sm ml-2">
                ≈ {formatMoney(purchaseMoney)}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="bg-surface rounded-xl p-4">
        <div className="flex items-center justify-between pb-2">
          <span className="text-text-secondary text-sm">{t("store.noteLabel")}</span>
          <span className="text-text-muted text-xs">
            {note.length}/{MAX_PURCHASE_NOTE_LENGTH}
          </span>
        </div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={MAX_PURCHASE_NOTE_LENGTH}
          rows={2}
          placeholder={t("store.notePlaceholder")}
          className="w-full min-w-0 resize-none rounded-lg text-text-primary placeholder:text-text-muted bg-surface-light p-3 text-base font-normal leading-normal focus:outline-none focus:ring-2 focus:ring-primary"
        />
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
          t("store.buyCount", { count: redeemQuantity })
        )}
      </button>
    </div>
  );
}
