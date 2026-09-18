import type { ReportModel } from './types';

/** 翻译函数（i18next 的 t 或测试中的替身） */
export type ReportTranslate = (key: string, options?: Record<string, unknown>) => string;

/**
 * 生成报告末尾的「分析提示词」段落，用户可直接连同报告一起发给 LLM
 */
export function buildAnalysisPrompt(model: ReportModel, t: ReportTranslate): string {
	const { period } = model;
	const lines = [
		`## 9. ${t('reports.section.prompt')}`,
		'',
		`> ${t('reports.prompt.hint', { start: period.start, end: period.end })}`,
		'',
		t('reports.prompt.intro', { period: period.label }),
		'',
		t('reports.prompt.requirementsTitle'),
		t('reports.prompt.requirement1'),
		t('reports.prompt.requirement2'),
		t('reports.prompt.requirement3'),
		t('reports.prompt.requirement4'),
		t('reports.prompt.requirement5'),
	];
	return lines.join('\n');
}
