import { CheckCircle2, Circle, ChevronDown } from 'lucide-react';
import type { TaskWithTemplate } from '@/db/services';

interface TaskSelectorButtonProps {
  /** 当前选中的任务 */
  selectedTask?: TaskWithTemplate;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick: () => void;
}

/**
 * 任务选择按钮
 * 显示当前选中的任务或提示选择任务
 */
export function TaskSelectorButton({
  selectedTask,
  disabled = false,
  onClick,
}: TaskSelectorButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-surface rounded-2xl p-4 flex items-center gap-3 transition-colors hover:bg-surface-light disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        {selectedTask ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : (
          <Circle className="w-5 h-5 text-text-muted" />
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm text-text-secondary">当前专注任务</p>
        <p className="text-white font-medium truncate">
          {selectedTask ? selectedTask.template.title : '未选择任务'}
        </p>
      </div>
      {!disabled && <ChevronDown className="w-5 h-5 text-text-muted" />}
    </button>
  );
}
