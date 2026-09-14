import { useTranslation } from 'react-i18next';
import type { TrendBucket } from '@/libs/report/types';

interface TrendChartProps {
	trend: TrendBucket[];
}

/**
 * 趋势迷你柱状图（纯 CSS，无图表库依赖）
 * 背景条 = 计划数，前景条 = 完成数
 */
export function TrendChart({ trend }: TrendChartProps) {
	const { t } = useTranslation();

	if (trend.length === 0) {
		return <p className="text-text-muted text-sm py-6 text-center">{t('reports.empty')}</p>;
	}

	const maxPlanned = Math.max(...trend.map((bucket) => bucket.planned), 1);

	return (
		<div className="overflow-x-auto scrollbar-hide">
			<div className="flex items-end gap-1 min-w-full h-32 pt-2">
				{trend.map((bucket) => {
					const plannedHeight = Math.round((bucket.planned / maxPlanned) * 100);
					const completedHeight =
						bucket.planned > 0
							? Math.round((bucket.completed / bucket.planned) * plannedHeight)
							: 0;
					const shortLabel = bucket.key.slice(5);

					return (
						<div
							key={bucket.key}
							className="flex-1 min-w-6 h-full flex flex-col"
							title={`${bucket.label}: ${bucket.completed}/${bucket.planned} · ${bucket.focusMinutes}min · ${bucket.pointsNet}pt`}
						>
							<div className="flex-1 flex items-end w-full">
								<div
									className="relative w-full rounded-t bg-surface-light"
									style={{ height: `${Math.max(plannedHeight, 2)}%` }}
								>
									<div
										className="absolute bottom-0 left-0 right-0 rounded-t bg-primary"
										style={{ height: `${completedHeight}%` }}
									/>
								</div>
							</div>
							<span className="text-text-muted text-[9px] mt-1 whitespace-nowrap">
								{shortLabel}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
