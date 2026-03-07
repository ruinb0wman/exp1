import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Package, Clock, CheckCircle2, AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Popup } from "@/components/Popup";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useUserStore } from "@/store";
import { useUserBackpack, useRewardInstanceActions } from "@/hooks/useRewards";
import type { RewardInstance, RewardTemplate } from "@/db/types";

interface RewardWithTemplate {
  instance: RewardInstance;
  template: RewardTemplate;
}

export function Backpack() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { items, isLoading, refresh } = useUserBackpack(user?.id ?? 0);
  const { useReward, checkExpired, isLoading: isActionLoading } = useRewardInstanceActions();

  const [selectedItem, setSelectedItem] = useState<RewardWithTemplate | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [useError, setUseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available');

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
  const filteredItems = items.filter(({ instance }) => instance.status === activeTab);

  // 处理物品点击
  const handleItemClick = (item: RewardWithTemplate) => {
    if (item.instance.status !== 'available') return;
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

  // 格式化日期
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 计算剩余时间
  const getTimeLeft = (expiresAt: string): string => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return "已过期";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `剩余 ${days} 天`;
    if (hours > 0) return `剩余 ${hours} 小时`;
    return "即将过期";
  };

  // 获取状态标签
  const getStatusBadge = (status: RewardInstance['status']) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            可用
          </span>
        );
      case 'used':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            已使用
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3 h-3" />
            已过期
          </span>
        );
    }
  };

  // Tab 按钮
  const tabs = [
    { key: 'available', label: '可用', count: items.filter(i => i.instance.status === 'available').length },
    { key: 'used', label: '已使用', count: items.filter(i => i.instance.status === 'used').length },
    { key: 'expired', label: '已过期', count: items.filter(i => i.instance.status === 'expired').length },
  ] as const;

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
      <div className="px-4 pb-4">
        <div className="rounded-xl bg-surface p-4 border border-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
              <Package className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-text-secondary text-sm">背包物品总数</p>
              <p className="text-text-primary text-2xl font-bold">{items.length}</p>
            </div>
            <div className="text-right">
              <p className="text-green-400 text-sm font-medium">
                {items.filter(i => i.instance.status === 'available').length} 可用
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <div className="flex gap-2 p-1 bg-surface rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-white/80' : 'text-text-muted'}`}>
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <main className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <Package className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {activeTab === 'available' && "暂无可用奖励"}
              {activeTab === 'used' && "暂无已使用奖励"}
              {activeTab === 'expired' && "暂无过期奖励"}
            </p>
            <p className="text-sm mt-1">
              {activeTab === 'available' && "去商店兑换奖励吧！"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(({ instance, template }) => (
              <button
                key={instance.id}
                onClick={() => handleItemClick({ instance, template })}
                disabled={instance.status !== 'available'}
                className={`w-full flex items-center gap-4 p-4 rounded-xl bg-surface border border-border text-left transition-colors ${
                  instance.status === 'available' ? 'hover:bg-surface-light active:scale-[0.99]' : 'opacity-70'
                }`}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${template.iconColor ?? '#f56565'}20` }}
                >
                  <DynamicIcon
                    name={template.icon}
                    color={template.iconColor ?? '#f56565'}
                    className="w-7 h-7"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-text-primary font-medium truncate">
                      {template.title}
                    </h4>
                    {getStatusBadge(instance.status)}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-text-muted text-xs">
                    {instance.expiresAt && instance.status === 'available' ? (
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
                {instance.status === 'available' && (
                  <ArrowLeft className="w-5 h-5 text-text-muted -rotate-180" />
                )}
              </button>
            ))}
          </div>
        )}
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
                style={{ backgroundColor: `${selectedItem.template.iconColor ?? '#f56565'}20` }}
              >
                <DynamicIcon
                  name={selectedItem.template.icon}
                  color={selectedItem.template.iconColor ?? '#f56565'}
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
                  <span className="text-lg font-bold">{selectedItem.template.pointsCost}</span>
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
