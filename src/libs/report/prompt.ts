import type { ReportModel } from './types';

/**
 * 生成报告末尾的「分析提示词」段落，用户可直接连同报告一起发给 LLM
 */
export function buildAnalysisPrompt(model: ReportModel): string {
	const { period } = model;
	const lines = [
		`## 9. Analysis prompt`,
		'',
		`> Send the text below to an LLM together with this report, and attach your Logseq journal for ${period.start} ~ ${period.end}.`,
		'',
		`You are my habit and task review assistant. Attached is my task report from the exp1 app for ${period.label}; I will also paste my Logseq journal for the same period.`,
		'',
		"Requirements:",
		"1. Only rely on the data in the report and journal; never make things up, and state clearly what is missing when data is insufficient.",
		"2. Focus on: days/tasks with abnormal completion rates, tasks that are consistently delayed or repeatedly skipped, mismatches between focus time and output, and trend inflection points or sustained decline.",
		"3. Give at most one actionable suggestion per problem, then propose 1-3 concrete, verifiable adjustments for next week.",
		"4. Output structure: conclusion summary / evidence (cite specific dates and numbers) / suggestions. Answer in English.",
		"5. Compare completion and survival rates across levels: call out first when the low level (L1) was not held, and say whether it squeezed execution at higher levels.",
	];
	return lines.join('\n');
}
