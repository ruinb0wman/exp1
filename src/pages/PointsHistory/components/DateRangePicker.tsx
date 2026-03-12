import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handleQuickSelect = (days: number) => {
    const now = new Date();
    // 使用UTC时间计算日期范围
    const endUTC = now.toISOString();
    const startUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - days,
      0, 0, 0, 0
    )).toISOString();
    onChange(startUTC, endUTC);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border text-text-secondary text-sm hover:bg-surface-light transition-colors"
      >
        <span>
          {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-48 rounded-xl bg-surface border border-border shadow-lg z-50 py-1">
            {[
              { label: "最近7天", days: 7 },
              { label: "最近30天", days: 30 },
              { label: "最近90天", days: 90 },
            ].map((item) => (
              <button
                key={item.days}
                onClick={() => handleQuickSelect(item.days)}
                className="w-full px-4 py-2 text-left text-text-primary hover:bg-surface-light transition-colors text-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
