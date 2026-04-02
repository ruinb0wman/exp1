import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";
import { useTodayTasks, useNoDateTasks, useTaskInstanceActions } from "@/hooks/useTasks";
import { HomeHeader } from "@/components/HomeHeader";
import { Progress } from "@/components/Progress";
import { TaskList } from "@/components/TaskList";
import { TaskDetailPopup } from "@/components/TaskDetailPopup";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import {
	completeTaskInPopup,
	resetTaskInPopup,
	incrementTaskCount,
	toggleSubtaskCompletion,
	calculateTaskStats,
	filterPendingTasks,
	calculateEstimatedTotalPoints,
	calculateTodayEarnedPoints,
} from "./lib";

export function Home() {
  const navigate = useNavigate();
  const { user, currentPoints, isLoading: isUserLoading, calculatePoints } = useUserStore();

  // 任务详情 popup 状态
  const [selectedTask, setSelectedTask] = useState<{ instance: TaskInstance; template: TaskTemplate } | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { tasks, isLoading: isTasksLoading, refresh: refreshTasks } = useTodayTasks(user?.id ?? 0, user?.dayEndTime);
  const { tasks: noDateTasks, isLoading: isNoDateTasksLoading, refresh: refreshNoDateTasks } = useNoDateTasks(user?.id ?? 0);
  const { complete, reset } = useTaskInstanceActions();

  // 进入页面时重新计算积分
  useEffect(() => {
    calculatePoints();
  }, [calculatePoints]);

  // 处理点击任务卡片
  const handleTaskClick = useCallback((instance: TaskInstance, template: TaskTemplate) => {
    setSelectedTask({ instance, template });
    setIsDetailOpen(true);
  }, []);

  // 关闭任务详情 popup
  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setTimeout(() => setSelectedTask(null), 300);
  }, []);

  // 在 popup 中完成任务
  const handleCompleteInPopup = useCallback(async () => {
    if (!selectedTask) return;
    const { instance, template } = selectedTask;
    try {
      await completeTaskInPopup(
        instance,
        template,
        complete,
        refreshTasks,
        refreshNoDateTasks,
        handleCloseDetail
      );
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  }, [selectedTask, complete, refreshTasks, refreshNoDateTasks, handleCloseDetail]);

  // 在 popup 中撤回任务
  const handleResetInPopup = useCallback(async () => {
    if (!selectedTask) return;
    const { instance, template } = selectedTask;
    try {
      await resetTaskInPopup(instance, template, reset, refreshTasks, refreshNoDateTasks, handleCloseDetail);
    } catch (error) {
      console.error("Failed to reset task:", error);
    }
  }, [selectedTask, reset, refreshTasks, refreshNoDateTasks, handleCloseDetail]);

  // 在 popup 中增加一次进度（用于 count 类型任务）
  const handleIncrementCount = useCallback(async () => {
    if (!selectedTask) return;
    const { instance, template } = selectedTask;
    try {
      const updated = await incrementTaskCount(instance, template, refreshTasks, refreshNoDateTasks);

      // 刷新选中的任务状态
      if (updated) {
        setSelectedTask({ instance: updated.instance, template: updated.template! });
      }
    } catch (error) {
      console.error("Failed to increment count:", error);
    }
  }, [selectedTask, refreshTasks, refreshNoDateTasks]);

  // 在 popup 中切换子任务完成状态（用于 subtask 类型任务）
  const handleToggleSubtask = useCallback(async (index: number) => {
    if (!selectedTask) return;
    const { instance } = selectedTask;
    try {
      const completedSubtasks = instance.completedSubtasks || [];
      const newCompleted = !completedSubtasks[index];
      
      const updated = await toggleSubtaskCompletion(
        instance,
        index,
        newCompleted,
        refreshTasks,
        refreshNoDateTasks
      );

      // 刷新选中的任务状态
      if (updated) {
        setSelectedTask({ instance: updated.instance, template: updated.template! });
      }
    } catch (error) {
      console.error("Failed to toggle subtask:", error);
    }
  }, [selectedTask, refreshTasks, refreshNoDateTasks]);

  // 首页只显示待完成的任务，过滤掉已完成和已跳过的
  const pendingTasks = filterPendingTasks(tasks);

  // 计算进度（基于原始任务列表）
  const { completedCount, totalCount } = calculateTaskStats(tasks);

  // 计算预估总积分和已获积分
  const earnedPoints = calculateTodayEarnedPoints(tasks);
  const estimatedTotalPoints = calculateEstimatedTotalPoints(tasks);

  const isLoading = isUserLoading || isTasksLoading || isNoDateTasksLoading;

  return (
    <div className="pb-24 bg-background">
      {/* Header */}
      <header className="px-4 pb-4">
        <HomeHeader user={user} currentPoints={currentPoints} />
        <Progress completedCount={completedCount} totalCount={totalCount} earnedPoints={earnedPoints} estimatedTotalPoints={estimatedTotalPoints} />
      </header>

      {/* Tasks List */}
      <main className="px-4">
        <TaskList
          tasks={pendingTasks}
          isLoading={isLoading}
          onTaskClick={handleTaskClick}
          title="Today's Tasks"
          showViewAll={true}
          showHistory={true}
          emptyMessage="No tasks for today"
        />

        {/* No Date Tasks Section */}
        {noDateTasks.length > 0 && (
          <div className="mt-6">
            <TaskList
              tasks={filterPendingTasks(noDateTasks)}
              isLoading={isLoading}
              onTaskClick={handleTaskClick}
              title="No Date"
              showViewAll={false}
            />
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <button
        onClick={() => navigate("/tasks/new")}
        className="fixed bottom-24 right-4 flex items-center justify-center w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-light transition-colors z-40"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* 任务详情 Popup */}
      <TaskDetailPopup
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        instance={selectedTask?.instance ?? null}
        template={selectedTask?.template ?? null}
        onComplete={handleCompleteInPopup}
        onReset={handleResetInPopup}
        onIncrementCount={handleIncrementCount}
        onToggleSubtask={handleToggleSubtask}
      />
    </div>
  );
}
