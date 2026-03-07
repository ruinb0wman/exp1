import { useState, useEffect, useRef, useCallback } from 'react';
import { parseTimeString, formatTimeString } from '@/libs/time';
import { X, Check } from 'lucide-react';

interface TimePickerProps {
  isOpen: boolean;
  value: string; // "HH:mm" 格式
  onChange: (value: string) => void;
  onClose: () => void;
  title?: string;
  minuteInterval?: number; // 分钟间隔，默认 15
}

/**
 * 滚轮时间选择器组件
 * 支持小时和分钟的独立滚动选择
 */
export function TimePicker({
  isOpen,
  value,
  onChange,
  onClose,
  title = '选择时间',
  minuteInterval = 15,
}: TimePickerProps) {
  const { hour: initialHour, minute: initialMinute } = parseTimeString(value);
  
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(
    Math.floor(initialMinute / minuteInterval) * minuteInterval
  );

  // 重置状态当 value 变化时
  useEffect(() => {
    const { hour: h, minute: m } = parseTimeString(value);
    setHour(h);
    setMinute(Math.floor(m / minuteInterval) * minuteInterval);
  }, [value, minuteInterval]);

  const handleConfirm = useCallback(() => {
    onChange(formatTimeString(hour, minute));
    onClose();
  }, [hour, minute, onChange, onClose]);

  // 生成选项
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 / minuteInterval }, (_, i) => i * minuteInterval);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 选择器面板 */}
      <div className="relative w-full max-w-sm mx-4 mb-4 bg-surface rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button
            onClick={onClose}
            className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-text-primary font-semibold">{title}</h3>
          <button
            onClick={handleConfirm}
            className="p-2 -mr-2 text-primary hover:text-primary-light transition-colors"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        {/* 滚轮区域 */}
        <div className="flex items-center justify-center py-6 px-8">
          {/* 小时滚轮 */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-text-secondary text-xs mb-2">时</span>
            <WheelPicker
              options={hours}
              value={hour}
              onChange={setHour}
              format={(v) => String(v).padStart(2, '0')}
            />
          </div>

          {/* 分隔符 */}
          <div className="px-4 pt-6">
            <span className="text-text-primary text-2xl font-bold">:</span>
          </div>

          {/* 分钟滚轮 */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-text-secondary text-xs mb-2">分</span>
            <WheelPicker
              options={minutes}
              value={minute}
              onChange={setMinute}
              format={(v) => String(v).padStart(2, '0')}
            />
          </div>
        </div>

        {/* 当前选择显示 */}
        <div className="px-4 pb-4 text-center">
          <p className="text-text-secondary text-sm">
            已选择: <span className="text-primary font-semibold">{formatTimeString(hour, minute)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

interface WheelPickerProps {
  options: number[];
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
}

/**
 * 滚轮选择器子组件
 */
function WheelPicker({ options, value, onChange, format }: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40; // 每项高度
  const visibleCount = 5; // 可见项数

  // 处理滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const newValue = options[Math.max(0, Math.min(index, options.length - 1))];
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [options, value, onChange]);

  // 滚动到当前值
  useEffect(() => {
    if (containerRef.current) {
      const index = options.indexOf(value);
      containerRef.current.scrollTop = index * itemHeight;
    }
  }, [value, options]);

  return (
    <div className="relative h-[200px] w-full">
      {/* 选中高亮条 */}
      <div 
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-10 bg-primary/10 rounded-lg pointer-events-none"
      />
      
      {/* 滚轮容器 */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory"
        onScroll={handleScroll}
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 顶部占位 */}
        <div style={{ height: `${(visibleCount - 1) / 2 * itemHeight}px` }} />
        
        {/* 选项列表 */}
        {options.map((option) => (
          <div
            key={option}
            className="h-10 flex items-center justify-center snap-center cursor-pointer"
            onClick={() => onChange(option)}
          >
            <span 
              className={`text-lg font-medium transition-colors ${
                option === value ? 'text-primary' : 'text-text-secondary'
              }`}
            >
              {format(option)}
            </span>
          </div>
        ))}
        
        {/* 底部占位 */}
        <div style={{ height: `${(visibleCount - 1) / 2 * itemHeight}px` }} />
      </div>
    </div>
  );
}
