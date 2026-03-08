import { useEffect, useState, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import { Calendar } from "../components/Calendar";
import { useUserStore } from "@/store";
import type { TaskInstance } from "@/db/types";
import { useTaskInstanceGenerator } from "@/hooks/useTaskInstanceGenerator";
import { formatLocalDate } from "@/libs/task";

interface TaskDisplayItem {
  id: number | string;
  name: string;
  exp: number;
  status: TaskInstance["status"];
  isPreview: boolean;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return formatLocalDate(date1) === formatLocalDate(date2);
}

export function Stats() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [tasks, setTasks] = useState<TaskDisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { user: currentUser } = useUserStore();

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

        const displayItems: TaskDisplayItem[] = displayTasks.map((item, index) => ({
          id: item.instance?.id ?? `preview-${item.template.id}-${index}`,
          name: item.template.title,
          exp: item.instance?.rewardPoints ?? item.template.rewardPoints,
          status: item.instance?.status ?? "pending",
          isPreview: !item.instance, // 没有实际 instance 的就是预览
        }));

        setTasks(displayItems);
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
            <div className="divide-y divide-border">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex gap-x-3 py-4 flex-row items-center ${task.isPreview ? "opacity-70" : ""
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={task.status === "completed"}
                    className="custom-checkbox w-6 h-6"
                    readOnly
                    disabled={task.isPreview}
                  />
                  <div className="flex-1">
                    <p
                      className={`text-base ${task.status === "completed"
                          ? "text-text-muted line-through"
                          : "text-text-primary"
                        }`}
                    >
                      {task.name}
                      {task.isPreview && (
                        <span className="ml-2 text-xs text-text-muted">
                          (preview)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-text-muted">
                      +{task.exp} exp
                      {task.status === "skipped" && (
                        <span className="ml-2 text-amber-500">(skipped)</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Stats;
