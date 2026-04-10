import { useEffect, useState, useCallback } from "react";
import { getDB } from "@/db";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { formatLocalDate, formatLocalDateToYYYYMMDD } from "@/libs/time";

interface TaskContributionGraphProps {
  template: TaskTemplate;
  userId: number;
  /** 显示多少周的数据，默认 26 周（约半年） */
  // 此参数已废弃，保留是为了兼容现有调用
  weeks?: number;
}

interface DayData {
  date: string;
  status: "completed" | "skipped" | "pending" | "none";
  instance?: TaskInstance;
}

interface RowData {
  days: DayData[];
}

/**
 * 任务贡献图组件 - 类似 GitHub 的统计图
 * 展示某个任务模板在一段时间内的完成情况
 */
export function TaskContributionGraph({
  template,
  userId,
  weeks: _weeks = 26,
}: TaskContributionGraphProps) {
  const [rowsData, setRowsData] = useState<RowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ completed: 0, total: 0 });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = getDB();

      // 计算日期范围：180天前到今天
      const totalDays = 180;
      const daysPerRow = 30;
      const rows = 6;

      // 查询该模板的所有实例
      const instances = await db.taskInstances
        .where("templateId")
        .equals(template.id!)
        .and((instance) => instance.userId === userId)
        .toArray();

      // 按日期建立映射（使用本地日期）
      const instanceMap = new Map<string, TaskInstance>();
      instances.forEach((instance) => {
        if (instance.instanceDate) {
          const dateKey = instance.instanceDate;
          // 如果同一天有多个实例，优先保留已完成的
          const existing = instanceMap.get(dateKey);
          if (!existing || (existing.status !== "completed" && instance.status === "completed")) {
            instanceMap.set(dateKey, instance);
          }
        }
      });

      // 生成行数据：180天，每行30天，共6行
      // 最后一格是今天，所以起始日期是今天往前推179天
      const newRowsData: RowData[] = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (totalDays - 1)); // 179天前

      let completedCount = 0;
      let totalCount = 0;

      for (let r = 0; r < rows; r++) {
        const rowDays: DayData[] = [];
        for (let d = 0; d < daysPerRow; d++) {
          const currentDate = new Date(startDate);
          // 计算当前格子的日期：行号 * 30 + 列号
          const dayOffset = r * daysPerRow + d;
          currentDate.setDate(startDate.getDate() + dayOffset);

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

          rowDays.push({
            date: dateStr,
            status,
            instance,
          });
        }
        newRowsData.push({ days: rowDays });
      }

      setRowsData(newRowsData);
      setTotalStats({ completed: completedCount, total: totalCount });
    } catch (error) {
      console.error("加载任务贡献图数据失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [template.id, userId]);

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

      {/* 贡献图：6行 x 30列 */}
      <div className="flex flex-col gap-1 overflow-x-auto pb-2 scrollbar-hide">
        {rowsData.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1">
            {row.days.map((day, dayIndex) => (
              <div
                key={`${rowIndex}-${dayIndex}`}
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
          <div className="w-2.5 h-2.5 rounded-sm bg-surface-light/50" />
          <span>无任务</span>
        </div>
      </div>
    </div>
  );
}
