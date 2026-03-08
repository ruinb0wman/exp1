import type { ReactNode } from "react";

interface FilterTabsProps<T extends string> {
  options: readonly T[];
  activeFilter: T;
  onFilterChange: (filter: T) => void;
  renderLabel?: (option: T) => ReactNode;
}

export function FilterTabs<T extends string>({
  options,
  activeFilter,
  onFilterChange,
  renderLabel,
}: FilterTabsProps<T>) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onFilterChange(option)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeFilter === option
              ? "bg-primary text-white"
              : "bg-surface text-text-secondary hover:bg-surface-light"
          }`}
        >
          {renderLabel ? renderLabel(option) : option}
        </button>
      ))}
    </div>
  );
}
