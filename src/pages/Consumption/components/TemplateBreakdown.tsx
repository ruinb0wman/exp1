import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { DynamicIcon } from '@/components/DynamicIcon';
import { EmptyState } from '@/components/EmptyState';
import type { PurchaseTemplateBucket } from '@/db/services';
import { formatMoney } from '@/libs/reward';
import { formatPercent, getMoneySharePercent } from '../lib';

interface TemplateBreakdownProps {
	buckets: PurchaseTemplateBucket[];
	/** 周期内计入统计的消费总额（元），作为占比分母 */
	totalMoney: number;
}

/**
 * 按商品聚合的消费占比：排名、百分比与占比条都按金额计算
 */
export function TemplateBreakdown({ buckets, totalMoney }: TemplateBreakdownProps) {
	const { t } = useTranslation();

	if (buckets.length === 0) {
		return (
			<EmptyState
				icon={<Package className="w-8 h-8" />}
				title={t('consumption.breakdown.empty')}
			/>
		);
	}

	return (
		<div className="rounded-xl bg-surface p-4 border border-border space-y-4">
			{buckets.map((bucket) => {
				const color = bucket.iconColor ?? '#f56565';
				const percent = getMoneySharePercent(bucket.moneyAmount, totalMoney);
				return (
					<div key={bucket.templateId} className="space-y-2">
						<div className="flex items-center gap-3">
							<div
								className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center"
								style={{ backgroundColor: `${color}20` }}
							>
								<DynamicIcon name={bucket.icon} color={color} className="w-4 h-4" />
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-text-primary font-medium truncate">
									{bucket.title}
								</p>
								<p className="text-text-muted text-xs">
									{t('consumption.breakdown.meta', {
										count: bucket.count,
										quantity: bucket.quantity,
									})}
								</p>
							</div>
							<div className="text-right shrink-0">
								<p className="text-primary font-bold">
									{bucket.pointsSpent.toLocaleString()}
								</p>
								<p className="text-xs">
									<span className="text-green-400">
										{formatMoney(bucket.moneyAmount)}
									</span>
									<span className="text-text-secondary ml-2">
										{formatPercent(percent)}
									</span>
								</p>
							</div>
						</div>
						<div className="h-1.5 rounded-full bg-surface-light overflow-hidden">
							<div
								className="h-full rounded-full transition-all"
								style={{ width: `${percent}%`, backgroundColor: color }}
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
