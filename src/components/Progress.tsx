interface ProgressProps {
	completedCount: number;
	totalCount: number;
	earnedPoints?: number;
	estimatedTotalPoints?: number;
}

export function Progress({
	completedCount,
	totalCount,
	earnedPoints = 0,
	estimatedTotalPoints = 0,
}: ProgressProps) {
	const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

	return (
		<div className="mb-2">
			<div className="flex items-center justify-between mb-2">
				<p className="text-text-primary text-base font-normal">
					You've completed {completedCount} of {totalCount} tasks today.
				</p>
				<p className="text-base font-normal">
					<span className="text-white">{earnedPoints}</span>
					<span className="text-text-secondary mx-1">/</span>
					<span className="text-primary">{estimatedTotalPoints}</span>
				</p>
			</div>
			<div className="w-full rounded-full bg-surface h-2">
				<div
					className="h-2 rounded-full bg-primary transition-all duration-300"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
}
