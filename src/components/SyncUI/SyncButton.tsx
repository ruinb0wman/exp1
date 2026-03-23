import { RefreshCw } from 'lucide-react';

interface SyncButtonProps {
  /** 点击回调 */
  onClick: () => void;
  /** 是否显示徽章（有新数据可同步） */
  showBadge?: boolean;
  /** 自定义类名 */
  className?: string;
}

export function SyncButton({ onClick, showBadge = false, className = '' }: SyncButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-xl bg-surface hover:bg-surface-light transition-colors ${className}`}
      aria-label="同步数据"
    >
      <RefreshCw className="w-5 h-5 text-text-primary" />
      
      {showBadge && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
      )}
    </button>
  );
}
