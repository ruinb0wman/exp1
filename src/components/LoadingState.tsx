interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { spinner: "w-6 h-6", text: "text-xs" },
  md: { spinner: "w-8 h-8", text: "text-sm" },
  lg: { spinner: "w-12 h-12", text: "text-base" },
};

export function LoadingState({
  message = "Loading...",
  size = "md",
}: LoadingStateProps) {
  const { spinner, text } = sizeMap[size];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-muted">
      <div
        className={`${spinner} border-2 border-primary border-t-transparent rounded-full animate-spin`}
      />
      <p className={`${text} mt-4`}>{message}</p>
    </div>
  );
}
