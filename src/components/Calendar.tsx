import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState, useCallback, useMemo } from "react";

// ==================== 类型定义 ====================

export type CalendarValue = Date | [Date, Date] | null;

export interface CalendarCellInfo {
  date: Date; // 当前日期
  isToday: boolean; // 是否是今天
  isSelected: boolean; // 是否被选中（单选）或在范围内（范围选择）
  isRangeStart: boolean; // 是否是范围开始（仅范围模式）
  isRangeEnd: boolean; // 是否是范围结束（仅范围模式）
  isInRange: boolean; // 是否在范围内（仅范围模式）
  isCurrentMonth: boolean; // 是否在当前月份（上下月为 false）
  isDisabled: boolean; // 是否禁用（超出 min/max）
  dayOfWeek: number; // 星期几 0-6
}

export interface CalendarProps {
  // === 模式 ===
  mode?: "single" | "range"; // 默认 'single'

  // === 受控 ===
  value?: CalendarValue;
  onChange?: (value: CalendarValue) => void;

  // === 非受控 ===
  defaultValue?: CalendarValue;
  defaultMonth?: Date; // 默认显示哪个月，默认今天

  // === 外观 ===
  className?: string;
  showYearSwitcher?: boolean; // 默认 false，true 时显示 << >>

  // === 本地化 ===
  weekStartsOn?: 0 | 1; // 默认 0 (周日)
  weekDayLabels?: string[]; // 默认 ['S','M','T','W','T','F','S']
  monthLabel?: (date: Date) => string; // 月份标题格式化

  // === 限制 ===
  minDate?: Date;
  maxDate?: Date;

  // === 自定义渲染 ===
  cell?: (info: CalendarCellInfo) => React.ReactNode;

  // === 回调 ===
  onMonthChange?: (date: Date) => void; // 月份切换时触发
}

// ==================== 工具函数 ====================

/**
 * 判断两个日期是否是同一天
 */
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * 判断日期 d 是否在 [start, end] 范围内（包含边界）
 */
function isDateInRange(d: Date, start: Date, end: Date): boolean {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return date >= startTime && date <= endTime;
}

/**
 * 获取月份第一天的星期几，考虑 weekStartsOn
 */
function getFirstDayOfMonth(date: Date, weekStartsOn: 0 | 1): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  if (weekStartsOn === 1) {
    return firstDay === 0 ? 6 : firstDay - 1;
  }
  return firstDay;
}

/**
 * 获取月份的天数
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 判断日期是否在 min/max 范围内
 */
function isDateDisabled(date: Date, minDate?: Date, maxDate?: Date): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (minDate) {
    const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    if (d < min) return true;
  }
  if (maxDate) {
    const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    if (d > max) return true;
  }
  return false;
}

// ==================== 默认 Cell 组件 ====================

const DefaultCell: React.FC<{ info: CalendarCellInfo }> = ({ info }) => {
  const {
    date,
    isToday,
    isSelected,
    isRangeStart,
    isRangeEnd,
    isInRange,
    isCurrentMonth,
    isDisabled,
  } = info;

  // 基础样式
  let className =
    "w-full h-full flex items-center justify-center rounded-lg text-sm font-medium";

  if (isDisabled) {
    className += " text-gray-600 cursor-not-allowed";
  } else if (!isCurrentMonth) {
    className += " text-gray-600"; // 上下月灰色
  } else if (isRangeStart || isRangeEnd) {
    className += " bg-primary text-white";
  } else if (isInRange) {
    className += " bg-primary/20 text-primary";
  } else if (isSelected) {
    className += " bg-primary text-white";
  } else if (isToday) {
    className += " border border-primary text-primary";
  } else {
    className += " text-text-primary hover:bg-surface transition-colors";
  }

  return <div className={className}>{date.getDate()}</div>;
};

// ==================== 主组件 ====================

export function Calendar({
  mode = "single",
  value,
  onChange,
  defaultValue,
  defaultMonth,
  className = "",
  showYearSwitcher = false,
  weekStartsOn = 0,
  weekDayLabels = ["S", "M", "T", "W", "T", "F", "S"],
  monthLabel,
  minDate,
  maxDate,
  cell: CellComponent,
  onMonthChange,
}: CalendarProps) {
  // 获取今天的日期（非响应式，组件生命周期内固定）
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // 内部状态：当前显示的月份
  const [internalMonth, setInternalMonth] = useState(() => {
    if (defaultMonth) return new Date(defaultMonth.getFullYear(), defaultMonth.getMonth(), 1);
    if (defaultValue instanceof Date) return new Date(defaultValue.getFullYear(), defaultValue.getMonth(), 1);
    if (Array.isArray(defaultValue) && defaultValue[0])
      return new Date(defaultValue[0].getFullYear(), defaultValue[0].getMonth(), 1);
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // 内部状态：非受控模式的选中值
  const [internalValue, setInternalValue] = useState<CalendarValue>(() => {
    if (defaultValue !== undefined) return defaultValue;
    return null;
  });

  // 范围选择时的临时状态（记录第一次点击）
  const [rangeTemp, setRangeTemp] = useState<Date | null>(null);

  // 判断是否为受控组件
  const isControlled = value !== undefined;
  const selectedValue = isControlled ? value : internalValue;

  // 当前显示的月份
  const currentMonth = internalMonth;

  // 计算日历数据
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOffset = getFirstDayOfMonth(currentMonth, weekStartsOn);
    const daysInCurrentMonth = getDaysInMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const days: CalendarCellInfo[] = [];

    // 上月日期
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      days.push(createCellInfo(date, false));
    }

    // 当月日期
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const date = new Date(year, month, day);
      days.push(createCellInfo(date, true));
    }

    // 下月日期（补全到 42 格，即 6 行）
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const date = new Date(year, month + 1, day);
      days.push(createCellInfo(date, false));
    }

    return days;

    function createCellInfo(date: Date, isCurrentMonth: boolean): CalendarCellInfo {
      const isTodayDate = isSameDay(date, today);
      const isDisabled = isDateDisabled(date, minDate, maxDate);

      let isSelected = false;
      let isRangeStart = false;
      let isRangeEnd = false;
      let isInRange = false;

      if (mode === "single" && selectedValue instanceof Date) {
        isSelected = isSameDay(date, selectedValue);
      } else if (mode === "range" && Array.isArray(selectedValue)) {
        const [start, end] = selectedValue;
        if (start && isSameDay(date, start)) {
          isRangeStart = true;
          isSelected = true;
        }
        if (end && isSameDay(date, end)) {
          isRangeEnd = true;
          isSelected = true;
        }
        if (start && end && !isRangeStart && !isRangeEnd) {
          isInRange = isDateInRange(date, start, end);
          isSelected = isInRange;
        }
      }

      return {
        date,
        isToday: isTodayDate,
        isSelected,
        isRangeStart,
        isRangeEnd,
        isInRange,
        isCurrentMonth,
        isDisabled,
        dayOfWeek: date.getDay(),
      };
    }
  }, [currentMonth, weekStartsOn, today, selectedValue, mode, minDate, maxDate]);

  // 处理日期点击
  const handleDateClick = useCallback(
    (cellInfo: CalendarCellInfo) => {
      if (cellInfo.isDisabled) return;

      const clickedDate = new Date(
        cellInfo.date.getFullYear(),
        cellInfo.date.getMonth(),
        cellInfo.date.getDate()
      );

      if (mode === "single") {
        if (!isControlled) {
          setInternalValue(clickedDate);
        }
        onChange?.(clickedDate);
      } else if (mode === "range") {
        if (!rangeTemp) {
          // 第一次点击：设置开始日期
          setRangeTemp(clickedDate);
          const newValue: [Date, Date] = [clickedDate, clickedDate];
          if (!isControlled) {
            setInternalValue(newValue);
          }
          onChange?.(newValue);
        } else {
          // 第二次点击：设置结束日期
          const start = rangeTemp;
          const end = clickedDate;

          // 确保开始 <= 结束
          let newValue: [Date, Date];
          if (start <= end) {
            newValue = [start, end];
          } else {
            newValue = [end, start];
          }

          setRangeTemp(null);
          if (!isControlled) {
            setInternalValue(newValue);
          }
          onChange?.(newValue);
        }
      }
    },
    [mode, isControlled, onChange, rangeTemp]
  );

  // 切换月份
  const handlePrevMonth = useCallback(() => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  }, [currentMonth, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  }, [currentMonth, onMonthChange]);

  // 切换年份
  const handlePrevYear = useCallback(() => {
    const newMonth = new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1);
    setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  }, [currentMonth, onMonthChange]);

  const handleNextYear = useCallback(() => {
    const newMonth = new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1);
    setInternalMonth(newMonth);
    onMonthChange?.(newMonth);
  }, [currentMonth, onMonthChange]);

  // 月份标题格式化
  const monthTitle = useMemo(() => {
    if (monthLabel) {
      return monthLabel(currentMonth);
    }
    return currentMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth, monthLabel]);

  // 调整星期标签顺序
  const adjustedWeekDayLabels = useMemo(() => {
    if (weekStartsOn === 1) {
      return [...weekDayLabels.slice(1), weekDayLabels[0]];
    }
    return weekDayLabels;
  }, [weekDayLabels, weekStartsOn]);

  // 渲染 Cell
  const renderCell = (info: CalendarCellInfo) => {
    if (CellComponent) {
      return CellComponent(info);
    }
    return <DefaultCell info={info} />;
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header - Month Navigation */}
      <div className="flex items-center justify-between mb-2">
        {showYearSwitcher ? (
          <button
            onClick={handlePrevYear}
            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Previous year"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        <button
          onClick={handlePrevMonth}
          className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <p className="text-base font-bold text-text-primary px-4">{monthTitle}</p>

        <button
          onClick={handleNextMonth}
          className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {showYearSwitcher ? (
          <button
            onClick={handleNextYear}
            className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Next year"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Week Days */}
      <div className="grid grid-cols-7">
        {adjustedWeekDayLabels.map((day, index) => (
          <p
            key={`${day}-${index}`}
            className="h-10 flex items-center justify-center text-[13px] font-bold text-text-muted"
          >
            {day}
          </p>
        ))}

        {/* Calendar Days */}
        {calendarDays.map((cellInfo, index) => (
          <button
            key={`${cellInfo.date.toISOString()}-${index}`}
            onClick={() => handleDateClick(cellInfo)}
            disabled={cellInfo.isDisabled}
            className="h-12 p-0.5"
          >
            {renderCell(cellInfo)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
