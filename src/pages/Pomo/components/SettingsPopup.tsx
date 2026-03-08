import { Popup } from '@/components/Popup';
import { DurationSlider } from './DurationSlider';
import type { PomoSettings } from '@/db/types/pomo';

interface SettingsPopupProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 当前设置 */
  settings: PomoSettings;
  /** 更新设置回调 */
  onUpdateSettings: (settings: Partial<PomoSettings>) => void;
}

/**
 * 番茄钟设置弹窗
 * 用于配置专注时长、休息时长等参数
 */
export function SettingsPopup({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: SettingsPopupProps) {
  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      position="center"
      title="番茄钟设置"
    >
      <div className="space-y-6 w-80">
        {/* 时长设置 */}
        <DurationSlider
          label="专注时长"
          value={settings.focusDuration}
          min={5}
          max={60}
          onChange={(val) => onUpdateSettings({ focusDuration: val })}
        />

        <DurationSlider
          label="短休息时长"
          value={settings.shortBreakDuration}
          min={1}
          max={15}
          onChange={(val) => onUpdateSettings({ shortBreakDuration: val })}
        />

        <DurationSlider
          label="长休息时长"
          value={settings.longBreakDuration}
          min={5}
          max={30}
          onChange={(val) => onUpdateSettings({ longBreakDuration: val })}
        />

        <DurationSlider
          label="长休息间隔"
          value={settings.longBreakInterval}
          min={2}
          max={8}
          unit="个番茄"
          onChange={(val) => onUpdateSettings({ longBreakInterval: val })}
        />

        {/* 自动开始设置 */}
        <div className="space-y-3 pt-2 border-t border-border">
          <label className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">自动开始休息</span>
            <button
              onClick={() =>
                onUpdateSettings({ autoStartBreaks: !settings.autoStartBreaks })
              }
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.autoStartBreaks ? 'bg-primary' : 'bg-surface-light'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                  settings.autoStartBreaks ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">自动开始专注</span>
            <button
              onClick={() =>
                onUpdateSettings({ autoStartPomos: !settings.autoStartPomos })
              }
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.autoStartPomos ? 'bg-primary' : 'bg-surface-light'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                  settings.autoStartPomos ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>
    </Popup>
  );
}
