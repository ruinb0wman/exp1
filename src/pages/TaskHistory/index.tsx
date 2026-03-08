import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { TaskDetailPopup } from "@/components/TaskDetailPopup";
import { useUserStore } from "@/store";
import { useTaskHistory } from "@/hooks/useTaskHistory";
import { useTaskInstanceActions } from "@/hooks/useTasks";
import type { TaskHistoryItem } from "@/db/services";
import { groupTasksByDate } from "./lib";
import {
  StatsSummary,
  TaskGroup,
  FilterBar,
  LoadingMore,
} from "./components";

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
      <StatsSummary stats={stats} isLoading={isLoading} />

      {/* Filter Bar */}
      <FilterBar
        filterStatus={filterStatus}
        total={total}
        onFilterChange={setFilterStatus}
      />

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
              <TaskGroup
                key={dateGroup}
                dateGroup={dateGroup}
                tasks={tasks}
                onTaskClick={handleTaskClick}
              />
            ))}

            {/* Loading More Indicator */}
            <div ref={loadingTriggerRef} className="py-4">
              <LoadingMore
                isLoadingMore={isLoadingMore}
                hasMore={hasMore}
                listLength={list.length}
              />
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
