import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DatePicker } from '@/components/DatePicker';
import { FilterTabs } from '@/components/FilterTabs';
import type { PurchaseScope } from '@/hooks/useRewardPurchases';
import { PURCHASE_SCOPES, formatAnchorLabel, shiftAnchor } from '../lib';

const SCOPE_LABEL: Record<PurchaseScope, string> = {
	month: 'Month',
	year: 'Year',
	custom: 'Custom',
};

interface PeriodSelectorProps {
	scope: PurchaseScope;
	onScopeChange: (scope: PurchaseScope) => void;
	/** 锚点日期（月/年所属周期） */
	anchor: Date;
	onAnchorChange: (date: Date) => void;
	customStart: Date;
	customEnd: Date;
	onCustomRangeChange: (start: Date, end: Date) => void;
}

/**
 * 消费统计周期选择器：月/年/自定义 + 上一期/下一期
 */
export function PeriodSelector({
	scope,
	onScopeChange,
	anchor,
	onAnchorChange,
	customStart,
	customEnd,
	onCustomRangeChange,
}: PeriodSelectorProps) {
	return (
		<div className="mb-4">
			<FilterTabs
				options={PURCHASE_SCOPES}
				activeFilter={scope}
				onFilterChange={onScopeChange}
				renderLabel={(option) => SCOPE_LABEL[option]}
			/>

			{scope === 'custom' ? (
				<div className="flex items-center gap-3">
					<div className="flex-1">
						<p className="text-text-secondary text-xs mb-1">
							Start date
						</p>
						<DatePicker
							value={customStart}
							onChange={(date) => date && onCustomRangeChange(date, customEnd)}
							maxDate={customEnd}
							weekStartsOn={1}
						/>
					</div>
					<div className="flex-1">
						<p className="text-text-secondary text-xs mb-1">
							End date
						</p>
						<DatePicker
							value={customEnd}
							onChange={(date) => date && onCustomRangeChange(customStart, date)}
							minDate={customStart}
							weekStartsOn={1}
						/>
					</div>
				</div>
			) : (
				<div className="flex items-center justify-between gap-2">
					<button
						onClick={() => onAnchorChange(shiftAnchor(scope, anchor, -1))}
						aria-label="Previous"
						className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
					>
						<ChevronLeft className="w-5 h-5" />
					</button>

					<div className="flex-1 text-center">
						<button
							onClick={() => onAnchorChange(new Date())}
							className="text-text-primary font-bold hover:text-primary transition-colors"
						>
							{formatAnchorLabel(scope, anchor)}
						</button>
						<p className="text-text-muted text-xs mt-0.5">
							Back to today
						</p>
					</div>

					<button
						onClick={() => onAnchorChange(shiftAnchor(scope, anchor, 1))}
						aria-label="Next"
						className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
					>
						<ChevronRight className="w-5 h-5" />
					</button>
				</div>
			)}
		</div>
	);
}
