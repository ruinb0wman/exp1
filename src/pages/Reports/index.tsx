import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useUserStore } from '@/store/userStore';
import { useReport } from '@/hooks/useReport';
import type { ReportTranslate } from '@/libs/report/prompt';
import type { ReportScope } from '@/libs/report/types';
import { formatLocalDate } from '@/libs/time';
import { PeriodSelector } from './components/PeriodSelector';
import { SummaryCards } from './components/SummaryCards';
import { TrendChart } from './components/TrendChart';
import { TemplateTable } from './components/TemplateTable';
import { ExportActions } from './components/ExportActions';

/**
 * 分析报告页：周/月/年任务执行数据 → Markdown / JSON 导出
 * 报告为纯确定性统计，不调用 LLM
 */
export function Reports() {
	const { t } = useTranslation();
	const { user } = useUserStore();

	const [scope, setScope] = useState<ReportScope>('week');
	const [anchor, setAnchor] = useState<Date>(() => new Date());
	const [customStart, setCustomStart] = useState<Date>(() => {
		const date = new Date();
		date.setDate(date.getDate() - 6);
		return date;
	});
	const [customEnd, setCustomEnd] = useState<Date>(() => new Date());
	const [includePrompt, setIncludePrompt] = useState(true);

	const anchorStr = formatLocalDate(anchor);
	const customStartStr = formatLocalDate(customStart);
	const customEndStr = formatLocalDate(customEnd);

	const { model, isLoading, error, refresh } = useReport({
		userId: user?.id ?? null,
		scope,
		anchor: anchorStr,
		customStart: customStartStr,
		customEnd: customEndStr,
	});

	const translate = useCallback<ReportTranslate>(
		(key, options) => String(t(key, options as never)),
		[t]
	);

	const handleCustomRangeChange = useCallback((start: Date, end: Date) => {
		setCustomStart(start);
		setCustomEnd(end);
	}, []);

	const rangeText = useMemo(() => {
		if (!model) return '';
		const partial = model.period.isPartial
			? t('reports.meta.partialSuffix', { date: model.period.end })
			: '';
		return `${model.period.start} ~ ${model.period.end}${partial}`;
	}, [model, t]);

	return (
		<div className="min-h-screen bg-background">
			<Header title={t('reports.page.title')} back />

			<main className="px-4 pb-24">
				{!user ? (
					<EmptyState
						icon={<BarChart3 className="w-8 h-8" />}
						title={t('reports.page.title')}
					/>
				) : (
					<>
						<p className="text-text-muted text-xs mb-4">{t('reports.page.subtitle')}</p>

						<PeriodSelector
							scope={scope}
							onScopeChange={setScope}
							anchor={anchor}
							onAnchorChange={setAnchor}
							customStart={customStart}
							customEnd={customEnd}
							onCustomRangeChange={handleCustomRangeChange}
						/>

						{isLoading && !model ? (
							<LoadingState message={t('reports.page.loading')} />
						) : error ? (
							<ErrorState
								title={error}
								retryLabel={t('reports.page.retry')}
								onRetry={() => void refresh()}
							/>
						) : model ? (
							<div className="space-y-6">
								<p className="text-text-secondary text-sm">
									<span className="text-text-muted mr-2">{t('reports.summary.range')}</span>
									{rangeText}
								</p>

								<SummaryCards model={model} />

								<section>
									<h2 className="text-text-primary font-bold mb-3">
										{t('reports.section.trend')}
									</h2>
									<div className="rounded-xl bg-surface p-4 border border-border">
										<TrendChart trend={model.trend} />
									</div>
								</section>

								<section>
									<h2 className="text-text-primary font-bold mb-3">
										{t('reports.section.tasks')}
									</h2>
									<div className="rounded-xl bg-surface p-4 border border-border">
										<TemplateTable templates={model.templates} />
									</div>
								</section>

								{model.notes.length > 0 && (
									<section className="rounded-xl bg-surface-light p-4 border border-border">
										<ul className="space-y-1">
											{model.notes.map((note) => (
												<li
													key={note.code}
													className="text-text-secondary text-xs"
												>
													· {t(`reports.notes.${note.code}`, note.params)}
												</li>
											))}
										</ul>
									</section>
								)}

								<ExportActions
									model={model}
									translate={translate}
									includePrompt={includePrompt}
									onIncludePromptChange={setIncludePrompt}
								/>
							</div>
						) : null}
					</>
				)}
			</main>
		</div>
	);
}

export default Reports;
