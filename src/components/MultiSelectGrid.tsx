interface MultiSelectGridItem {
  label: string;
  value: number;
}

interface MultiSelectGridProps {
  list: MultiSelectGridItem[];
  value: number[];
  onChange: (value: number) => void;
  maxCol?: number;
  /** 选项宽度，默认 "auto" 表示自适应，可传入具体值如 "2.25rem"、"36px"、"100%" */
  itemWidth?: "auto" | string;
}

export function MultiSelectGrid({
  list,
  value,
  onChange,
  maxCol = 7,
  itemWidth = "auto",
}: MultiSelectGridProps) {
  const gridStyle = {
    gridTemplateColumns:
      itemWidth === "auto"
        ? `repeat(${maxCol}, minmax(0, 1fr))`
        : `repeat(${maxCol}, ${itemWidth})`,
  };

  return (
    <div className="grid gap-2" style={gridStyle}>
      {list.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={`h-9 rounded-full text-sm font-medium transition-colors ${
            value.includes(item.value)
              ? "bg-primary text-white"
              : "bg-surface-light text-text-secondary hover:bg-surface-light/80"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
