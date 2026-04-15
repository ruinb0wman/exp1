import { CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RewardInstance } from "@/db/types";

interface StatusBadgeProps {
  status: RewardInstance["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  switch (status) {
    case "available":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          {t("backpack.status.available")}
        </span>
      );
    case "used":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          {t("backpack.status.used")}
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3 h-3" />
          {t("backpack.status.expired")}
        </span>
      );
  }
}
