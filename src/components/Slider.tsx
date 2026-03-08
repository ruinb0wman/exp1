interface SliderProps {
  /** 当前值 */
  value: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 步长，默认为1 */
  step?: number;
  /** 值变化回调 */
  onChange: (value: number) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 通用滑块组件
 * 基于原生 range input 的样式化封装
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className = '',
  disabled = false,
}: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={`w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    />
  );
}
