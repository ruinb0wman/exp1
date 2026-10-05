import type { LevelBucket } from '@/libs/report/types';
import { levelBadgeClass } from '@/pages/AllTasks/lib';
import { formatRate, rateClass } from '../lib';

interface LevelTableProps {
	levels: LevelBucket[];
}

/**
 * 按执行等级的执行明细表
 *
 * 「有任务天数 / 全清天数 / 存活率」是天数口径：全清 = 该等级当天全部计划实例都完成
 * （跳过不算），存活率 = 全清天数 ÷ 有任务天数。
 */
export function LevelTable({ levels }: LevelTableProps) {

	if (levels.length === 0) {
		return <p className="text-text-muted text-sm py-6 text-center">No data for this period</p>;
	}

	return (
		<div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
			<table className="w-full text-sm border-collapse min-w-[560px]">
				<thead>
					<tr className="text-text-secondary text-xs">
						<th className="text-left font-medium py-2 pr-2">
							Level
						</th>
						<th className="text-right font-medium py-2 px-2">
							Planned
						</th>
						<th className="text-right font-medium py-2 px-2">
							Completed
						</th>
						<th className="text-right font-medium py-2 px-2">
							Completion rate
						</th>
						<th className="text-right font-medium py-2 px-2">
							Days with tasks
						</th>
						<th className="text-right font-medium py-2 px-2">
							Cleared days
						</th>
						<th className="text-right font-medium py-2 pl-2">
							Survival rate
						</th>
					</tr>
				</thead>
				<tbody>
					{levels.map((bucket) => (
						<tr key={bucket.level} className="border-t border-border">
							<td className="py-2 pr-2">
								<span
									className={`text-xs px-2 py-0.5 rounded-full ${levelBadgeClass(bucket.level)}`}
								>
									L{bucket.level}
								</span>
							</td>
							<td className="py-2 px-2 text-right text-text-secondary">
								{bucket.planned}
							</td>
							<td className="py-2 px-2 text-right text-text-primary font-medium">
								{bucket.completed}
							</td>
							<td
								className={`py-2 px-2 text-right font-medium ${rateClass(bucket.completionRate)}`}
							>
								{formatRate(bucket.completionRate)}
							</td>
							<td className="py-2 px-2 text-right text-text-secondary">
								{bucket.activeDays}
							</td>
							<td className="py-2 px-2 text-right text-text-secondary">
								{bucket.clearedDays}
							</td>
							<td
								className={`py-2 pl-2 text-right font-medium ${rateClass(bucket.survivalRate)}`}
							>
								{formatRate(bucket.survivalRate)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
