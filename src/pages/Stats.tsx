import { ChevronLeft } from "lucide-react";
import { Calendar } from "../components/Calendar";
import { useState } from "react";

const dayTasks = [
  { id: 1, name: "Morning Run", exp: 10, completed: false },
  { id: 2, name: "Read 20 pages", exp: 5, completed: false },
  { id: 3, name: "Plan tomorrow's tasks", exp: 5, completed: true },
];

// 模拟任务完成状态数据
const taskStatusMap: Record<string, "completed" | "partial"> = {
  "2026-03-01": "completed",
  "2026-03-02": "completed",
  "2026-03-03": "partial",
  "2026-03-05": "completed",
  "2026-03-06": "partial",
  "2026-03-08": "completed",
  "2026-03-10": "completed",
  "2026-03-12": "partial",
  "2026-03-15": "completed",
  "2026-03-18": "completed",
  "2026-03-20": "partial",
  "2026-03-22": "completed",
  "2026-03-25": "completed",
  "2026-03-28": "partial",
};

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function Stats() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // 自定义 cell 渲染，显示任务状态点
  const renderCell = (info: {
    date: Date;
    isToday: boolean;
    isSelected: boolean;
    isCurrentMonth: boolean;
    isDisabled: boolean;
  }) => {
    const { date, isToday, isSelected, isCurrentMonth, isDisabled } = info;
    const dateKey = formatDateKey(date);
    const status = taskStatusMap[dateKey];

    // 基础样式
    let className =
      "w-full h-full flex items-center justify-center rounded-lg text-sm font-medium relative";

    if (isDisabled) {
      className += " text-gray-600 cursor-not-allowed";
    } else if (!isCurrentMonth) {
      className += " text-gray-600";
    } else if (isSelected) {
      className += " bg-primary text-white";
    } else if (isToday) {
      className += " border border-primary text-primary";
    } else {
      className += " text-text-primary hover:bg-surface transition-colors";
    }

    return (
      <div className={className}>
        {date.getDate()}
        {status && !isDisabled && (
          <div
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
              status === "completed" ? "bg-green-500" : "bg-amber-500"
            }`}
          />
        )}
      </div>
    );
  };

  const formattedSelectedDate = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "Select a date";

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
        {/* Calendar */}
        <div className="max-w-xs mx-auto">
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
            cell={renderCell}
          />
        </div>

        {/* Tasks for the day */}
        <div className="mt-6">
          <h3 className="text-lg font-bold text-text-primary pb-2 pt-4">
            Tasks for {formattedSelectedDate}
          </h3>
          <div className="divide-y divide-border">
            {dayTasks.map((task) => (
              <label
                key={task.id}
                className="flex gap-x-3 py-4 flex-row items-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  className="custom-checkbox w-6 h-6"
                  readOnly
                />
                <p className="text-base text-text-primary">
                  {task.name}{" "}
                  <span className="text-text-muted">(+{task.exp} exp)</span>
                </p>
              </label>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Stats;
