import { useState } from 'react';
import { CheckCircle2, FileJson, FileText, Loader2 } from 'lucide-react';
import { fileSystem } from '@/libs/fileSystem';
import { generateReportFilename, renderReportJson } from '@/db/services';
import { renderReportMarkdown } from '@/libs/report/renderMarkdown';
import type { ReportModel } from '@/libs/report/types';

interface ExportActionsProps {
	model: ReportModel;
	includePrompt: boolean;
	onIncludePromptChange: (value: boolean) => void;
}

type ExportStatus = 'idle' | 'success' | 'cancelled' | 'failed';

/**
 * 导出按钮组：Markdown（喂 LLM）/ JSON（机器可读）
 */
export function ExportActions({
	model,
	includePrompt,
	onIncludePromptChange,
}: ExportActionsProps) {
	const [exporting, setExporting] = useState<'md' | 'json' | null>(null);
	const [status, setStatus] = useState<ExportStatus>('idle');

	const handleExport = async (format: 'md' | 'json') => {
		setExporting(format);
		setStatus('idle');
		try {
			const content =
				format === 'md'
					? renderReportMarkdown(model, { includePrompt })
					: renderReportJson(model);

			const saved = await fileSystem.saveFile({
				content,
				filename: generateReportFilename(model, format),
				mimeType: format === 'md' ? 'text/markdown' : 'application/json',
				extensions: [format],
			});

			setStatus(saved ? 'success' : 'cancelled');
		} catch (error) {
			console.error('[Reports] export failed:', error);
			setStatus('failed');
		} finally {
			setExporting(null);
		}
	};

	const statusText = (() => {
		switch (status) {
			case 'success':
				return { text: "Report saved", className: 'text-emerald-400' };
			case 'cancelled':
				return { text: "Save cancelled", className: 'text-text-muted' };
			case 'failed':
				return { text: "Failed to save", className: 'text-primary' };
			default:
				return null;
		}
	})();

	return (
		<div className="rounded-xl bg-surface p-4 border border-border">
			<label className="flex items-center gap-3 mb-4 cursor-pointer select-none">
				<input
					type="checkbox"
					checked={includePrompt}
					onChange={(event) => onIncludePromptChange(event.target.checked)}
					className="custom-checkbox"
				/>
				<span className="text-text-secondary text-sm">
					Append analysis prompt
				</span>
			</label>

			<div className="flex gap-3">
				<button
					onClick={() => handleExport('md')}
					disabled={exporting !== null}
					className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-white py-3 font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
				>
					{exporting === 'md' ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<FileText className="w-4 h-4" />
					)}
					Export Markdown
				</button>
				<button
					onClick={() => handleExport('json')}
					disabled={exporting !== null}
					className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-surface-light text-text-primary py-3 font-medium hover:bg-border transition-colors disabled:opacity-50"
				>
					{exporting === 'json' ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<FileJson className="w-4 h-4" />
					)}
					Export JSON
				</button>
			</div>

			{exporting !== null && (
				<p className="text-text-muted text-xs mt-3 text-center">
					Exporting…
				</p>
			)}

			{statusText && exporting === null && (
				<p className={`text-xs mt-3 flex items-center justify-center gap-1 ${statusText.className}`}>
					{status === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
					{statusText.text}
				</p>
			)}
		</div>
	);
}
