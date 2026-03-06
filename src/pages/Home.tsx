import { useEffect, useState, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { useUserStore } from "@/store";
import { useTodayTasks, useNoDateTasks, useTaskInstanceActions } from "@/hooks/useTasks";
import {
  getEnabledTaskTemplates,
  getAllTaskInstances,
  createTaskInstances,
} from "@/db/services";
import {
  filterTemplatesNeedingInstances,
  generateTaskInstances,
} from "@/libs/task";
import { HomeHeader } from "@/components/HomeHeader";
import { Progress } from "@/components/Progress";
import { TaskList } from "@/components/TaskList";

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

  const isLoading = isUserLoading || isTasksLoading || isNoDateTasksLoading || isGenerating;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <HomeHeader user={user} />
        <Progress completedCount={completedCount} totalCount={totalCount} />
      </header>

      {/* Tasks List */}
      <main className="px-4">
        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          onComplete={handleComplete}
          onReset={handleReset}
          title="Today's Tasks"
          showViewAll={true}
          emptyMessage="No tasks for today"
        />

        {/* No Date Tasks Section */}
        {noDateTasks.length > 0 && (
          <div className="mt-6">
            <TaskList
              tasks={noDateTasks}
              isLoading={isLoading}
              onComplete={handleComplete}
              onReset={handleReset}
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
    </div>
  );
}
