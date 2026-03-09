import { useEffect, useState, useCallback, useMemo } from "react";
import { getDB } from "@/db";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { formatLocalDate, formatLocalDateToYYYYMMDD } from "@/libs/time";

interface TaskContributionGraphProps {
  template: TaskTemplate;
  userId: number;
  /** 显示多少周的数据，默认 26 周（约半年） */
  weeks?: number;
}

interface DayData {
  date: string;
  status: "completed" | "skipped" | "pending" | "none";
  instance?: TaskInstance;
}

interface WeekData {
  days: DayData[];
}

/**
 * 任务贡献图组件 - 类似 GitHub 的统计图
 * 展示某个任务模板在一段时间内的完成情况
 */
export function TaskContributionGraph({
  template,
  userId,
  weeks = 26,
}: TaskContributionGraphProps) {
  const [weeksData, setWeeksData] = useState<WeekData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ completed: 0, total: 0 });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = getDB();

      // 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - weeks * 7);

      // 查询该模板在日期范围内的所有实例
      const instances = await db.taskInstances
        .where("templateId")
        .equals(template.id!)
        .and((instance) => instance.userId === userId)
        .toArray();

      // 按日期建立映射（使用本地日期）
      const instanceMap = new Map<string, TaskInstance>();
      instances.forEach((instance) => {
        if (instance.startAt) {
          // 将 UTC 时间戳转换为本地日期字符串 YYYY-MM-DD
          const dateKey = formatLocalDateToYYYYMMDD(instance.startAt);
          // 如果同一天有多个实例，优先保留已完成的
          const existing = instanceMap.get(dateKey);
          if (!existing || (existing.status !== "completed" && instance.status === "completed")) {
            instanceMap.set(dateKey, instance);
          }
        }
      });

      // 生成周数据
      const newWeeksData: WeekData[] = [];
      const currentDate = new Date(startDate);

      // 调整到周一开始
      const dayOfWeek = currentDate.getDay();
      currentDate.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      let completedCount = 0;
      let totalCount = 0;

      for (let w = 0; w < weeks; w++) {
        const weekDays: DayData[] = [];
        for (let d = 0; d < 7; d++) {
          // 使用本地日期生成 key
          const dateStr = formatLocalDateToYYYYMMDD(currentDate);
          const instance = instanceMap.get(dateStr);

          let status: DayData["status"] = "none";
          if (instance) {
            status = instance.status;
            totalCount++;
            if (instance.status === "completed") {
              completedCount++;
            }
          }

          weekDays.push({
            date: dateStr,
            status,
            instance,
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }
        newWeeksData.push({ days: weekDays });
      }

      setWeeksData(newWeeksData);
      setTotalStats({ completed: completedCount, total: totalCount });
    } catch (error) {
      console.error("加载任务贡献图数据失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [template.id, userId, weeks]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 获取颜色类名
  const getColorClass = (status: DayData["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "skipped":
        return "bg-yellow-600";
      case "pending":
        return "bg-surface-light";
      default:
        return "bg-surface-light/50";
    }
  };

  // 获取提示文本
  const getTooltipText = (day: DayData) => {
    const dateText = formatLocalDate(day.date);
    switch (day.status) {
      case "completed":
        return `${dateText}: 已完成`;
      case "skipped":
        return `${dateText}: 已跳过`;
      case "pending":
        return `${dateText}: 进行中`;
      default:
        return `${dateText}: 无任务`;
    }
  };

  // 星期标签
  const weekDays = useMemo(() => ["一", "三", "五", "日"], []);

  if (isLoading) {
    return (
      <div className="bg-surface rounded-xl p-4">
        <div className="flex items-center justify-center h-24">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl p-4">
      {/* 标题和统计 */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-text-primary">完成记录</h4>
        <span className="text-xs text-text-muted">
          {totalStats.completed} / {totalStats.total} 完成
        </span>
      </div>

      {/* 贡献图 */}
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
        {/* 星期标签 */}
        <div className="flex flex-col gap-1 mr-1">
          {weekDays.map((day) => (
            <div key={day} className="h-3 text-[8px] text-text-muted flex items-center">
              {day}
            </div>
          ))}
        </div>

        {/* 周数据 */}
        {weeksData.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.days.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`w-3 h-3 rounded-sm ${getColorClass(day.status)} transition-all duration-200 hover:ring-2 hover:ring-primary/50 cursor-pointer`}
                title={getTooltipText(day)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-end gap-3 mt-3 text-[10px] text-text-muted">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span>完成</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-yellow-600" />
          <span>跳过</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-surface-light" />
          <span>未完成</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-surface-light/50" />
          <span>无任务</span>
        </div>
      </div>
    </div>
  );
}
