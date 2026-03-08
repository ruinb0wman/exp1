import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // 按 ESC 键取消
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "text-red-400",
      iconBg: "bg-red-400/10",
      confirmBtn: "bg-red-500 hover:bg-red-600 text-white",
    },
    warning: {
      icon: "text-orange-400",
      iconBg: "bg-orange-400/10",
      confirmBtn: "bg-orange-500 hover:bg-orange-600 text-white",
    },
    info: {
      icon: "text-blue-400",
      iconBg: "bg-blue-400/10",
      confirmBtn: "bg-primary hover:bg-primary-light text-white",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-surface rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-light transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}
        >
          <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          {message}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-light text-text-primary font-medium hover:bg-surface-light/80 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${styles.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
