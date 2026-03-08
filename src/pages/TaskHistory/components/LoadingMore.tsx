import { Loader2 } from "lucide-react";

interface LoadingMoreProps {
  isLoadingMore: boolean;
  hasMore: boolean;
  listLength: number;
}

export function LoadingMore({ isLoadingMore, hasMore, listLength }: LoadingMoreProps) {
  if (isLoadingMore) {
    return (
      <div className="flex items-center justify-center gap-2 text-text-secondary">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  if (hasMore) {
    return <div className="h-4" />; // 占位，用于触发滚动加载
  }

  if (listLength > 0) {
    return (
      <p className="text-center text-text-muted text-sm">没有更多记录了</p>
    );
  }

  return null;
}
