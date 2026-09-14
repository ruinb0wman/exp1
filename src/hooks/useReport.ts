import { useCallback, useEffect, useRef, useState } from 'react';
import { generateReport } from '@/db/services';
import type { ReportModel, ReportScope } from '@/libs/report/types';

interface UseReportParams {
	userId: number | null;
	scope: ReportScope;
	/** 锚点用户日 YYYY-MM-DD */
	anchor: string;
	customStart?: string;
	customEnd?: string;
}

interface UseReportReturn {
	model: ReportModel | null;
	isLoading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
}

/**
 * 生成并持有当前周期报告
 * 参数变化时重新聚合；用请求序号避免旧请求覆盖新结果
 */
export function useReport(params: UseReportParams): UseReportReturn {
	const { userId, scope, anchor, customStart, customEnd } = params;

	const [model, setModel] = useState<ReportModel | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestId = useRef(0);

	const load = useCallback(async () => {
		if (!userId) {
			setModel(null);
			setError(null);
			setIsLoading(false);
			return;
		}

		const currentRequest = requestId.current + 1;
		requestId.current = currentRequest;

		setIsLoading(true);
		setError(null);
		try {
			const result = await generateReport({ userId, scope, anchor, customStart, customEnd });
			if (requestId.current !== currentRequest) return;
			setModel(result);
		} catch (loadError) {
			if (requestId.current !== currentRequest) return;
			setError(loadError instanceof Error ? loadError.message : '生成报告失败');
			setModel(null);
		} finally {
			if (requestId.current === currentRequest) {
				setIsLoading(false);
			}
		}
	}, [userId, scope, anchor, customStart, customEnd]);

	useEffect(() => {
		void load();
	}, [load]);

	return { model, isLoading, error, refresh: load };
}
