import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useUserStore } from '@/store';
import { useRewardPurchaseActions, useRewardPurchaseStats, type PurchaseScope } from '@/hooks/useRewardPurchases';
import { formatLocalDate } from '@/libs/time';
import { PeriodSelector } from './components/PeriodSelector';
import { SummaryCards } from './components/SummaryCards';
import { TemplateBreakdown } from './components/TemplateBreakdown';
import { PurchaseList } from './components/PurchaseList';

/**
 * 消费统计页：月/年/自定义的消费积分、折合金额、商品占比与明细
 * 购买即消费，明细可删除并回滚积分与消费额度
 */
export function Consumption() {
	const { t } = useTranslation();
	const { user, calculatePoints } = useUserStore();

	const [scope, setScope] = useState<PurchaseScope>('month');
	const [anchor, setAnchor] = useState<Date>(() => new Date());
	const [customStart, setCustomStart] = useState<Date>(() => {
		const date = new Date();
		date.setDate(date.getDate() - 29);
		return date;
	});
	const [customEnd, setCustomEnd] = useState<Date>(() => new Date());

	const anchorStr = formatLocalDate(anchor);
	const customStartStr = formatLocalDate(customStart);
	const customEndStr = formatLocalDate(customEnd);

	const { stats, period, isLoading, error, refresh } = useRewardPurchaseStats({
		userId: user?.id ?? null,
		scope,
		anchor: anchorStr,
		customStart: customStartStr,
		customEnd: customEndStr,
	});
	const { remove } = useRewardPurchaseActions();

	const handleCustomRangeChange = useCallback((start: Date, end: Date) => {
		setCustomStart(start);
		setCustomEnd(end);
	}, []);

	const handleDelete = useCallback(
		async (purchaseId: string) => {
			await remove(purchaseId);
			// 积分余额、消费统计同步刷新
			await calculatePoints();
			await refresh();
		},
		[remove, calculatePoints, refresh]
	);

	const rangeText = useMemo(() => {
		if (!period) return '';
		const partial = period.isPartial
			? t('consumption.meta.partialSuffix', { date: period.end })
			: '';
		return `${period.start} ~ ${period.end}${partial}`;
	}, [period, t]);

	return (
		<div className="min-h-screen bg-background">
			<Header title={t('consumption.title')} back />

			<main className="px-4 pb-24">
				{!user ? (
					<EmptyState icon={<BarChart3 className="w-8 h-8" />} title={t('consumption.title')} />
				) : (
					<>
						<p className="text-text-muted text-xs mb-4">{t('consumption.subtitle')}</p>

						<PeriodSelector
							scope={scope}
							onScopeChange={setScope}
							anchor={anchor}
							onAnchorChange={setAnchor}
							customStart={customStart}
							customEnd={customEnd}
							onCustomRangeChange={handleCustomRangeChange}
						/>

						{isLoading && !stats ? (
							<LoadingState message={t('consumption.loading')} />
						) : error ? (
							<ErrorState
								title={error}
								retryLabel={t('consumption.retry')}
								onRetry={() => void refresh()}
							/>
						) : stats ? (
							<div className="space-y-6">
								<p className="text-text-secondary text-sm">
									<span className="text-text-muted mr-2">{t('consumption.meta.range')}</span>
									{rangeText}
								</p>

								<SummaryCards stats={stats} />

								<section>
									<h2 className="text-text-primary font-bold mb-3">
										{t('consumption.breakdown.title')}
									</h2>
									<TemplateBreakdown
										buckets={stats.byTemplate}
										totalMoney={stats.moneyAmount}
									/>
								</section>

								<section>
									<h2 className="text-text-primary font-bold mb-3">
										{t('consumption.detail.title')}
									</h2>
									<PurchaseList purchases={stats.purchases} onDelete={handleDelete} />
								</section>
							</div>
						) : null}
					</>
				)}
			</main>
		</div>
	);
}

export default Consumption;
