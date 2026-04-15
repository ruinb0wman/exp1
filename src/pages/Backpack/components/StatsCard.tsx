import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RewardWithTemplate } from "../lib";

interface StatsCardProps {
  items: RewardWithTemplate[];
}

export function StatsCard({ items }: StatsCardProps) {
  const { t } = useTranslation();
  return (
    <div className="px-4 pb-4">
      <div className="rounded-xl bg-surface p-4 border border-border">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-text-secondary text-sm">{t("backpack.stats.total")}</p>
            <p className="text-text-primary text-2xl font-bold">{items.length}</p>
          </div>
          <div className="text-right">
            <p className="text-green-400 text-sm font-medium">
              {items.filter((i) => i.instance.status === "available").length} {t("backpack.stats.available")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
