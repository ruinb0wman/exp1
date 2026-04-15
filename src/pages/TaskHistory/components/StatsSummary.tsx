import { useTranslation } from "react-i18next";
import type { TaskStats } from "@/hooks/useTaskHistory";

interface StatsSummaryProps {
  stats: TaskStats | null;
  isLoading: boolean;
}

export function StatsSummary({ stats, isLoading }: StatsSummaryProps) {
  const { t } = useTranslation();

  const items = [
    { label: t("stats.all"), value: stats?.total ?? 0, colorClass: "text-text-primary" },
    { label: t("stats.pending"), value: stats?.pending ?? 0, colorClass: "text-primary" },
    { label: t("stats.completed"), value: stats?.completed ?? 0, colorClass: "text-green-500" },
    { label: t("stats.skipped"), value: stats?.skipped ?? 0, colorClass: "text-text-muted" },
  ];

  return (
    <div className="px-4 py-3 shrink-0">
      <div className="rounded-xl bg-surface border border-border p-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-text-secondary text-xs mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${item.colorClass}`}>
                {isLoading ? "-" : item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}