import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Package, Plus, Pencil, History } from "lucide-react";
import { Header } from "@/components/Header";
import { Popup } from "@/components/Popup";
import { useUserStore } from "@/store";
import { useStoreRewards, useRewardInstanceActions } from "@/hooks/useRewards";
import { getTemplatesNeedingReplenishment, replenishRewardTemplate } from "@/db/services/rewardService";
import { PointsCard } from "./components/PointsCard";
import { SearchBar } from "./components/SearchBar";
import { RewardsGrid, type StoreReward } from "./components/RewardsGrid";
import { RewardDetailPopup } from "./components/RewardDetailPopup";
import { filterRewardsBySearch, getMaxQuantity } from "./lib";

export function Store() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, currentPoints, calculatePoints } = useUserStore();

  // 进入页面时重新计算积分
  useEffect(() => {
    calculatePoints();
  }, [calculatePoints]);

  const { rewards, isLoading, refresh } = useStoreRewards(user?.id ?? 0);

  // 防止补货并发执行的锁
  const isReplenishingRef = useRef(false);

  // 进入页面时检查并补货
  useEffect(() => {
    if (!user?.id) return;
    if (isReplenishingRef.current) return;

    const checkAndReplenish = async () => {
      isReplenishingRef.current = true;
      try {
        const templates = await getTemplatesNeedingReplenishment(
          user.id,
          user.dayEndTime ?? "00:00"
        );
        for (const { template, missedDays } of templates) {
          await replenishRewardTemplate(template.id!, missedDays);
        }
        if (templates.length > 0) {
          await refresh();
        }
      } catch (err) {
        console.error("Replenishment failed:", err);
      } finally {
        isReplenishingRef.current = false;
      }
    };

    checkAndReplenish();
  }, [user?.id, user?.dayEndTime, refresh]);
  const { redeem, isLoading: isActionLoading } = useRewardInstanceActions();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReward, setSelectedReward] = useState<StoreReward | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemQuantity, setRedeemQuantity] = useState(1);

  // 搜索过滤
  const filteredRewards = filterRewardsBySearch(rewards, searchQuery);

  // 处理奖励点击
  const handleRewardClick = (reward: StoreReward) => {
    setSelectedReward(reward);
    setRedeemError(null);
    setRedeemQuantity(1);
    setIsPopupOpen(true);
  };

  // 计算最大可兑换数量
  const maxQuantity = getMaxQuantity(selectedReward, currentPoints);

  // 处理兑换
  const handleRedeem = useCallback(async () => {
    if (!selectedReward || !user) return;

    const { template, availableCount } = selectedReward;
    const totalCost = template.pointsCost * redeemQuantity;

    // 检查库存
    if (template.replenishmentMode !== 'none' && availableCount < redeemQuantity) {
      setRedeemError(t("store.stockShortage"));
      return;
    }

    // 检查积分是否足够
    if (currentPoints < totalCost) {
      setRedeemError(t("store.pointsShortage"));
      return;
    }

    try {
      // 兑换奖励（带库存检查和积分检查）
      // 积分扣除由中间件自动处理
      await redeem(template.id!, user.id, template.validDuration, redeemQuantity);

      // 刷新商店列表
      await refresh();

      // 关闭 popup
      setIsPopupOpen(false);
      setSelectedReward(null);
      setRedeemQuantity(1);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : t("common.error"));
    }
  }, [selectedReward, user, redeem, refresh, currentPoints, redeemQuantity, t]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background">
        <Header
          title="Rewards Store"
          leftSlot={
            <button
              onClick={() => navigate("/backpack")}
              className="flex size-12 items-center justify-start text-text-secondary hover:text-primary transition-colors"
            >
              <Package className="w-5 h-5" />
            </button>
          }
          rightSlot={
            <button
              onClick={() => navigate("/rewards/new")}
              className="flex size-12 items-center justify-end text-text-secondary hover:text-primary transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          }
        />

        {/* Points Card */}
        <div className="p-4 pt-2">
          <PointsCard currentPoints={currentPoints} />
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search for rewards"
          />
        </div>
      </div>

      {/* Rewards Grid */}
      <main className="p-4">
        <RewardsGrid
          rewards={filteredRewards}
          isLoading={isLoading}
          onRewardClick={handleRewardClick}
        />
      </main>

      {/* Reward Detail Popup */}
      <Popup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        position="bottom"
        title="Reward Details"
        headerRight={
          selectedReward ? (
            <div className="flex items-center gap-3">
              {selectedReward.template.replenishmentMode !== "none" && (
                <button
                  onClick={() => {
                    setIsPopupOpen(false);
                    navigate(`/replenishment/${selectedReward.template.id}`);
                  }}
                  className="flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
                >
                  <History className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => {
                  setIsPopupOpen(false);
                  navigate(`/rewards/${selectedReward.template.id}`);
                }}
                className="flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
              >
                <Pencil className="w-5 h-5" />
              </button>
            </div>
          ) : null
        }
      >
        {selectedReward && (
          <RewardDetailPopup
            reward={selectedReward}
            redeemQuantity={redeemQuantity}
            onQuantityChange={setRedeemQuantity}
            maxQuantity={maxQuantity}
            currentPoints={currentPoints}
            isActionLoading={isActionLoading}
            redeemError={redeemError}
            onRedeem={handleRedeem}
          />
        )}
      </Popup>
    </div>
  );
}
