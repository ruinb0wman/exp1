interface ProgressProps {
  completedCount: number;
  totalCount: number;
}

export function Progress({ completedCount, totalCount }: ProgressProps) {
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="mb-2">
      <p className="text-text-primary text-base font-normal mb-2">
        You've completed {completedCount} of {totalCount} tasks today.
      </p>
      <div className="w-full rounded-full bg-surface h-2">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
