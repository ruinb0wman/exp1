import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
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
import { formatDate, getTimeLeft, getTabs, type RewardWithTemplate, type TabKey } from "./lib";

export function Backpack() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { items, isLoading, refresh } = useUserBackpack(user?.id ?? 0);
  const {
    useReward,
    checkExpired,
    isLoading: isActionLoading,
  } = useRewardInstanceActions();

  const [selectedItem, setSelectedItem] = useState<RewardWithTemplate | null>(
    null
  );
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [useError, setUseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("available");

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

  // 处理物品点击
  const handleItemClick = (item: RewardWithTemplate) => {
    if (item.instance.status !== "available") return;
    setSelectedItem(item);
    setUseError(null);
    setIsPopupOpen(true);
  };

  // 处理使用
  const handleUse = async () => {
    if (!selectedItem) return;

    try {
      await useReward(selectedItem.instance.id!);
      await refresh();
      setIsPopupOpen(false);
      setSelectedItem(null);
    } catch (err) {
      setUseError(err instanceof Error ? err.message : "使用失败");
    }
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
        {selectedItem && (
          <div className="space-y-6 py-2">
            {/* Icon & Title */}
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: `${selectedItem.template.iconColor ?? "#f56565"}20`,
                }}
              >
                <DynamicIcon
                  name={selectedItem.template.icon}
                  color={selectedItem.template.iconColor ?? "#f56565"}
                  className="w-12 h-12"
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-text-primary">
                  {selectedItem.template.title}
                </h3>
                {selectedItem.template.description && (
                  <p className="text-text-secondary text-sm mt-1">
                    {selectedItem.template.description}
                  </p>
                )}
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-primary mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-lg font-bold">
                    {selectedItem.template.pointsCost}
                  </span>
                </div>
                <p className="text-text-muted text-xs">兑换积分</p>
              </div>
              <div className="bg-surface rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-lg font-bold">可用</span>
                </div>
                <p className="text-text-muted text-xs">状态</p>
              </div>
            </div>

            {/* Time Info */}
            <div className="bg-surface rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">兑换时间</span>
                <span className="text-text-primary text-sm">
                  {formatDate(selectedItem.instance.createdAt)}
                </span>
              </div>
              {selectedItem.instance.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary text-sm">过期时间</span>
                  <span className="text-amber-400 text-sm">
                    {formatDate(selectedItem.instance.expiresAt)}
                  </span>
                </div>
              )}
              {selectedItem.instance.expiresAt && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-text-secondary text-sm">剩余时间</span>
                  <span className="text-amber-400 text-sm font-medium">
                    {getTimeLeft(selectedItem.instance.expiresAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {useError && (
              <p className="text-primary text-sm text-center">{useError}</p>
            )}

            {/* Action Button */}
            <button
              onClick={handleUse}
              disabled={isActionLoading}
              className="w-full h-14 bg-primary text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActionLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "使用奖励"
              )}
            </button>
          </div>
        )}
      </Popup>
    </div>
  );
}
