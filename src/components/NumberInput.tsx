import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  applyBounds,
  isTextAllowed,
  resolveBlurValue,
  textToNumber,
  valueToText,
} from "@/libs/numberInput";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  inputWidth?: string;
  className?: string;
  /** 允许输入小数（默认关闭，保持既有调用点行为不变） */
  allowDecimal?: boolean;
}

const sizeConfig = {
  sm: {
    button: "h-6 w-6",
    input: "h-6 w-10 text-sm",
    icon: "w-3 h-3",
    gap: "gap-1.5",
  },
  md: {
    button: "h-7 w-7",
    input: "h-7 w-12 text-base",
    icon: "w-4 h-4",
    gap: "gap-2",
  },
  lg: {
    button: "h-8 w-8",
    input: "h-8 w-14 text-base",
    icon: "w-4 h-4",
    gap: "gap-2",
  },
};

export function NumberInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  label,
  suffix,
  disabled = false,
  size = "md",
  inputWidth,
  className = "",
  allowDecimal = false,
}: NumberInputProps) {
  const config = sizeConfig[size];

  // 输入框由本地文本态驱动：聚焦时可以删到空，失焦时再兜底归一
  const [text, setText] = useState(() => valueToText(value));
  const isFocusedRef = useRef(false);

  // 外部 value 变化时同步文本；聚焦中不同步，避免打断正在进行的输入
  useEffect(() => {
    if (!isFocusedRef.current) setText(valueToText(value));
  }, [value]);

  const commit = (next: number) => {
    onChange(applyBounds(next, min, max, allowDecimal));
  };

  const handleDecrease = () => {
    if (disabled) return;
    commit(value - step);
  };

  const handleIncrease = () => {
    if (disabled) return;
    commit(value + step);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    // 小数键盘在部分区域设置下输出逗号，先归一为小数点
    const raw = allowDecimal ? e.target.value.replace(",", ".") : e.target.value;

    // 非法字符：忽略本次输入，保留上一次文本
    if (!isTextAllowed(raw, allowDecimal, min < 0)) return;

    setText(raw);

    // "" / "-" / "." 这类中间态只改文本，不写回父组件，否则会立刻被夹取成 min 而删不干净
    const num = textToNumber(raw, allowDecimal);
    if (num !== null) commit(num);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const next = resolveBlurValue(text, min, max, allowDecimal);
    setText(valueToText(next));
    commit(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      handleIncrease();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      handleDecrease();
    }
  };

  const isMinReached = value <= min;
  const isMaxReached = value >= max;

  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      {label && (
        <span className="text-text-secondary text-sm shrink-0">{label}</span>
      )}
      <button
        onClick={handleDecrease}
        disabled={disabled || isMinReached}
        className={`${config.button} rounded-full bg-surface-light flex items-center justify-center text-text-primary hover:bg-surface-light/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <Minus className={config.icon} />
      </button>
      <input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={text}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`${config.input} ${inputWidth || ""} p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none text-text-primary font-medium disabled:opacity-50`}
      />
      <button
        onClick={handleIncrease}
        disabled={disabled || isMaxReached}
        className={`${config.button} rounded-full bg-surface-light flex items-center justify-center text-text-primary hover:bg-surface-light/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        <Plus className={config.icon} />
      </button>
      {suffix && (
        <span className="text-text-secondary text-sm shrink-0">{suffix}</span>
      )}
    </div>
  );
}
