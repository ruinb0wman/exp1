import { useTranslation } from "react-i18next";
import { RefreshCw } from 'lucide-react';

interface SyncButtonProps {
  onClick: () => void;
  showBadge?: boolean;
  className?: string;
}

export function SyncButton({ onClick, showBadge = false, className = '' }: SyncButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-xl bg-surface hover:bg-surface-light transition-colors ${className}`}
      aria-label={t("syncButton.syncData")}
    >
      <RefreshCw className="w-5 h-5 text-text-primary" />
      
      {showBadge && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </button>
  );
}
