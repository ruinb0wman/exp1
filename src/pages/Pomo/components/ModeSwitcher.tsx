import { PomoMode, POMO_MODE_CONFIG } from '@/db/types/pomo';

interface ModeSwitcherProps {
  /** 当前模式 */
  currentMode: PomoMode;
  /** 是否正在运行（禁用切换） */
  isRunning: boolean;
  /** 切换模式回调 */
  onModeChange: (mode: PomoMode) => void;
}

/**
 * 模式切换按钮
 */
function ModeButton({
  targetMode,
  currentMode,
  isRunning,
  onClick,
}: {
  targetMode: PomoMode;
  currentMode: PomoMode;
  isRunning: boolean;
  onClick: () => void;
}) {
  const config = POMO_MODE_CONFIG[targetMode];
  const isActive = currentMode === targetMode;

  return (
    <button
      onClick={onClick}
      disabled={isRunning}
      className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
        isActive
          ? 'bg-surface-light text-white'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
      } ${isRunning && !isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {config.label}
    </button>
  );
}

/**
 * 模式切换器
 * 用于切换专注/短休息/长休息三种模式
 */
export function ModeSwitcher({
  currentMode,
  isRunning,
  onModeChange,
}: ModeSwitcherProps) {
  return (
    <div className="px-4 mt-4">
      <div className="bg-surface rounded-2xl p-1.5 flex gap-1">
        <ModeButton
          targetMode="focus"
          currentMode={currentMode}
          isRunning={isRunning}
          onClick={() => onModeChange('focus')}
        />
        <ModeButton
          targetMode="shortBreak"
          currentMode={currentMode}
          isRunning={isRunning}
          onClick={() => onModeChange('shortBreak')}
        />
        <ModeButton
          targetMode="longBreak"
          currentMode={currentMode}
          isRunning={isRunning}
          onClick={() => onModeChange('longBreak')}
        />
      </div>
    </div>
  );
}
