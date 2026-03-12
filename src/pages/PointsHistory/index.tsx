import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { useUserStore } from "@/store";
import { usePointsHistory } from "@/hooks/usePointsHistory";
import { formatRelativeDate } from "@/libs/time";
import type { PointsHistory } from "@/db/types";
import { filterTabs, getTypeIcon, getTypeLabel, getRelatedEntityName } from "./lib";
import { DateRangePicker } from "./components/DateRangePicker";

// 历史记录项组件
function HistoryItem({ item }: { item: PointsHistory }) {
  const [entityName, setEntityName] = useState<string | null>(null);
  const Icon = getTypeIcon(item.type);
  const isPositive = item.amount > 0;

  useEffect(() => {
    let mounted = true;
    getRelatedEntityName(item).then((name) => {
      if (mounted) {
        setEntityName(name);
      }
    });
    return () => {
      mounted = false;
    };
  }, [item]);

  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
      <div
        className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
          isPositive ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary"
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-text-primary font-medium">
          {getTypeLabel(item.type)}
        </p>
        {entityName && (
          <p className="text-text-secondary text-sm truncate">
            {entityName}
          </p>
        )}
        <p className="text-text-muted text-xs">
          {formatRelativeDate(item.createdAt)}
        </p>
      </div>
      <p
        className={`font-bold text-lg ${
          isPositive ? "text-green-500" : "text-primary"
        }`}
      >
        {isPositive ? "+" : ""}
        {item.amount}
      </p>
    </div>
  );
}

export function PointsHistory() {
  const { user } = useUserStore();

  const {
    list,
    stats,
    hasMore,
    total,
    isLoading,
    isLoadingMore,
    error,
    filterType,
    startDate,
    endDate,
    loadMore,
    setFilterType,
    setDateRange,
  } = usePointsHistory({
    userId: user?.id ?? null,
    pageSize: 20,
  });

  return (
    <div className="min-h-screen-safe pt-safe bg-background">
      {/* Header */}
      <Header title="积分明细" back />

      {/* Stats Summary */}
      <div className="px-4 py-3">
        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-text-secondary text-xs mb-1">收入</p>
              <p className="text-green-500 text-xl font-bold">
                {isLoading ? "-" : stats?.income ?? 0}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-1">支出</p>
              <p className="text-primary text-xl font-bold">
                {isLoading ? "-" : stats?.expense ?? 0}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-1">结余</p>
              <p className="text-text-primary text-xl font-bold">
                {isLoading ? "-" : stats?.balance ?? 0}
              </p>
            </div>
          </div>
          {stats && (
            <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>任务奖励:</span>
                <span className="text-green-500">+{stats.taskReward}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>撤销扣除:</span>
                <span className="text-primary">-{stats.taskUndo}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>兑换消费:</span>
                <span className="text-primary">-{stats.rewardExchange}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>系统调整:</span>
                <span className={stats.adminAdjustment >= 0 ? "text-green-500" : "text-primary"}>
                  {stats.adminAdjustment >= 0 ? "+" : ""}
                  {stats.adminAdjustment}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-4 py-2 flex items-center justify-between sticky top-[60px] bg-background z-10">
        {/* Filter Tabs */}
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterType === tab.key
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Range Picker */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={setDateRange}
        />
      </div>

      {/* Total Count */}
      <div className="px-4 py-2 text-text-muted text-sm">
        共 {total} 条记录
      </div>

      {/* History List */}
      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-text-secondary">
            <p>{error}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <p>暂无记录</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}

            {/* Load More */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="mt-4 py-3 rounded-xl bg-surface border border-border text-text-primary font-medium hover:bg-surface-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    加载中...
                  </span>
                ) : (
                  "加载更多"
                )}
              </button>
            )}

            {!hasMore && list.length > 0 && (
              <p className="text-center text-text-muted text-sm py-4">
                没有更多记录了
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
