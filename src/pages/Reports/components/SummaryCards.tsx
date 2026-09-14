import { useTranslation } from 'react-i18next';
import type { MetricSet, ReportModel } from '@/libs/report/types';

interface SummaryCardsProps {
	model: ReportModel;
}

interface CardItem {
	label: string;
	value: string;
	delta: string;
	tone?: 'positive' | 'negative' | 'neutral';
}

function formatRate(rate: number | null): string {
	if (rate === null) return '—';
	return `${Math.round(rate * 100)}%`;
}

/** 上期是否有可比数据 */
function hasPreviousData(previous: MetricSet): boolean {
	return (
		previous.plannedCount > 0 ||
		previous.completedCount > 0 ||
		previous.pomoFocusSessions > 0 ||
		previous.pointsEarned > 0 ||
		previous.pointsSpent > 0
	);
}

/** 计数型增减 */
function countDelta(current: number, previous: number, enabled: boolean): string {
	if (!enabled) return '—';
	const diff = current - previous;
	if (diff === 0) return '0';
	return diff > 0 ? `+${diff}` : `${diff}`;
}

function toneOf(delta: string, goodWhenPositive: boolean): CardItem['tone'] {
	if (delta === '—' || delta === '0') return 'neutral';
	const positive = delta.startsWith('+');
	return positive === goodWhenPositive ? 'positive' : 'negative';
}

/**
 * 总览指标卡片（含与上期的环比）
 */
export function SummaryCards({ model }: SummaryCardsProps) {
	const { t } = useTranslation();
	const { metrics, previousMetrics } = model;
	const hasPrev = hasPreviousData(previousMetrics);

	const rateDelta = (() => {
		if (!hasPrev || metrics.completionRate === null || previousMetrics.completionRate === null) {
			return '—';
		}
		const diff = Math.round((metrics.completionRate - previousMetrics.completionRate) * 100);
		if (diff === 0) return '0';
		return diff > 0 ? `+${diff}pp` : `${diff}pp`;
	})();

	const items: CardItem[] = [
		{
			label: t('reports.metric.completionRate'),
			value: formatRate(metrics.completionRate),
			delta: rateDelta,
			tone: toneOf(rateDelta, true),
		},
		{
			label: t('reports.metric.completed'),
			value: `${metrics.completedCount} / ${metrics.plannedCount}`,
			delta: countDelta(metrics.completedCount, previousMetrics.completedCount, hasPrev),
			tone: toneOf(
				countDelta(metrics.completedCount, previousMetrics.completedCount, hasPrev),
				true
			),
		},
		{
			label: t('reports.metric.focusMinutes'),
			value: String(metrics.pomoFocusMinutes),
			delta: countDelta(metrics.pomoFocusMinutes, previousMetrics.pomoFocusMinutes, hasPrev),
			tone: toneOf(
				countDelta(metrics.pomoFocusMinutes, previousMetrics.pomoFocusMinutes, hasPrev),
				true
			),
		},
		{
			label: t('reports.metric.pointsNet'),
			value: String(metrics.pointsNet),
			delta: countDelta(metrics.pointsNet, previousMetrics.pointsNet, hasPrev),
			tone: toneOf(countDelta(metrics.pointsNet, previousMetrics.pointsNet, hasPrev), true),
		},
		{
			label: t('reports.metric.longestStreak'),
			value: String(metrics.longestStreak),
			delta: countDelta(metrics.longestStreak, previousMetrics.longestStreak, hasPrev),
			tone: toneOf(
				countDelta(metrics.longestStreak, previousMetrics.longestStreak, hasPrev),
				true
			),
		},
		{
			label: t('reports.metric.activeDays'),
			value: String(metrics.activeDays),
			delta: countDelta(metrics.activeDays, previousMetrics.activeDays, hasPrev),
			tone: 'neutral',
		},
		{
			label: t('reports.metric.skipped'),
			value: String(metrics.skippedCount),
			delta: countDelta(metrics.skippedCount, previousMetrics.skippedCount, hasPrev),
			tone: toneOf(countDelta(metrics.skippedCount, previousMetrics.skippedCount, hasPrev), false),
		},
		{
			label: t('reports.metric.overdue'),
			value: String(metrics.overdueCount),
			delta: countDelta(metrics.overdueCount, previousMetrics.overdueCount, hasPrev),
			tone: toneOf(countDelta(metrics.overdueCount, previousMetrics.overdueCount, hasPrev), false),
		},
	];

	const toneClass = (tone: CardItem['tone']) => {
		if (tone === 'positive') return 'text-emerald-400';
		if (tone === 'negative') return 'text-primary';
		return 'text-text-muted';
	};

	return (
		<div className="grid grid-cols-2 gap-3">
			{items.map((item) => (
				<div
					key={item.label}
					className="rounded-xl bg-surface p-3 border border-border"
				>
					<p className="text-text-secondary text-xs mb-1">{item.label}</p>
					<p className="text-text-primary text-xl font-bold">{item.value}</p>
					<p className={`text-xs mt-1 ${toneClass(item.tone)}`}>
						{item.delta} · {t('reports.col.previous')}
					</p>
				</div>
			))}
		</div>
	);
}
