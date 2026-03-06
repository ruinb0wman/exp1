import { useState, useCallback, useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popup } from './Popup';
import { Calendar, CalendarProps } from './Calendar';

export interface DatePickerProps extends Omit<CalendarProps, 'value' | 'onChange' | 'mode'> {
  /** 选中的日期 */
  value?: Date | null;
  /** 默认选中的日期（非受控） */
  defaultValue?: Date | null;
  /** 日期改变时的回调 */
  onChange?: (date: Date | null) => void;
  /** 占位文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 日期格式化函数 */
  format?: (date: Date) => string;
}

/**
 * 默认日期格式化函数
 */
const defaultFormat = (date: Date): string => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export function DatePicker({
  value,
  defaultValue,
  onChange,
  placeholder = '请选择日期',
  disabled = false,
  className = '',
  format = defaultFormat,
  minDate,
  maxDate,
  defaultMonth,
  weekStartsOn,
  weekDayLabels,
  monthLabel,
  showYearSwitcher,
  cell,
  onMonthChange,
}: DatePickerProps) {
  // 是否为受控组件
  const isControlled = value !== undefined;
  
  // 内部状态（非受控模式）
  const [internalValue, setInternalValue] = useState<Date | null>(defaultValue ?? null);
  
  // 当前选中的日期
  const selectedDate = isControlled ? value : internalValue;
  
  // Popup 显示状态
  const [isOpen, setIsOpen] = useState(false);

  // 显示的文本
  const displayText = useMemo(() => {
    if (selectedDate) {
      return format(selectedDate);
    }
    return placeholder;
  }, [selectedDate, format, placeholder]);

  // 打开 Popup
  const handleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
    }
  }, [disabled]);

  // 关闭 Popup
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 处理日期选择
  const handleDateChange = useCallback((date: Date | [Date, Date] | null) => {
    if (date instanceof Date) {
      if (!isControlled) {
        setInternalValue(date);
      }
      onChange?.(date);
      // 选择后关闭弹窗
      setIsOpen(false);
    }
  }, [isControlled, onChange]);

  // 清除选择
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isControlled) {
      setInternalValue(null);
    }
    onChange?.(null);
  }, [isControlled, onChange]);

  return (
    <>
      {/* 触发区域 */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-3
          bg-surface border border-border rounded-xl
          text-left transition-all duration-200
          ${disabled 
            ? 'opacity-50 cursor-not-allowed bg-surface/50' 
            : 'hover:border-primary/50 active:border-primary cursor-pointer'
          }
          ${selectedDate ? 'text-text-primary' : 'text-text-muted'}
          ${className}
        `}
      >
        <span className="flex-1 truncate">
          {displayText}
        </span>
        <div className="flex items-center gap-2">
          {selectedDate && !disabled && (
            <span
              onClick={handleClear}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-text-muted/20 text-text-muted hover:bg-text-muted/30 transition-colors"
            >
              ×
            </span>
          )}
          <CalendarIcon className="w-5 h-5 text-text-secondary flex-shrink-0" />
        </div>
      </button>

      {/* 日期选择弹窗 */}
      <Popup
        isOpen={isOpen}
        onClose={handleClose}
        position="bottom"
        maskClosable={true}
        showCloseButton={false}
        maxHeight="auto"
      >
        <div className="py-2">
          <Calendar
            mode="single"
            value={selectedDate}
            onChange={handleDateChange}
            minDate={minDate}
            maxDate={maxDate}
            defaultMonth={defaultMonth}
            weekStartsOn={weekStartsOn}
            weekDayLabels={weekDayLabels}
            monthLabel={monthLabel}
            showYearSwitcher={showYearSwitcher}
            cell={cell}
            onMonthChange={onMonthChange}
          />
        </div>
        
        {/* 底部操作按钮 */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-surface hover:bg-surface/80 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              // 如果没有选择日期，默认选择今天
              if (!selectedDate) {
                const today = new Date();
                if (!isControlled) {
                  setInternalValue(today);
                }
                onChange?.(today);
              }
              handleClose();
            }}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            确定
          </button>
        </div>
      </Popup>
    </>
  );
}

export default DatePicker;
