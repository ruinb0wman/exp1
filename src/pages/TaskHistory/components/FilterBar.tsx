import { useTranslation } from "react-i18next";
import type { TaskHistoryFilterStatus } from "@/hooks/useTaskHistory";
import { filterTabs } from "../lib";

interface FilterBarProps {
  filterStatus: TaskHistoryFilterStatus;
  total: number;
  onFilterChange: (status: TaskHistoryFilterStatus) => void;
}

export function FilterBar({ filterStatus, total, onFilterChange }: FilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="px-4 py-2 flex items-center justify-between sticky top-[60px] bg-background z-10 shrink-0">
      {/* Filter Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterStatus === tab.key
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Total Count */}
      <span className="text-text-muted text-sm">{total} records</span>
    </div>
  );
}