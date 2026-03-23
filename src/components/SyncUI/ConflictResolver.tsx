import { useState } from 'react';
import { ChevronLeft, ChevronRight, Monitor, Smartphone } from 'lucide-react';
import type { FieldConflict, SyncTable } from '@/services/sync';

interface ConflictResolverProps {
  /** 冲突列表 */
  conflicts: FieldConflict[];
  /** 解决完成回调 */
  onResolve: (resolutions: { table: SyncTable; syncId: string; field: string; choice: 'local' | 'remote' }[]) => void;
  /** 取消回调 */
  onCancel: () => void;
}

export function ConflictResolver({
  conflicts,
  onResolve,
  onCancel,
}: ConflictResolverProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Map<string, 'local' | 'remote'>>(new Map());

  const currentConflict = conflicts[currentIndex];
  const totalConflicts = conflicts.length;
  const resolvedCount = resolutions.size;

  const handleChoice = (choice: 'local' | 'remote') => {
    const key = `${currentConflict.syncId}-${currentConflict.field}`;
    const newResolutions = new Map(resolutions);
    newResolutions.set(key, choice);
    setResolutions(newResolutions);

    // 自动进入下一个
    if (currentIndex < totalConflicts - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalConflicts - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleComplete = () => {
    const result = conflicts.map(conflict => {
      const key = `${conflict.syncId}-${conflict.field}`;
      const choice = resolutions.get(key) || 'local';
      return {
        table: conflict.table,
        syncId: conflict.syncId,
        field: conflict.field,
        choice,
      };
    });
    onResolve(result);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '空';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      title: '标题',
      description: '描述',
      points: '积分',
      enabled: '启用状态',
      repeatMode: '重复模式',
      status: '状态',
      startAt: '开始时间',
      endAt: '结束时间',
      name: '名称',
    };
    return labels[field] || field;
  };

  const getTableLabel = (table: SyncTable): string => {
    const labels: Record<SyncTable, string> = {
      taskTemplates: '任务模板',
      taskInstances: '任务实例',
      rewardTemplates: '奖励模板',
      rewardInstances: '奖励实例',
      users: '用户',
      pointsHistory: '积分记录',
    };
    return labels[table] || table;
  };

  const currentKey = `${currentConflict.syncId}-${currentConflict.field}`;
  const currentChoice = resolutions.get(currentKey);

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            解决冲突 ({currentIndex + 1}/{totalConflicts})
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            已解决 {resolvedCount} / {totalConflicts}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          取消
        </button>
      </div>

      {/* 冲突信息 */}
      <div className="flex-1 bg-surface rounded-xl p-4 mb-4">
        <div className="mb-4">
          <span className="text-xs text-text-muted uppercase tracking-wider">
            {getTableLabel(currentConflict.table)}
          </span>
          <h4 className="text-xl font-medium text-text-primary mt-1">
            {getFieldLabel(currentConflict.field)}
          </h4>
        </div>

        {/* 三个版本对比 */}
        <div className="space-y-3">
          {/* 基础版本 */}
          <div className="p-3 bg-surface-light/50 rounded-lg">
            <span className="text-xs text-text-muted">上次同步时的值</span>
            <p className="text-sm text-text-secondary mt-1 font-mono">
              {formatValue(currentConflict.baseValue)}
            </p>
          </div>

          {/* 选择区域 */}
          <div className="grid grid-cols-2 gap-3">
            {/* PC端值 */}
            <button
              onClick={() => handleChoice('local')}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                currentChoice === 'local'
                  ? 'border-primary bg-primary/10'
                  : 'border-surface-light hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-text-primary">PC端</span>
              </div>
              <p className="text-sm text-text-secondary font-mono">
                {formatValue(currentConflict.localValue)}
              </p>
            </button>

            {/* 手机端值 */}
            <button
              onClick={() => handleChoice('remote')}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                currentChoice === 'remote'
                  ? 'border-primary bg-primary/10'
                  : 'border-surface-light hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-text-primary">手机端</span>
              </div>
              <p className="text-sm text-text-secondary font-mono">
                {formatValue(currentConflict.remoteValue)}
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* 导航按钮 */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-4 py-2 text-text-secondary disabled:opacity-30 hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          上一个
        </button>

        <button
          onClick={handleNext}
          disabled={currentIndex === totalConflicts - 1}
          className="flex items-center gap-1 px-4 py-2 text-text-secondary disabled:opacity-30 hover:text-text-primary transition-colors"
        >
          下一个
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 完成按钮 */}
      <button
        onClick={handleComplete}
        className="w-full mt-4 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary-light transition-colors"
      >
        完成 ({resolvedCount}/{totalConflicts})
      </button>
    </div>
  );
}
