import { useTranslation } from 'react-i18next';
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
  onUpdateSettings: (settings: Partial<PomoSettings>) => void | Promise<void>;
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
  const { t } = useTranslation();
  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      position="center"
      title={t('pomo.settings.title')}
    >
      <div className="space-y-6 w-80">
        {/* 时长设置 */}
        <DurationSlider
          label={t('pomo.settings.focusDuration')}
          value={settings.focusDuration}
          min={1}
          max={60}
          unit={t('pomo.minutes')}
          onChange={(val) => onUpdateSettings({ focusDuration: val })}
        />

        <DurationSlider
          label={t('pomo.settings.shortBreakDuration')}
          value={settings.shortBreakDuration}
          min={1}
          max={15}
          unit={t('pomo.minutes')}
          onChange={(val) => onUpdateSettings({ shortBreakDuration: val })}
        />

        <DurationSlider
          label={t('pomo.settings.longBreakDuration')}
          value={settings.longBreakDuration}
          min={5}
          max={30}
          unit={t('pomo.minutes')}
          onChange={(val) => onUpdateSettings({ longBreakDuration: val })}
        />

        <DurationSlider
          label={t('pomo.settings.longBreakInterval')}
          value={settings.longBreakInterval}
          min={2}
          max={8}
          unit={t('pomo.settings.pomoUnit')}
          onChange={(val) => onUpdateSettings({ longBreakInterval: val })}
        />

        {/* 自动开始设置 */}
        <div className="space-y-3 pt-2 border-t border-border">
          <label className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">{t('pomo.settings.autoStartBreaks')}</span>
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
            <span className="text-text-secondary text-sm">{t('pomo.settings.autoStartPomos')}</span>
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
