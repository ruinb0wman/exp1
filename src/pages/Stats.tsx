import { useEffect, useState, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { Calendar } from "../components/Calendar";
import { TaskInstanceCard } from "@/components/TaskInstanceCard";
import { TaskDetailPopup } from "@/components/TaskDetailPopup";
import { useUserStore } from "@/store";
import type { TaskTemplate, TaskInstance } from "@/db/types";
import { useTaskInstanceGenerator } from "@/hooks/useTaskInstanceGenerator";
import { useTaskInstanceActions } from "@/hooks/useTasks";
import { formatLocalDate } from "@/libs/task";
import { completeTaskInPopup, resetTaskInPopup, incrementTaskCount } from "@/pages/Home/lib";

interface DisplayTaskItem {
  template: TaskTemplate;
  instance?: TaskInstance;
  isPreview: boolean;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return formatLocalDate(date1) === formatLocalDate(date2);
}

export function Stats() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [tasks, setTasks] = useState<DisplayTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 任务详情 popup 状态
  const [selectedTask, setSelectedTask] = useState<{ instance: TaskInstance; template: TaskTemplate } | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { user: currentUser } = useUserStore();
  const { complete, reset } = useTaskInstanceActions();

  const { getDisplayTasksForDate } = useTaskInstanceGenerator({
    userId: currentUser?.id,
  });

  // 加载指定日期的任务
  const loadTasksForDate = useCallback(
    async (date: Date) => {
      if (!currentUser) return;

      setIsLoading(true);
      try {
        // 使用 hook 获取该日期应该显示的任务（包含已有实例和预览）
        const displayTasks = await getDisplayTasksForDate(date);

        setTasks(displayTasks);
      } catch (error) {
        console.error("Failed to load tasks:", error);
        setTasks([]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentUser, getDisplayTasksForDate]
  );

  // 当选择的日期变化时加载任务
  useEffect(() => {
    if (selectedDate && currentUser) {
      loadTasksForDate(selectedDate);
    }
  }, [selectedDate, currentUser, loadTasksForDate]);

  const formattedSelectedDate = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })
    : "Select a date";

  const isSelectedToday = selectedDate ? isSameDay(selectedDate, new Date()) : false;

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

  // 刷新任务列表
  const refreshTasks = useCallback(async () => {
    if (selectedDate) {
      await loadTasksForDate(selectedDate);
    }
  }, [selectedDate]);

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
        async () => {}, // noDateTasks refresh
        handleCloseDetail
      );
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  }, [selectedTask, complete, refreshTasks, handleCloseDetail]);

  // 在 popup 中撤回任务
  const handleResetInPopup = useCallback(async () => {
    if (!selectedTask) return;
    const { instance, template } = selectedTask;
    try {
      await resetTaskInPopup(instance, template, reset, refreshTasks, async () => {}, handleCloseDetail);
    } catch (error) {
      console.error("Failed to reset task:", error);
    }
  }, [selectedTask, reset, refreshTasks, handleCloseDetail]);

  // 在 popup 中增加一次进度（用于 count 类型任务）
  const handleIncrementCount = useCallback(async () => {
    if (!selectedTask) return;
    const { instance, template } = selectedTask;
    try {
      const updated = await incrementTaskCount(instance, template, refreshTasks, async () => {});

      // 刷新选中的任务状态
      if (updated) {
        setSelectedTask({ instance: updated.instance, template: updated.template! });
      }
    } catch (error) {
      console.error("Failed to increment count:", error);
    }
  }, [selectedTask, refreshTasks]);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="flex items-center p-4 pb-2 justify-between">
        <button className="w-12 flex items-center text-text-secondary hover:text-text-primary transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center">
          Calendar
        </h1>
        <div className="w-12 flex justify-end">
          <button className="text-text-primary hover:text-primary transition-colors text-2xl font-light">
            +
          </button>
        </div>
      </header>

      <main className="px-4">
        {/* Calendar - 使用默认配置 */}
        <div className="mx-auto">
          <Calendar
            mode="single"
            value={selectedDate}
            onChange={(value) => setSelectedDate(value as Date | null)}
            showYearSwitcher={false}
            weekStartsOn={0}
            weekDayLabels={["S", "M", "T", "W", "T", "F", "S"]}
            monthLabel={(date) =>
              date.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })
            }
          />
        </div>

        {/* Tasks for the day */}
        <div className="mt-6">
          <div className="flex items-center justify-between pb-2 pt-4">
            <h3 className="text-lg font-bold text-text-primary">
              Tasks for {formattedSelectedDate}
            </h3>
            {!isSelectedToday && selectedDate && (
              <span className="text-xs text-text-muted bg-surface px-2 py-1 rounded">
                Preview
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-text-muted">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center text-text-muted">
              No tasks for this day
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskInstanceCard
                  key={task.instance?.id ?? `preview-${task.template.id}`}
                  template={task.template}
                  instance={task.instance}
                  isPreview={task.isPreview}
                  onClick={({ instance, template }) => {
                    if (instance && !task.isPreview) {
                      handleTaskClick(instance, template);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 任务详情 Popup */}
      <TaskDetailPopup
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        instance={selectedTask?.instance ?? null}
        template={selectedTask?.template ?? null}
        onComplete={handleCompleteInPopup}
        onReset={handleResetInPopup}
        onIncrementCount={handleIncrementCount}
      />
    </div>
  );
}

export default Stats;
