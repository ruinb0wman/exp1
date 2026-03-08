import { Popup } from '@/components/Popup';
import { CheckCircle2, Circle } from 'lucide-react';
import type { TaskWithTemplate } from '@/hooks/useTasks';

interface TaskSelectorProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 任务列表 */
  tasks: TaskWithTemplate[];
  /** 当前选中的任务ID */
  selectedTaskId: number | null;
  /** 选择任务回调 */
  onSelectTask: (taskId: number | null) => void;
}

/**
 * 任务选择弹窗
 * 用于选择当前番茄钟要专注的任务
 */
export function TaskSelector({
  isOpen,
  onClose,
  tasks,
  selectedTaskId,
  onSelectTask,
}: TaskSelectorProps) {
  const handleSelectTask = (taskId: number | null) => {
    onSelectTask(taskId);
    onClose();
  };

  // 只显示状态为 pending 且 completeRule 为 time 的任务
  const pendingTasks = tasks.filter(
    t => t.instance.status === 'pending' && t.template.completeRule === 'time'
  );

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      position="bottom"
      title="选择专注任务"
    >
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {/* 自由专注选项 */}
        <button
          onClick={() => handleSelectTask(null)}
          className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${
            selectedTaskId === null ? 'bg-primary/10' : 'hover:bg-surface-light'
          }`}
        >
          <Circle
            className={`w-5 h-5 ${
              selectedTaskId === null ? 'text-primary' : 'text-text-muted'
            }`}
          />
          <span
            className={
              selectedTaskId === null
                ? 'text-primary font-medium'
                : 'text-text-primary'
            }
          >
            自由专注
          </span>
        </button>

        {/* 待办任务列表 */}
        {pendingTasks.map(({ instance, template }) => (
          <button
            key={instance.id}
            onClick={() => handleSelectTask(instance.id!)}
            className={`w-full p-3 rounded-xl flex items-center gap-3 transition-colors ${
              selectedTaskId === instance.id
                ? 'bg-primary/10'
                : 'hover:bg-surface-light'
            }`}
          >
            {selectedTaskId === instance.id ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5 text-text-muted" />
            )}
            <span
              className={
                selectedTaskId === instance.id
                  ? 'text-primary font-medium'
                  : 'text-text-primary'
              }
            >
              {template.title}
            </span>
          </button>
        ))}

        {/* 空状态 */}
        {pendingTasks.length === 0 && (
          <p className="text-center text-text-muted py-4">今日没有待办任务</p>
        )}
      </div>
    </Popup>
  );
}
