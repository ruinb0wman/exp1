import { Minus, Plus } from "lucide-react";

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
}: NumberInputProps) {
  const config = sizeConfig[size];

  const handleDecrease = () => {
    if (disabled) return;
    const newValue = value - step;
    onChange(Math.max(min, newValue));
  };

  const handleIncrease = () => {
    if (disabled) return;
    const newValue = value + step;
    onChange(Math.min(max, newValue));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const inputValue = e.target.value;

    // 允许空值，但不做处理
    if (inputValue === "") return;

    const num = parseInt(inputValue, 10);
    if (isNaN(num)) return;

    // 限制在 min 和 max 之间
    const clampedValue = Math.max(min, Math.min(max, num));
    onChange(clampedValue);
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
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        className={`${config.input} ${inputWidth || ""} p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-text-primary font-medium disabled:opacity-50`}
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
