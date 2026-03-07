import { useEffect, useCallback, useState } from "react";
import { Plus, CheckCircle2, XCircle, Clock, RefreshCw, Calendar, AlignLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";
import { useTodayTasks, useNoDateTasks, useTaskInstanceActions } from "@/hooks/useTasks";
import { useTaskInstanceGenerator } from "@/hooks/useTaskInstanceGenerator";
import { HomeHeader } from "@/components/HomeHeader";
import { Progress } from "@/components/Progress";
import { TaskList } from "@/components/TaskList";
import { Popup } from "@/components/Popup";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { isExpired, getExpireTimeText } from "@/libs/time";
import { getTaskProgressPercent, updateTaskProgress } from "@/db/services";

export function Home() {
  const navigate = useNavigate();
  const { user, currentPoints, isLoading: isUserLoading } = useUserStore();
  
  // 任务详情 popup 状态
  const [selectedTask, setSelectedTask] = useState<{ instance: TaskInstance; template: TaskTemplate } | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { tasks, isLoading: isTasksLoading, refresh: refreshTasks } = useTodayTasks(user?.id ?? 0, user?.dayEndTime);
  const { tasks: noDateTasks, isLoading: isNoDateTasksLoading, refresh: refreshNoDateTasks } = useNoDateTasks(user?.id ?? 0);
  const { complete, reset } = useTaskInstanceActions();
  
  const { isGenerating, generateToday } = useTaskInstanceGenerator({
    userId: user?.id,
    dayEndTime: user?.dayEndTime,
    onGenerated: async () => {
      // 刷新任务列表
      await refreshTasks();
      await refreshNoDateTasks();
    },
    onError: (error) => {
      console.error("Failed to generate task instances:", error);
    },
  });

  // 自动生成今日任务实例 - 只在用户加载完成且未生成过时执行
  useEffect(() => {
    if (!user?.id) return;

    generateToday();
    // 注意：generateToday 内部有防止重复执行的机制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 处理完成任务
  const handleComplete = useCallback(async (instanceId: number, rewardPoints: number) => {
    try {
      await complete(instanceId);
      // 刷新任务列表以显示完成状态
      await refreshTasks();
      await refreshNoDateTasks();
      // 添加积分
      await useUserStore.getState().addPoints(rewardPoints, "task_reward", instanceId);
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  }, [complete, refreshTasks, refreshNoDateTasks]);

  // 处理撤回任务
  const handleReset = useCallback(async (instanceId: number, rewardPoints: number) => {
    try {
      await reset(instanceId);
      // 刷新任务列表以显示待处理状态
      await refreshTasks();
      await refreshNoDateTasks();
      // 扣除积分
      await useUserStore.getState().spendPoints(rewardPoints, "task_reward", instanceId);
    } catch (error) {
      console.error("Failed to reset task:", error);
    }
  }, [reset, refreshTasks, refreshNoDateTasks]);

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
      await complete(instance.id!);
      await refreshTasks();
      await refreshNoDateTasks();
      await useUserStore.getState().addPoints(template.rewardPoints, "task_reward", instance.id!);
      handleCloseDetail();
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  }, [selectedTask, complete, refreshTasks, refreshNoDateTasks, handleCloseDetail]);

  // 在 popup 中撤回任务
  const handleResetInPopup = useCallback(async () => {
    if (!selectedTask) return;
    const { instance, template } = selectedTask;
    try {
      await reset(instance.id!);
      await refreshTasks();
      await refreshNoDateTasks();
      await useUserStore.getState().spendPoints(template.rewardPoints, "task_reward", instance.id!);
      handleCloseDetail();
    } catch (error) {
      console.error("Failed to reset task:", error);
    }
  }, [selectedTask, reset, refreshTasks, refreshNoDateTasks, handleCloseDetail]);

  // 在 popup 中增加一次进度（用于 count 类型任务）
  const handleIncrementCount = useCallback(async () => {
    if (!selectedTask) return;
    const { instance, template } = selectedTask;
    try {
      const progressBefore = instance.completeProgress ?? 0;
      const target = template.completeTarget ?? 0;
      
      // 更新进度（增加1）
      await updateTaskProgress(instance.id!, 1);
      
      // 如果进度达到目标，发放积分
      const progressAfter = progressBefore + 1;
      if (progressAfter >= target && progressBefore < target) {
        await useUserStore.getState().addPoints(template.rewardPoints, "task_reward", instance.id!);
      }
      
      // 刷新任务列表
      await refreshTasks();
      await refreshNoDateTasks();
      
      // 刷新选中的任务状态
      const { getTaskInstanceWithTemplate } = await import("@/db/services");
      const updated = await getTaskInstanceWithTemplate(instance.id!);
      if (updated) {
        setSelectedTask({ instance: updated.instance, template: updated.template! });
      }
    } catch (error) {
      console.error("Failed to increment count:", error);
    }
  }, [selectedTask, refreshTasks, refreshNoDateTasks]);

  // 过滤掉已完成的任务，首页只显示待完成/已跳过的任务
  const pendingTasks = tasks.filter(({ instance }) => instance.status !== "completed");
  
  // 计算进度（基于原始任务列表）
  const completedCount = tasks.filter(({ instance }) => instance.status === "completed").length;
  const totalCount = tasks.length;

  const isLoading = isUserLoading || isTasksLoading || isNoDateTasksLoading || isGenerating;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <HomeHeader user={user} currentPoints={currentPoints} />
        <Progress completedCount={completedCount} totalCount={totalCount} />
      </header>

      {/* Tasks List */}
      <main className="px-4">
        <TaskList
          tasks={pendingTasks}
          isLoading={isLoading}
          onComplete={handleComplete}
          onReset={handleReset}
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
              tasks={noDateTasks.filter(({ instance }) => instance.status !== "completed")}
              isLoading={isLoading}
              onComplete={handleComplete}
              onReset={handleReset}
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
      <Popup
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        position="bottom"
        title="任务详情"
        maskClosable={true}
      >
        {selectedTask && (
          <TaskDetailContent
            instance={selectedTask.instance}
            template={selectedTask.template}
            onComplete={handleCompleteInPopup}
            onReset={handleResetInPopup}
            onIncrementCount={handleIncrementCount}
            onClose={handleCloseDetail}
          />
        )}
      </Popup>
    </div>
  );
}

// 任务详情内容组件
interface TaskDetailContentProps {
  instance: TaskInstance;
  template: TaskTemplate;
  onComplete: () => void;
  onReset: () => void;
  onIncrementCount: () => void;
  onClose: () => void;
}

function TaskDetailContent({ instance, template, onComplete, onReset, onIncrementCount, onClose }: TaskDetailContentProps) {
  const isCompleted = instance.status === "completed";
  const expired = isExpired(instance.expiredAt);
  const hasCompleteRule = !!template.completeRule;
  const isCountRule = template.completeRule === "count";
  const isTimeRule = template.completeRule === "time";
  const progressPercent = getTaskProgressPercent(instance, template);

  // 获取进度文本
  const getProgressText = () => {
    if (!hasCompleteRule) return null;
    const progress = instance.completeProgress ?? 0;
    const target = template.completeTarget ?? 0;
    const unit = template.completeRule === "time" ? "分钟" : "次";
    return `${progress} / ${target} ${unit}`;
  };

  // 获取重复模式文本
  const getRepeatText = () => {
    switch (template.repeatMode) {
      case "daily":
        return template.repeatInterval && template.repeatInterval > 1 
          ? `每 ${template.repeatInterval} 天` 
          : "每天";
      case "weekly":
        if (template.repeatDaysOfWeek && template.repeatDaysOfWeek.length > 0) {
          const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
          const dayNames = template.repeatDaysOfWeek.map(d => days[d]).join("、");
          return template.repeatInterval && template.repeatInterval > 1
            ? `每 ${template.repeatInterval} 周的 ${dayNames}`
            : `每周 ${dayNames}`;
        }
        return "每周";
      case "monthly":
        if (template.repeatDaysOfMonth && template.repeatDaysOfMonth.length > 0) {
          const days = template.repeatDaysOfMonth.map(d => `${d}日`).join("、");
          return template.repeatInterval && template.repeatInterval > 1
            ? `每 ${template.repeatInterval} 个月的 ${days}`
            : `每月 ${days}`;
        }
        return "每月";
      default:
        return "一次性任务";
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* 任务标题 */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isCompleted ? "bg-green-500/20" : expired ? "bg-red-500/20" : "bg-primary/20"
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : expired ? (
            <XCircle className="w-5 h-5 text-red-500" />
          ) : (
            <Clock className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${
            isCompleted ? "text-text-secondary line-through" : "text-text-primary"
          }`}>
            {template.title}
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            {isCompleted ? "已完成" : expired ? "已过期" : "进行中"}
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-primary">+{template.rewardPoints}</span>
          <p className="text-xs text-text-muted">经验值</p>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="h-px bg-border" />

      {/* 任务信息 */}
      <div className="space-y-3">
        {/* 描述 */}
        {template.description && (
          <div className="flex items-start gap-3">
            <AlignLeft className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted">描述</p>
              <p className="text-sm text-text-primary mt-0.5">{template.description}</p>
            </div>
          </div>
        )}

        {/* 重复模式 */}
        <div className="flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-text-muted shrink-0" />
          <div>
            <p className="text-xs text-text-muted">重复</p>
            <p className="text-sm text-text-primary mt-0.5">{getRepeatText()}</p>
          </div>
        </div>

        {/* 时间信息 */}
        {instance.startAt && (
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-text-muted shrink-0" />
            <div>
              <p className="text-xs text-text-muted">日期</p>
              <p className="text-sm text-text-primary mt-0.5">
                {new Date(instance.startAt).toLocaleDateString("zh-CN")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 进度条（如果有完成规则） */}
      {hasCompleteRule && (
        <div className="bg-surface-light rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">完成进度</span>
            <span className="text-sm font-medium text-primary">{getProgressText()}</span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent >= 100 ? "bg-green-500" : progressPercent >= 60 ? "bg-primary" : "bg-yellow-500"
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 过期提示 */}
      {expired && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm text-red-500 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            此任务已过期
          </p>
        </div>
      )}
      {!expired && instance.expiredAt && (
        <div className="bg-surface-light rounded-lg p-3">
          <p className="text-xs text-text-muted">{getExpireTimeText(instance.expiredAt)}</p>
        </div>
      )}

      {/* 子任务 */}
      {instance.subtasks.length > 0 && (
        <div className="bg-surface-light rounded-lg p-3">
          <p className="text-xs text-text-muted mb-2">子任务</p>
          <div className="flex flex-wrap gap-2">
            {instance.subtasks.map((subtask, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-surface rounded text-xs text-text-secondary"
              >
                {subtask}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        {isCompleted ? (
          <button
            onClick={onReset}
            className="flex-1 py-3 px-4 bg-surface-light hover:bg-surface text-text-primary rounded-xl font-medium transition-colors"
          >
            标记为未完成
          </button>
        ) : isTimeRule ? (
          // time 类型任务：不显示完成任务按钮，显示提示
          <div className="flex-1 py-3 px-4 bg-surface-light rounded-xl text-center">
            <p className="text-sm text-text-secondary">使用番茄钟记录时间</p>
            <p className="text-xs text-text-muted mt-1">达到目标时长后自动完成</p>
          </div>
        ) : isCountRule ? (
          // count 类型任务：显示"完成一次"按钮
          <button
            onClick={onIncrementCount}
            disabled={expired}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {expired ? "已过期" : "完成一次"}
          </button>
        ) : (
          // 普通任务：显示"完成任务"按钮
          <button
            onClick={onComplete}
            disabled={expired}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
          >
            {expired ? "已过期" : "完成任务"}
          </button>
        )}
        <button
          onClick={onClose}
          className="py-3 px-6 bg-surface hover:bg-surface-light text-text-secondary rounded-xl font-medium transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
