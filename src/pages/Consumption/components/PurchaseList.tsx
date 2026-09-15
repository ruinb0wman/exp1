import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReceiptText, Trash2 } from 'lucide-react';
import { DynamicIcon } from '@/components/DynamicIcon';
import { EmptyState } from '@/components/EmptyState';
import { useConfirm } from '@/hooks/useConfirm';
import type { RewardPurchase } from '@/db/types';
import { formatMoney } from '@/libs/reward';
import { formatPurchaseDateTime } from '../lib';

interface PurchaseListProps {
	purchases: RewardPurchase[];
	onDelete: (purchaseId: string) => Promise<void>;
}

/**
 * 消费明细：支持删除记录（回滚积分与消费额度）
 */
export function PurchaseList({ purchases, onDelete }: PurchaseListProps) {
	const { t } = useTranslation();
	const confirm = useConfirm();
	const [deletingId, setDeletingId] = useState<string | null>(null);

	if (purchases.length === 0) {
		return (
			<EmptyState
				icon={<ReceiptText className="w-8 h-8" />}
				title={t('consumption.detail.empty')}
			/>
		);
	}

	const handleDelete = async (purchase: RewardPurchase) => {
		const ok = await confirm({
			title: t('consumption.detail.delete'),
			message: t('consumption.detail.confirmDelete', {
				title: purchase.template.title,
				points: purchase.pointsSpent,
			}),
			confirmLabel: t('consumption.detail.delete'),
			variant: 'danger',
		});
		if (!ok) return;

		setDeletingId(purchase.id);
		try {
			await onDelete(purchase.id);
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			{purchases.map((purchase) => {
				const color = purchase.template.iconColor ?? '#f56565';
				const isDeleting = deletingId === purchase.id;
				return (
					<div
						key={purchase.id}
						className="flex items-center gap-3 rounded-xl bg-surface border border-border p-3"
					>
						<div
							className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
							style={{ backgroundColor: `${color}20` }}
						>
							<DynamicIcon name={purchase.template.icon} color={color} className="w-5 h-5" />
						</div>

						<div className="flex-1 min-w-0">
							<p className="text-text-primary font-medium truncate">
								{purchase.template.title}
								{purchase.quantity > 1 && (
									<span className="text-text-secondary font-normal">
										{' '}
										×{purchase.quantity}
									</span>
								)}
							</p>
							<p className="text-text-muted text-xs">
								{formatPurchaseDateTime(purchase.createdAt)}
							</p>
						</div>

						<div className="text-right shrink-0">
							<p className="text-primary font-bold">-{purchase.pointsSpent}</p>
							<p className="text-green-400 text-xs">
								{formatMoney(purchase.moneyAmount)}
							</p>
						</div>

						<button
							onClick={() => void handleDelete(purchase)}
							disabled={isDeleting}
							aria-label={t('consumption.detail.delete')}
							className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-text-muted hover:text-primary hover:bg-surface-light transition-colors disabled:opacity-40"
						>
							{isDeleting ? (
								<div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
							) : (
								<Trash2 className="w-4 h-4" />
							)}
						</button>
					</div>
				);
			})}
		</div>
	);
}
