interface RadioGroupProps {
  list: string[];
  value: number;
  onChange: (index: number) => void;
}

export function RadioGroup({ list, value, onChange }: RadioGroupProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {list.map((label, index) => (
        <button
          key={index}
          onClick={() => onChange(index)}
          className={`flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors ${
            value === index
              ? "bg-primary text-white"
              : "bg-surface text-text-primary border border-border hover:bg-surface-light"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
