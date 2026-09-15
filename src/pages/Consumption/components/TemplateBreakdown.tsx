import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { DynamicIcon } from '@/components/DynamicIcon';
import { EmptyState } from '@/components/EmptyState';
import type { PurchaseTemplateBucket } from '@/db/services';
import { formatMoney } from '@/libs/reward';
import { getMaxPoints } from '../lib';

interface TemplateBreakdownProps {
	buckets: PurchaseTemplateBucket[];
}

/**
 * 按商品聚合的消费占比
 */
export function TemplateBreakdown({ buckets }: TemplateBreakdownProps) {
	const { t } = useTranslation();

	if (buckets.length === 0) {
		return (
			<EmptyState
				icon={<Package className="w-8 h-8" />}
				title={t('consumption.breakdown.empty')}
			/>
		);
	}

	const maxPoints = getMaxPoints(buckets);

	return (
		<div className="rounded-xl bg-surface p-4 border border-border space-y-4">
			{buckets.map((bucket) => {
				const color = bucket.iconColor ?? '#f56565';
				const percent = maxPoints > 0 ? (bucket.pointsSpent / maxPoints) * 100 : 0;
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
								<p className="text-green-400 text-xs">
									{formatMoney(bucket.moneyAmount)}
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
