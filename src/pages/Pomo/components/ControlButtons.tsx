import { useTranslation } from 'react-i18next';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';

interface ControlButtonsProps {
  /** 是否正在运行 */
  isRunning: boolean;
  /** 是否已暂停 */
  isPaused: boolean;
  /** 开始计时回调 */
  onStart: () => void;
  /** 暂停计时回调 */
  onPause: () => void;
  /** 恢复计时回调 */
  onResume: () => void;
  /** 重置计时回调 */
  onReset: () => void;
  /** 停止计时回调 */
  onStop: () => void;
  /** 提前完成回调 */
  onComplete: () => void;
}

/**
 * 主控制按钮
 * 根据状态显示开始/暂停/继续按钮
 */
function MainControlButton({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
}: Pick<ControlButtonsProps, 'isRunning' | 'isPaused' | 'onStart' | 'onPause' | 'onResume'>) {
  if (!isRunning) {
    return (
      <button
        onClick={onStart}
        className="w-20 h-20 rounded-full bg-primary hover:bg-primary-light active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/25"
      >
        <Play className="w-8 h-8 text-white ml-1" fill="white" />
      </button>
    );
  }

  if (isPaused) {
    return (
      <button
        onClick={onResume}
        className="w-20 h-20 rounded-full bg-primary hover:bg-primary-light active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/25"
      >
        <Play className="w-8 h-8 text-white ml-1" fill="white" />
      </button>
    );
  }

  return (
    <button
      onClick={onPause}
      className="w-20 h-20 rounded-full bg-primary hover:bg-primary-light active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/25"
    >
      <Pause className="w-8 h-8 text-white" fill="white" />
    </button>
  );
}

/**
 * 控制按钮组
 * 包含重置、主控制（开始/暂停/继续）、停止按钮
 * 以及可选的提前完成按钮
 */
export function ControlButtons({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
  onReset,
  onStop,
  onComplete,
}: ControlButtonsProps) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center justify-center gap-6">
        {/* 重置 */}
        <button
          onClick={onReset}
          disabled={isRunning}
          className="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-6 h-6" />
        </button>

        {/* 主控制 */}
        <MainControlButton
          isRunning={isRunning}
          isPaused={isPaused}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
        />

        {/* 停止 */}
        <button
          onClick={onStop}
          disabled={!isRunning}
          className="w-14 h-14 rounded-full bg-surface flex items-center justify-center text-text-secondary hover:text-primary hover:bg-surface-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Square className="w-6 h-6" fill="currentColor" />
        </button>
      </div>

      {/* 提前完成 */}
      {isRunning && (
        <button
          onClick={onComplete}
          className="w-full mt-4 py-3 text-sm text-text-secondary hover:text-primary transition-colors"
        >
{t('pomo.earlyComplete')}
        </button>
      )}
    </div>
  );
}
