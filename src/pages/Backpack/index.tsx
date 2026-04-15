import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Sparkles, CheckCircle2, Minus, Plus, Package } from "lucide-react";
import { Header } from "@/components/Header";
import { Popup } from "@/components/Popup";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useUserStore } from "@/store";
import {
  useUserBackpack,
  useRewardInstanceActions,
} from "@/hooks/useRewards";
import { StatsCard } from "./components/StatsCard";
import { TabBar } from "./components/TabBar";
import { BackpackItemList } from "./components/BackpackItemList";
import { formatDate, getTimeLeft, getTabs, type GroupedReward, type TabKey } from "./lib";

export function Backpack() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { items, isLoading, refresh } = useUserBackpack(user?.id ?? 0);
  const {
    useRewardsBatch,
    checkExpired,
    isLoading: isActionLoading,
  } = useRewardInstanceActions();

  const [selectedGroup, setSelectedGroup] = useState<GroupedReward | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [useError, setUseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("available");
  const [useQuantity, setUseQuantity] = useState(1);

  // 定期检查过期状态
  useEffect(() => {
    if (!user?.id) return;

    const check = async () => {
      await checkExpired(user.id);
      await refresh();
    };

    check();
    const interval = setInterval(check, 60000); // 每分钟检查一次
    return () => clearInterval(interval);
  }, [user?.id, checkExpired, refresh]);

  // 过滤物品
  const filteredItems = items
    .filter(({ instance }) => instance.status === activeTab)
    .sort((a, b) => {
      // 已使用标签页按使用时间从新到旧排序
      if (activeTab === "used") {
        const timeA = a.instance.usedAt ? new Date(a.instance.usedAt).getTime() : 0;
        const timeB = b.instance.usedAt ? new Date(b.instance.usedAt).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });

  // 处理物品点击（现在接收 GroupedReward）
  const handleItemClick = (group: GroupedReward) => {
    setSelectedGroup(group);
    setUseQuantity(1); // 重置为1
    setUseError(null);
    setIsPopupOpen(true);
  };

  // 处理批量使用
  const handleUse = async () => {
    if (!selectedGroup) return;

    try {
      const instanceIds = selectedGroup.instances.map(i => i.id!);
      await useRewardsBatch(instanceIds, useQuantity);
      await refresh();
      setIsPopupOpen(false);
      setSelectedGroup(null);
      // 可以在这里添加成功提示
    } catch (err) {
      setUseError(err instanceof Error ? err.message : t("backpack.useFailed"));
    }
  };

  // 调整使用数量
  const decreaseQuantity = () => {
    setUseQuantity(prev => Math.max(1, prev - 1));
  };

  const increaseQuantity = () => {
    if (!selectedGroup) return;
    setUseQuantity(prev => Math.min(selectedGroup.count, prev + 1));
  };

  const tabs = getTabs(items);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <Header
        title="My Backpack"
        leftSlot={
          <button
            onClick={() => navigate(-1)}
            className="flex size-12 items-center justify-start text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />

      {/* Stats Card */}
      <StatsCard items={items} />

      {/* Tabs */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Items List */}
      <main className="p-4">
        <BackpackItemList
          items={filteredItems}
          isLoading={isLoading}
          activeTab={activeTab}
          onItemClick={handleItemClick}
        />
      </main>

      {/* Item Detail Popup */}
      <Popup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        position="bottom"
        title="Reward Details"
      >
        {selectedGroup && (
          <div className="space-y-6 py-2">
            {/* Icon & Title */}
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: `${selectedGroup.template.iconColor ?? "#f56565"}20`,
                }}
              >
                <DynamicIcon
                  name={selectedGroup.template.icon}
                  color={selectedGroup.template.iconColor ?? "#f56565"}
                  className="w-12 h-12"
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-text-primary">
                  {selectedGroup.template.title}
                </h3>
                {selectedGroup.template.description && (
                  <p className="text-text-secondary text-sm mt-1">
                    {selectedGroup.template.description}
                  </p>
                )}
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-lg font-bold">
                    {selectedGroup.template.pointsCost}
                  </span>
                </div>
                <p className="text-text-muted text-xs">{t("common.exp")}</p>
              </div>
              <div className="bg-surface rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-lg font-bold">{t("backpack.status.available")}</span>
                </div>
                <p className="text-text-muted text-xs">{t("backpack.detail.status")}</p>
              </div>
              <div className="bg-surface rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-lg font-bold">{selectedGroup.count}</span>
                </div>
                <p className="text-text-muted text-xs">{t("backpack.detail.owned")}</p>
              </div>
            </div>

            {/* Time Info */}
            <div className="bg-surface rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">{t("backpack.detail.firstRedeemed")}</span>
                <span className="text-text-primary text-sm">
                  {formatDate(selectedGroup.instances[0]?.createdAt)}
                </span>
              </div>
              {selectedGroup.instances[0]?.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">{t("backpack.detail.expireTime")}</span>
                  <span className="text-amber-400 text-sm">
                    {formatDate(selectedGroup.instances[0].expiresAt)}
                  </span>
                </div>
              )}
              {selectedGroup.instances[0]?.expiresAt && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-text-secondary text-sm">{t("backpack.detail.timeLeft")}</span>
                  <span className="text-amber-400 text-sm font-medium">
                    {(() => {
                      const result = getTimeLeft(selectedGroup.instances[0].expiresAt);
                      switch (result.type) {
                        case "expired": return t("backpack.timeLeft.expired");
                        case "daysLeft": return `${result.value} ${t("backpack.timeLeft.days")}`;
                        case "hoursLeft": return `${result.value} ${t("backpack.timeLeft.hours")}`;
                        case "aboutToExpire": return t("backpack.timeLeft.aboutToExpire");
                      }
                    })()}
                  </span>
                </div>
              )}
            </div>

            {/* Quantity Selector (only show if count > 1) */}
            {selectedGroup.count > 1 && (
              <div className="bg-surface rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-text-secondary text-sm">{t("backpack.detail.useQuantity")}</span>
                  <span className="text-text-primary text-sm font-medium">
                    {useQuantity} / {selectedGroup.count}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={decreaseQuantity}
                    disabled={useQuantity <= 1 || isActionLoading}
                    className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center text-text-primary hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="w-20 h-12 rounded-xl bg-background border border-border flex items-center justify-center">
                    <span className="text-xl font-bold text-text-primary">{useQuantity}</span>
                  </div>
                  <button
                    onClick={increaseQuantity}
                    disabled={useQuantity >= selectedGroup.count || isActionLoading}
                    className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center text-text-primary hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {useError && (
              <p className="text-primary text-sm text-center">{useError}</p>
            )}

            {/* Action Button */}
            <button
              onClick={handleUse}
              disabled={isActionLoading || selectedGroup.count === 0}
              className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActionLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : selectedGroup.count > 1 ? (
                `${t("backpack.use")} ${useQuantity} ${t("backpack.rewards")}`
              ) : (
                t("backpack.useReward")
              )}
            </button>
          </div>
        )}
      </Popup>
    </div>
  );
}