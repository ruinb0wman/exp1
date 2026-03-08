import { Plus } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({
  icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-muted">
      <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
        {icon || <Plus className="w-8 h-8" />}
      </div>
      <p className="text-base font-medium">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
    </div>
  );
}
