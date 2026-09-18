import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation();

	if (levels.length === 0) {
		return <p className="text-text-muted text-sm py-6 text-center">{t('reports.empty')}</p>;
	}

	return (
		<div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
			<table className="w-full text-sm border-collapse min-w-[560px]">
				<thead>
					<tr className="text-text-secondary text-xs">
						<th className="text-left font-medium py-2 pr-2">
							{t('reports.levels.col.level')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.levels.col.planned')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.levels.col.completed')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.levels.col.completionRate')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.levels.col.activeDays')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.levels.col.clearedDays')}
						</th>
						<th className="text-right font-medium py-2 pl-2">
							{t('reports.levels.col.survivalRate')}
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
