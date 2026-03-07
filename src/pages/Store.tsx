import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Search, Star, Plus, Sparkles, Package, Clock } from "lucide-react";
import { Header } from "@/components/Header";
import { Popup } from "@/components/Popup";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useUserStore } from "@/store";
import { useStoreRewards, useRewardInstanceActions } from "@/hooks/useRewards";
import type { RewardTemplate } from "@/db/types";

interface StoreReward {
  template: RewardTemplate;
  availableCount: number;
}

export function Store() {
  const navigate = useNavigate();
  const { user, currentPoints, initUser } = useUserStore();
  const { rewards, isLoading, refresh } = useStoreRewards(user?.id ?? 0);
  const { redeem, isLoading: isActionLoading } = useRewardInstanceActions();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReward, setSelectedReward] = useState<StoreReward | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // 初始化用户
  useEffect(() => {
    if (!user) {
      initUser();
    }
  }, [user, initUser]);

  // 搜索过滤
  const filteredRewards = rewards.filter(({ template }) =>
    template.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 处理奖励点击
  const handleRewardClick = (reward: StoreReward) => {
    setSelectedReward(reward);
    setRedeemError(null);
    setIsPopupOpen(true);
  };

  // 处理兑换
  const handleRedeem = useCallback(async () => {
    if (!selectedReward || !user) return;

    const { template } = selectedReward;

    // 检查积分是否足够
    if (currentPoints < template.pointsCost) {
      setRedeemError("积分不足");
      return;
    }

    try {
      // 创建奖励实例
      await redeem(template.id!, user.id, template.validDuration);
      
      // 扣除积分
      await useUserStore.getState().spendPoints(template.pointsCost, "reward_exchange", template.id);
      
      // 刷新商店列表
      await refresh();
      
      // 关闭 popup
      setIsPopupOpen(false);
      setSelectedReward(null);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "兑换失败");
    }
  }, [selectedReward, user, redeem, refresh]);

  // 格式化有效期显示
  const formatDuration = (seconds: number): string => {
    if (seconds <= 0) return "永久有效";
    const days = Math.floor(seconds / 86400);
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} 个月`;
    }
    return `${days} 天`;
  };

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
          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4 border border-border">
            <div className="flex flex-col gap-1">
              <p className="text-text-secondary text-sm font-bold">
                Your Points
              </p>
              <p className="text-text-primary text-2xl font-bold">
                {currentPoints.toLocaleString()} PTS
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center">
              <Star className="w-8 h-8 fill-current" />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="flex items-center bg-surface rounded-xl px-4 h-12 border border-border">
            <Search className="w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search for rewards"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent ml-2 text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Rewards Grid */}
      <main className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <Package className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">暂无奖励</p>
            <p className="text-sm mt-1">点击右上角 + 创建新奖励</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredRewards.map(({ template, availableCount }) => (
              <button
                key={template.id}
                onClick={() => handleRewardClick({ template, availableCount })}
                className="flex flex-col gap-2 text-left group"
              >
                {/* Icon Card */}
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
                  {availableCount > 0 && (
                    <p className="text-text-muted text-xs mt-0.5">
                      库存: {availableCount}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Reward Detail Popup */}
      <Popup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        position="bottom"
        title="Reward Details"
      >
        {selectedReward && (
          <div className="space-y-6 py-2">
            {/* Icon & Title */}
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${selectedReward.template.iconColor ?? '#f56565'}20` }}
              >
                <DynamicIcon
                  name={selectedReward.template.icon}
                  color={selectedReward.template.iconColor ?? '#f56565'}
                  className="w-12 h-12"
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-text-primary">
                  {selectedReward.template.title}
                </h3>
                {selectedReward.template.description && (
                  <p className="text-text-secondary text-sm mt-1">
                    {selectedReward.template.description}
                  </p>
                )}
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-lg font-bold">{selectedReward.template.pointsCost}</span>
                </div>
                <p className="text-text-muted text-xs">需要积分</p>
              </div>
              <div className="bg-surface rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-lg font-bold">
                    {formatDuration(selectedReward.template.validDuration)}
                  </span>
                </div>
                <p className="text-text-muted text-xs">有效期</p>
              </div>
            </div>

            {/* Stock Info */}
            {selectedReward.template.replenishmentMode !== 'none' && (
              <div className="bg-surface rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">当前库存</span>
                  <span className="text-text-primary font-medium">
                    {selectedReward.availableCount} 个
                  </span>
                </div>
                {selectedReward.template.replenishmentLimit !== undefined && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-text-secondary text-sm">库存上限</span>
                    <span className="text-text-primary font-medium">
                      {selectedReward.template.replenishmentLimit} 个
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {redeemError && (
              <p className="text-primary text-sm text-center">{redeemError}</p>
            )}

            {/* Action Button */}
            <button
              onClick={handleRedeem}
              disabled={isActionLoading || currentPoints < selectedReward.template.pointsCost}
              className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActionLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : currentPoints < selectedReward.template.pointsCost ? (
                "积分不足"
              ) : (
                `兑换 - ${selectedReward.template.pointsCost} PTS`
              )}
            </button>
          </div>
        )}
      </Popup>
    </div>
  );
}
