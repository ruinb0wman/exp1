import { Timer, Volume2, VolumeX, Settings } from 'lucide-react';

interface PomoHeaderProps {
  /** 今日完成的番茄数 */
  todayCount: number;
  /** 是否启用音效 */
  soundEnabled: boolean;
  /** 切换音效回调 */
  onToggleSound: () => void;
  /** 打开设置回调 */
  onOpenSettings: () => void;
}

/**
 * 番茄钟页面头部
 * 显示标题、今日完成计数、音效开关和设置入口
 */
export function PomoHeader({
  todayCount,
  soundEnabled,
  onToggleSound,
  onOpenSettings,
}: PomoHeaderProps) {
  return (
    <header className="px-4 pt-12 pb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Timer className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">番茄钟</h1>
          <p className="text-xs text-text-secondary">今日完成 {todayCount} 个</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSound}
          className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        >
          {soundEnabled ? (
            <Volume2 className="w-5 h-5" />
          ) : (
            <VolumeX className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
