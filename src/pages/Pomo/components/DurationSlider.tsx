import { Slider } from "@/components/Slider"

interface DurationSliderProps {
  /** 标签文本 */
  label: string;
  /** 当前值（分钟） */
  value: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 值变化回调 */
  onChange: (value: number) => void;
  /** 单位文本，默认为空（由父组件传入翻译值） */
  unit?: string;
  /** 是否禁用 */
  disabled?: boolean;
}/**
 * 时长滑块组件
 * 基于 Slider 封装的带标签和单位的时长选择器
 */
export function DurationSlider({
  label,
  value,
  min,
  max,
  onChange,
  unit = '',
  disabled = false,
}: DurationSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-medium">
          {value} {unit}
        </span>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
