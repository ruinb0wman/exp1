import { Calendar } from "lucide-react";

interface StatsSummaryProps {
  enabledCount: number;
  totalCount: number;
  onCalendarClick?: () => void;
}

export function StatsSummary({
  enabledCount,
  totalCount,
  onCalendarClick,
}: StatsSummaryProps) {
  return (
    <div className="flex items-center justify-between text-text-secondary text-sm">
      <span>
        {enabledCount} of {totalCount} enabled
      </span>
      {onCalendarClick && (
        <button
          onClick={onCalendarClick}
          className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors"
        >
          <Calendar className="w-4 h-4" />
          <span>Calendar View</span>
        </button>
      )}
    </div>
  );
}
