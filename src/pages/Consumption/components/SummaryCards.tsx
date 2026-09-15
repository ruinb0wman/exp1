import { useTranslation } from 'react-i18next';
import { Sparkles, Banknote, ReceiptText } from 'lucide-react';
import type { RewardPurchaseStats } from '@/db/services';
import { formatMoney } from '@/libs/reward';

interface SummaryCardsProps {
	stats: RewardPurchaseStats;
}

/**
 * 消费汇总：积分 / 折合金额 / 笔数
 */
export function SummaryCards({ stats }: SummaryCardsProps) {
	const { t } = useTranslation();

	const cards = [
		{
			key: 'points',
			icon: Sparkles,
			value: stats.pointsSpent.toLocaleString(),
			label: t('consumption.summary.points'),
			tone: 'text-primary',
			bg: 'bg-primary/20',
		},
		{
			key: 'money',
			icon: Banknote,
			value: formatMoney(stats.moneyAmount),
			label: t('consumption.summary.money'),
			tone: 'text-green-400',
			bg: 'bg-green-500/20',
		},
		{
			key: 'count',
			icon: ReceiptText,
			value: stats.count.toLocaleString(),
			label: t('consumption.summary.count', { quantity: stats.quantity }),
			tone: 'text-text-primary',
			bg: 'bg-surface-light',
		},
	];

	return (
		<div className="grid grid-cols-3 gap-3">
			{cards.map((card) => {
				const Icon = card.icon;
				return (
					<div
						key={card.key}
						className="rounded-xl bg-surface border border-border p-4 flex flex-col items-center gap-2"
					>
						<div
							className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.bg} ${card.tone}`}
						>
							<Icon className="w-4 h-4" />
						</div>
						<p className={`text-lg font-bold ${card.tone}`}>{card.value}</p>
						<p className="text-text-muted text-xs text-center leading-tight">
							{card.label}
						</p>
					</div>
				);
			})}
		</div>
	);
}
