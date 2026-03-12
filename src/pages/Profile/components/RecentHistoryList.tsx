import { History } from "lucide-react";
import type { PointsHistory } from "@/db/types";
import { PointsHistoryCard } from "@/components/PointsHistoryCard";

interface RecentHistoryListProps {
  history: PointsHistory[];
  isLoading: boolean;
}

function HistorySkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border animate-pulse">
      <div className="w-10 h-10 shrink-0 rounded-lg bg-surface-light" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-surface-light rounded w-3/4" />
        <div className="h-3 bg-surface-light rounded w-1/2" />
      </div>
      <div className="h-4 bg-surface-light rounded w-12" />
    </div>
  );
}

function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
      <History className="w-12 h-12 mb-3 opacity-50" />
      <p className="text-base">No recent activity</p>
      <p className="text-sm opacity-70">Complete tasks to see your progress</p>
    </div>
  );
}

export function RecentHistoryList({ history, isLoading }: RecentHistoryListProps) {
  return (
    <>
      <h2 className="text-text-primary text-[22px] font-bold px-4 pb-3 pt-2">
        Recent Activity
      </h2>
      <div className="flex flex-col px-4 gap-2 pb-8">
        {isLoading ? (
          <>
            <HistorySkeleton />
            <HistorySkeleton />
            <HistorySkeleton />
          </>
        ) : history.length === 0 ? (
          <HistoryEmptyState />
        ) : (
          history.map((item) => (
            <PointsHistoryCard key={item.id} item={item} />
          ))
        )}
      </div>
    </>
  );
}
