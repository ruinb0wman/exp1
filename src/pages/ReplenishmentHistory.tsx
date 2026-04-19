import { useMemo } from "react";
import { useParams } from "react-router";
import { Loader2, ArrowUpDown, Package } from "lucide-react";
import { Header } from "@/components/Header";
import { useRewardTemplate } from "@/hooks/useRewards";
import { useReplenishmentHistory } from "@/hooks/useRewards";

function formatDateTime(isoString: string | undefined) {
	if (!isoString) return { dateStr: "", timeStr: "" };
	const date = new Date(isoString);
	if (isNaN(date.getTime())) return { dateStr: "", timeStr: "" };
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const h = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return { dateStr: `${y}-${m}-${d}`, timeStr: `${h}:${min}` };
}

function formatDateLabel(isoString: string | undefined) {
	if (!isoString) return "Unknown";
	const date = new Date(isoString);
	if (isNaN(date.getTime())) return "Unknown";
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	const isToday = date.toDateString() === today.toDateString();
	const isYesterday = date.toDateString() === yesterday.toDateString();

	if (isToday) return "Today";
	if (isYesterday) return "Yesterday";

	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function ReplenishmentHistory() {
	const { templateId } = useParams<{ templateId: string }>();

	const { template, isLoading: isLoadingTemplate } = useRewardTemplate(templateId ?? null);
	const { records, isLoading: isLoadingRecords } = useReplenishmentHistory(templateId ?? "");

	const isLoading = isLoadingTemplate || isLoadingRecords;

	const grouped = useMemo(() => {
		const map = new Map<string, typeof records>();
		for (const r of records) {
			const { dateStr } = formatDateTime(r.createdAt);
			if (!dateStr) continue;
			if (!map.has(dateStr)) map.set(dateStr, []);
			map.get(dateStr)!.push(r);
		}
		return map;
	}, [records]);

	const title = template?.title ?? "Replenishment History";

	return (
		<div className="min-h-screen bg-background">
			<Header title={title} back />

			{/* 当前库存概览 */}
			{template && (
				<div className="px-4 pt-2 pb-4">
					<div className="rounded-xl bg-surface p-4 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="text-primary flex items-center justify-center rounded-lg bg-primary/20 shrink-0 size-10">
								<Package className="w-5 h-5" />
							</div>
							<div>
								<p className="text-text-secondary text-xs">Current Stock</p>
								<p className="text-text-primary text-lg font-bold">
									{template.currentStock ?? 0}
									{template.replenishmentLimit !== undefined && (
										<span className="text-text-muted text-sm font-normal"> / {template.replenishmentLimit}</span>
									)}
								</p>
							</div>
						</div>
						<div className="text-right">
							<p className="text-text-secondary text-xs">Total Records</p>
							<p className="text-text-primary text-lg font-bold">{records.length}</p>
						</div>
					</div>
				</div>
			)}

			{/* 历史记录列表 */}
			<div className="px-4 pb-8">
				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="w-6 h-6 text-primary animate-spin" />
					</div>
				) : records.length === 0 ? (
					<div className="text-center py-12 text-text-secondary">
						<ArrowUpDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
						<p>No replenishment records yet</p>
						{template?.replenishmentMode !== "none" && (
							<p className="text-text-muted text-sm mt-1">
								Records will be created automatically on next restock
							</p>
							)}
					</div>
				) : (
					<div className="flex flex-col gap-4">
					{Array.from(grouped.entries()).map(([dateStr, dayRecords]) => (
						<div key={dateStr}>
							<p className="text-text-muted text-xs font-medium mb-2 sticky top-0 bg-background py-1">
								{formatDateLabel(dateStr)}
							</p>
							<div className="flex flex-col gap-2">
								{dayRecords.map((record) => {
									const { timeStr } = formatDateTime(record.createdAt);
									const scheduledLabel = formatDateLabel(record.scheduledDate);
									return (
										<div
											key={record.id}
											className="rounded-xl bg-surface p-4 flex items-center justify-between"
										>
											<div className="flex items-center gap-3">
												<div className="flex flex-col items-center justify-center w-12">
													<span className="text-text-primary text-sm font-bold">
														+{record.quantity}
													</span>
													<span className="text-text-muted text-xs">
														{timeStr}
													</span>
												</div>
												<div>
													<p className="text-text-primary text-sm">
														{record.reason === "auto" ? "Auto Restock" : "Manual Restock"}
													</p>
													<p className="text-text-muted text-xs">
														{scheduledLabel}
													</p>
												</div>
											</div>
											<span
												className={`text-xs px-2 py-1 rounded-full ${
													record.reason === "auto"
														? "bg-primary/10 text-primary"
														: "bg-green-500/10 text-green-500"
												}`}
											>
												{record.reason === "auto" ? "AUTO" : "MANUAL"}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					))}
					</div>
				)}
			</div>
		</div>
	);
}
