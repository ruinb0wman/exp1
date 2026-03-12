import { CheckCircle2, AlertCircle } from "lucide-react";
import type { RewardInstance } from "@/db/types";

interface StatusBadgeProps {
  status: RewardInstance["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case "available":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          可用
        </span>
      );
    case "used":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          已使用
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3 h-3" />
          已过期
        </span>
      );
  }
}
