import { useEffect, useState, useRef, useCallback } from "react";
import { ListTodo, ChevronRight, Plus, Star } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";
import { useTodayTasks, useNoDateTasks, useTaskInstanceActions } from "@/hooks/useTasks";
import { useDB } from "@/db";
import {
  getEnabledTaskTemplates,
  getAllTaskInstances,
  createTaskInstances,
} from "@/db/services";
import {
  filterTemplatesNeedingInstances,
  generateTaskInstances,
} from "@/libs/task";
import type { TaskInstance, TaskTemplate } from "@/db/types";

interface TaskWithTemplate {
  instance: TaskInstance;
  template: TaskTemplate;
}

export function Home() {
  const navigate = useNavigate();
  const { user, initUser, isLoading: isUserLoading } = useUserStore();
  const { tasks, isLoading: isTasksLoading, refresh: refreshTasks } = useTodayTasks(user?.id ?? 0);
  const { tasks: noDateTasks, isLoading: isNoDateTasksLoading, refresh: refreshNoDateTasks } = useNoDateTasks(user?.id ?? 0);
  const { complete, reset } = useTaskInstanceActions();
  const [isGenerating, setIsGenerating] = useState(false);
  const hasGeneratedRef = useRef(false);

  // 初始化用户
  useEffect(() => {
    if (!user && !isUserLoading) {
      initUser();
    }
  }, [user, isUserLoading, initUser]);

  // 自动生成今日任务实例 - 只在用户加载完成且未生成过时执行
  useEffect(() => {
    if (!user?.id || isGenerating || hasGeneratedRef.current) return;

    const generateTodayInstances = async () => {
      setIsGenerating(true);
      try {
        // 获取启用的任务模板
        const templates = await getEnabledTaskTemplates(user.id);

        // 获取该用户的所有任务实例（包括没有 startAt 的）
        const existingInstances = await getAllTaskInstances(user.id);

        // 过滤出需要生成实例的模板
        const today = new Date();
        const templatesNeedingInstances = filterTemplatesNeedingInstances(
          templates,
          existingInstances,
          today
        );

        // 生成并保存新的任务实例
        if (templatesNeedingInstances.length > 0) {
          const newInstances = generateTaskInstances(templatesNeedingInstances, today);
          await createTaskInstances(newInstances);
        }

        // 标记已生成
        hasGeneratedRef.current = true;
        
        // 刷新任务列表
        await refreshTasks();
        await refreshNoDateTasks();
      } catch (error) {
        console.error("Failed to generate task instances:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    generateTodayInstances();
  }, [user?.id]); // 只依赖 user.id

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

  // 计算进度
  const completedCount = tasks.filter(({ instance }) => instance.status === "completed").length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const isLoading = isUserLoading || isTasksLoading || isNoDateTasksLoading || isGenerating;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-primary font-bold border border-border">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex flex-col">
              <p className="text-text-secondary text-sm font-normal">
                Good Morning!
              </p>
              <h1 className="text-text-primary text-xl font-bold tracking-tight">
                {user?.name ?? "User"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <p className="text-text-primary text-sm font-bold">{user?.currentPoints ?? 0} exp</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-2">
          <p className="text-text-primary text-base font-normal mb-2">
            You've completed {completedCount} of {totalCount} tasks today.
          </p>
          <div className="w-full rounded-full bg-surface h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Tasks List */}
      <main className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text-primary text-lg font-bold tracking-tight">
            Today's Tasks
          </h2>
          <button
            onClick={() => navigate("/tasks")}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface transition-colors"
          >
            <ListTodo className="w-4 h-4" />
            <span>All Tasks</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm mt-4">Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
              <ListTodo className="w-8 h-8" />
            </div>
            <p className="text-base font-medium">No tasks for today</p>
            <p className="text-sm mt-1">Create a task to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map(({ instance, template }) => (
              <div
                key={instance.id}
                className="flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border border-border"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={instance.status === "completed"}
                      onChange={() => {
                        if (instance.status === "pending") {
                          handleComplete(instance.id!, template.rewardPoints);
                        } else if (instance.status === "completed") {
                          handleReset(instance.id!, template.rewardPoints);
                        }
                      }}
                      className="custom-checkbox"
                    />
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <p
                      className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
                        instance.status === "completed"
                          ? "text-text-secondary line-through"
                          : "text-text-primary"
                      }`}
                    >
                      {template.title}
                    </p>
                    <p
                      className={`text-sm font-normal leading-normal line-clamp-2 transition-all ${
                        instance.status === "completed"
                          ? "text-text-muted line-through"
                          : "text-text-secondary"
                      }`}
                    >
                      {template.description || `+${template.rewardPoints} exp`}
                    </p>
                    {instance.subtasks.length > 0 && (
                      <p className="text-xs text-text-muted mt-1">
                        {instance.subtasks.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-primary font-medium">
                    +{template.rewardPoints}
                  </span>
                  <ChevronRight className="w-5 h-5 text-text-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Date Tasks Section */}
        {noDateTasks.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4 mt-6">
              <h2 className="text-text-primary text-lg font-bold tracking-tight">
                No Date
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {noDateTasks.map(({ instance, template }) => (
                <div
                  key={instance.id}
                  className="flex items-center gap-4 bg-surface rounded-xl p-4 min-h-[72px] justify-between border border-border"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={instance.status === "completed"}
                        onChange={() => {
                          if (instance.status === "pending") {
                            handleComplete(instance.id!, template.rewardPoints);
                          } else if (instance.status === "completed") {
                            handleReset(instance.id!, template.rewardPoints);
                          }
                        }}
                        className="custom-checkbox"
                      />
                    </div>
                    <div className="flex flex-col justify-center flex-1">
                      <p
                        className={`text-base font-medium leading-normal line-clamp-1 transition-all ${
                          instance.status === "completed"
                            ? "text-text-secondary line-through"
                            : "text-text-primary"
                        }`}
                      >
                        {template.title}
                      </p>
                      <p
                        className={`text-sm font-normal leading-normal line-clamp-2 transition-all ${
                          instance.status === "completed"
                            ? "text-text-muted line-through"
                            : "text-text-secondary"
                        }`}
                      >
                        {template.description || `+${template.rewardPoints} exp`}
                      </p>
                      {instance.subtasks.length > 0 && (
                        <p className="text-xs text-text-muted mt-1">
                          {instance.subtasks.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-primary font-medium">
                      +{template.rewardPoints}
                    </span>
                    <ChevronRight className="w-5 h-5 text-text-muted" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Floating Add Button */}
      <button
        onClick={() => navigate("/tasks/new")}
        className="fixed bottom-24 right-4 flex items-center justify-center w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary-light transition-colors z-40"
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  );
}
