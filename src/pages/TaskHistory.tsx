import { useState } from "react";
import { ChevronDown, Loader2, CheckCircle2, Circle, XCircle, Calendar, RotateCcw, Trophy, ListTodo, Clock, Tag } from "lucide-react";
import { Header } from "@/components/Header";
import { Popup } from "@/components/Popup";
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

// 格式化日期
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "无日期";
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
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
  }
}

// 格式化日期（详细格式）
function formatDateDetail(dateStr: string | undefined): string {
  if (!dateStr) return "无日期";
  const date = new Date(dateStr);
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
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

// 日期选择器组件
function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    onChange(start.toISOString(), end.toISOString());
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary text-sm hover:bg-surface-light transition-colors"
      >
        <Calendar className="w-4 h-4" />
        <span>
          {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-48 rounded-xl bg-surface border border-border shadow-lg z-50 py-1">
            {[
              { label: "最近7天", days: 7 },
              { label: "最近30天", days: 30 },
              { label: "最近90天", days: 90 },
            ].map((item) => (
              <button
                key={item.days}
                onClick={() => handleQuickSelect(item.days)}
                className="w-full px-4 py-2 text-left text-text-primary hover:bg-surface-light transition-colors text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 按日期分组任务
function groupTasksByDate(tasks: TaskHistoryItem[]): Map<string, TaskHistoryItem[]> {
  const groups = new Map<string, TaskHistoryItem[]>();

  tasks.forEach((task) => {
    const dateKey = formatDateGroup(task.instance.startAt);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(task);
  });

  return groups;
}

export function TaskHistory() {
  const { user } = useUserStore();

  const {
    list,
    stats,
    hasMore,
    total,
    isLoading,
    isLoadingMore,
    error,
    filterStatus,
    startDate,
    endDate,
    loadMore,
    refresh,
    setFilterStatus,
    setDateRange,
  } = useTaskHistory({
    userId: user?.id ?? null,
    pageSize: 20,
  });

  const { complete, reset } = useTaskInstanceActions();
  const [selectedTask, setSelectedTask] = useState<TaskHistoryItem | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const taskGroups = groupTasksByDate(list);

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

  // 获取选中的任务信息
  const instance = selectedTask?.instance;
  const template = selectedTask?.template;
  const StatusIcon = instance ? getStatusIcon(instance.status) : Circle;
  const statusStyle = instance ? getStatusStyle(instance.status) : { color: "text-primary", bg: "bg-primary/20" };

  return (
    <div className="min-h-screen-safe pt-safe bg-background">
      {/* Header */}
      <Header title="任务历史" back />

      {/* Stats Summary */}
      <div className="px-4 py-3">
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
      <div className="px-4 py-2 flex items-center justify-between sticky top-[60px] bg-background z-10">
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

      {/* Task List */}
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
                          <div className="flex items-center gap-2 text-text-secondary text-sm">
                            <span>{formatDate(item.instance.startAt)}</span>
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

      {/* Task Detail Popup - 按照 Store.tsx 模式 */}
      <Popup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        position="bottom"
        title="任务详情"
        maskClosable={true}
      >
        {selectedTask && instance && template && (
          <div className="flex flex-col gap-4">
            {/* 状态图标和标题 */}
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${statusStyle.bg} ${statusStyle.color}`}
              >
                <StatusIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-text-primary leading-tight">
                  {template.title}
                </h3>
                <span className={`inline-block mt-1 text-sm font-medium ${statusStyle.color}`}>
                  {getStatusLabel(instance.status)}
                </span>
              </div>
            </div>

            {/* 任务信息 */}
            <div className="space-y-3 py-2">
              {template.description && (
                <div className="flex items-start gap-3">
                  <Tag className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-text-secondary text-sm">描述</p>
                    <p className="text-text-primary">{template.description}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1">
                  <p className="text-text-secondary text-sm">奖励积分</p>
                  <p className="text-green-500 font-medium">+{instance.rewardPoints} 积分</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-text-muted shrink-0" />
                <div className="flex-1">
                  <p className="text-text-secondary text-sm">创建时间</p>
                  <p className="text-text-primary">{formatDateDetail(instance.createAt)}</p>
                </div>
              </div>

              {instance.completedAt && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-text-secondary text-sm">完成时间</p>
                    <p className="text-text-primary">{formatDateDetail(instance.completedAt)}</p>
                  </div>
                </div>
              )}

              {instance.subtasks.length > 0 && (
                <div className="flex items-start gap-3">
                  <ListTodo className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-text-secondary text-sm mb-1">子任务</p>
                    <div className="flex flex-wrap gap-1">
                      {instance.subtasks.map((subtask, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded bg-surface-light text-text-secondary text-sm"
                        >
                          {subtask}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="pt-2 pb-safe">
              {instance.status === "completed" ? (
                <button
                  onClick={() => handleTaskAction("reset", instance.id!, instance.rewardPoints)}
                  disabled={isActionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-surface-light text-text-primary font-medium hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="w-5 h-5" />
                      <span>取消完成</span>
                    </>
                  )}
                </button>
              ) : instance.status === "pending" ? (
                <button
                  onClick={() => handleTaskAction("complete", instance.id!, instance.rewardPoints)}
                  disabled={isActionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-medium hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>完成任务</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}
