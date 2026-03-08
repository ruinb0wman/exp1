import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, Circle, XCircle, Play, AlertCircle, Flag } from "lucide-react";
import { Header } from "@/components/Header";
import { TaskDetailPopup } from "@/components/TaskDetailPopup";
import { useUserStore } from "@/store";
import { useTaskHistory, type TaskHistoryFilterStatus } from "@/hooks/useTaskHistory";
import { useTaskInstanceActions } from "@/hooks/useTasks";
import type { TaskHistoryItem } from "@/db/services";

const filterTabs: { key: TaskHistoryFilterStatus; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待完成" },
  { key: "completed", label: "已完成" },
  { key: "skipped", label: "已跳过" },
];

// 获取状态图标
function getStatusIcon(status: TaskHistoryItem["instance"]["status"]) {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "skipped":
      return XCircle;
    default:
      return Circle;
  }
}

// 获取状态样式
function getStatusStyle(status: TaskHistoryItem["instance"]["status"]) {
  switch (status) {
    case "completed":
      return { color: "text-green-500", bg: "bg-green-500/20" };
    case "skipped":
      return { color: "text-text-muted", bg: "bg-text-muted/20" };
    default:
      return { color: "text-primary", bg: "bg-primary/20" };
  }
}

// 获取状态标签
function getStatusLabel(status: TaskHistoryItem["instance"]["status"]) {
  switch (status) {
    case "completed":
      return "已完成";
    case "skipped":
      return "已跳过";
    default:
      return "待完成";
  }
}

// 格式化日期时间
function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

  if (diffDays === 0) {
    return `今天 ${timeStr}`;
  } else if (diffDays === 1) {
    return `昨天 ${timeStr}`;
  } else if (diffDays < 7) {
    return `${diffDays}天前 ${timeStr}`;
  } else {
    return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
  }
}

// 格式化日期（仅日期部分，用于显示）
function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "今天";
  } else if (diffDays === 1) {
    return "昨天";
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

// 按日期分组任务
function groupTasksByDate(tasks: TaskHistoryItem[]): Map<string, TaskHistoryItem[]> {
  const groups = new Map<string, TaskHistoryItem[]>();

  tasks.forEach((task) => {
    const dateKey = formatDateGroup(task.instance.createdAt);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(task);
  });

  return groups;
}

// 格式化日期（仅日期部分，用于分组）
function formatDateGroup(dateStr: string | undefined): string {
  if (!dateStr) return "无日期";
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "今天";
  } else if (diffDays === 1) {
    return "昨天";
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
  }
}

export function TaskHistory() {
  const { user } = useUserStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadingTriggerRef = useRef<HTMLDivElement>(null);

  const {
    list,
    stats,
    hasMore,
    total,
    isLoading,
    isLoadingMore,
    error,
    filterStatus,
    loadMore,
    refresh,
    setFilterStatus,
  } = useTaskHistory({
    userId: user?.id ?? null,
    pageSize: 20,
  });

  const { complete, reset } = useTaskInstanceActions();
  const [selectedTask, setSelectedTask] = useState<TaskHistoryItem | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const taskGroups = groupTasksByDate(list);

  // 滚动加载逻辑
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMore || isLoadingMore) return;

    const container = scrollContainerRef.current;
    const scrollBottom = container.scrollTop + container.clientHeight;
    const threshold = container.scrollHeight - 100; // 距离底部100px时触发加载

    if (scrollBottom >= threshold) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // 添加滚动监听
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // 处理任务点击
  const handleTaskClick = (item: TaskHistoryItem) => {
    setSelectedTask(item);
    setIsPopupOpen(true);
  };

  // 关闭弹窗
  const handleClosePopup = () => {
    setIsPopupOpen(false);
    // 延迟清空选中任务，让关闭动画完成
    setTimeout(() => setSelectedTask(null), 300);
  };

  // 处理任务操作（完成/重置）
  const handleTaskAction = async (
    action: "complete" | "reset",
    instanceId: number,
    rewardPoints: number
  ) => {
    setIsActionLoading(true);
    try {
      if (action === "complete") {
        await complete(instanceId);
        await useUserStore.getState().addPoints(rewardPoints, "task_reward", instanceId);
      } else {
        await reset(instanceId);
        await useUserStore.getState().spendPoints(rewardPoints, "task_reward", instanceId);
      }
      // 刷新列表
      await refresh();
      // 关闭弹窗
      handleClosePopup();
    } catch (error) {
      console.error("Failed to perform action:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // 将 TaskHistoryItem 转换为 TaskInstance 和 TaskTemplate
  const selectedInstance = selectedTask?.instance ?? null;
  const selectedTemplate = selectedTask?.template ?? null;

  return (
    <div className="min-h-screen-safe pt-safe bg-background flex flex-col">
      {/* Header */}
      <Header title="任务历史" back />

      {/* Stats Summary */}
      <div className="px-4 py-3 shrink-0">
        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-text-secondary text-xs mb-1">全部</p>
              <p className="text-text-primary text-lg font-bold">
                {isLoading ? "-" : stats?.total ?? 0}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-1">待完成</p>
              <p className="text-primary text-lg font-bold">
                {isLoading ? "-" : stats?.pending ?? 0}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-1">已完成</p>
              <p className="text-green-500 text-lg font-bold">
                {isLoading ? "-" : stats?.completed ?? 0}
              </p>
            </div>
            <div>
              <p className="text-text-secondary text-xs mb-1">已跳过</p>
              <p className="text-text-muted text-lg font-bold">
                {isLoading ? "-" : stats?.skipped ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-4 py-2 flex items-center justify-between sticky top-[60px] bg-background z-10 shrink-0">
        {/* Filter Tabs */}
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filterStatus === tab.key
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Total Count */}
        <span className="text-text-muted text-sm">
          共 {total} 条
        </span>
      </div>

      {/* Task List - Scrollable */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 pb-8"
      >
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
          <div className="flex flex-col gap-4">
            {Array.from(taskGroups.entries()).map(([dateGroup, tasks]) => (
              <div key={dateGroup} className="flex flex-col gap-2">
                {/* Date Group Header */}
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-text-muted text-sm font-medium">{dateGroup}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Tasks in this group */}
                <div className="flex flex-col gap-2">
                  {tasks.map((item) => {
                    const ItemStatusIcon = getStatusIcon(item.instance.status);
                    const itemStatusStyle = getStatusStyle(item.instance.status);

                    return (
                      <button
                        key={item.instance.id}
                        onClick={() => handleTaskClick(item)}
                        className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border text-left hover:bg-surface-light transition-colors"
                      >
                        {/* Status Icon */}
                        <div
                          className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${itemStatusStyle.bg} ${itemStatusStyle.color}`}
                        >
                          <ItemStatusIcon className="w-5 h-5" />
                        </div>

                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary font-medium truncate">
                            {item.template.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary text-xs mt-1">
                            {/* 开始时间 */}
                            {item.instance.startAt && (
                              <span className="flex items-center gap-1">
                                <Play className="w-3 h-3 text-primary" />
                                {formatDateTime(item.instance.startAt)}
                              </span>
                            )}
                            {/* 到期时间 */}
                            {item.instance.expiredAt && (
                              <span className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-orange-500" />
                                截止 {formatShortDate(item.instance.expiredAt)}
                              </span>
                            )}
                            {/* 完成时间 */}
                            {item.instance.completedAt && (
                              <span className="flex items-center gap-1">
                                <Flag className="w-3 h-3 text-green-500" />
                                完成 {formatDateTime(item.instance.completedAt)}
                              </span>
                            )}
                            {/* 积分 */}
                            {item.instance.rewardPoints > 0 && (
                              <span className="text-green-500">+{item.instance.rewardPoints}积分</span>
                            )}
                          </div>
                        </div>

                        {/* Status Label */}
                        <span className={`text-sm font-medium ${itemStatusStyle.color}`}>
                          {getStatusLabel(item.instance.status)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Loading More Indicator */}
            <div ref={loadingTriggerRef} className="py-4">
              {isLoadingMore ? (
                <div className="flex items-center justify-center gap-2 text-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">加载中...</span>
                </div>
              ) : hasMore ? (
                <div className="h-4" /> // 占位，用于触发滚动加载
              ) : list.length > 0 ? (
                <p className="text-center text-text-muted text-sm">
                  没有更多记录了
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* 任务详情 Popup */}
      <TaskDetailPopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        instance={selectedInstance}
        template={selectedTemplate}
        onComplete={() => {
          if (selectedInstance) {
            handleTaskAction("complete", selectedInstance.id!, selectedInstance.rewardPoints);
          }
        }}
        onReset={() => {
          if (selectedInstance) {
            handleTaskAction("reset", selectedInstance.id!, selectedInstance.rewardPoints);
          }
        }}
        isLoading={isActionLoading}
      />
    </div>
  );
}
