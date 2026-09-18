import { useTranslation } from 'react-i18next';
import type { TemplateBucket } from '@/libs/report/types';
import { formatRate, rateClass } from '../lib';

interface TemplateTableProps {
	templates: TemplateBucket[];
}

/**
 * 按任务模板的执行明细表
 */
export function TemplateTable({ templates }: TemplateTableProps) {
	const { t } = useTranslation();

	if (templates.length === 0) {
		return <p className="text-text-muted text-sm py-6 text-center">{t('reports.empty')}</p>;
	}

	return (
		<div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
			<table className="w-full text-sm border-collapse min-w-[520px]">
				<thead>
					<tr className="text-text-secondary text-xs">
						<th className="text-left font-medium py-2 pr-2">
							{t('reports.tasks.col.title')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.tasks.col.planned')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.tasks.col.completed')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.tasks.col.skipped')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.tasks.col.overdue')}
						</th>
						<th className="text-right font-medium py-2 px-2">
							{t('reports.tasks.col.completionRate')}
						</th>
						<th className="text-right font-medium py-2 pl-2">
							{t('reports.tasks.col.focusMinutes')}
						</th>
					</tr>
				</thead>
				<tbody>
					{templates.map((bucket) => {
						const rate = bucket.completionRate;
						const rateClassName = rateClass(rate);

						return (
							<tr key={bucket.templateId} className="border-t border-border">
								<td className="py-2 pr-2 text-text-primary max-w-[180px] truncate">
									{bucket.title}
								</td>
								<td className="py-2 px-2 text-right text-text-secondary">
									{bucket.planned}
								</td>
								<td className="py-2 px-2 text-right text-text-primary font-medium">
									{bucket.completed}
								</td>
								<td className="py-2 px-2 text-right text-text-secondary">
									{bucket.skipped}
								</td>
								<td className="py-2 px-2 text-right text-text-secondary">
									{bucket.overdue}
								</td>
								<td className={`py-2 px-2 text-right font-medium ${rateClassName}`}>
									{formatRate(rate)}
								</td>
								<td className="py-2 pl-2 text-right text-text-secondary">
									{bucket.focusMinutes}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
