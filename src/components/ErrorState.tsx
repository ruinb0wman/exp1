interface ErrorStateProps {
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Failed to load data",
  retryLabel = "Retry",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-muted">
      <p className="text-base font-medium">{title}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-primary hover:text-primary-light"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
