import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { DynamicIcon } from '@/components/DynamicIcon';
import { Popup } from '@/components/Popup';
import { useAchievementStore } from '@/store/achievementStore';

/** 全局解锁提示：依次展示本次新解锁的成就 */
export function AchievementUnlockDialog() {
  const { t } = useTranslation();
  const pendingUnlocks = useAchievementStore((state) => state.pendingUnlocks);
  const shiftUnlock = useAchievementStore((state) => state.shiftUnlock);

  const current = pendingUnlocks[0];
  if (!current) return null;

  return (
    <Popup
      isOpen
      onClose={shiftUnlock}
      position="center"
      showCloseButton={false}
      maskClosable={false}
      hideMask={false}
      width="320px"
    >
      <div className="flex flex-col items-center text-center py-6 px-2">
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl" />
          <div className="relative w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white">
            <DynamicIcon name={current.icon} className="w-12 h-12" />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-primary text-xs font-medium mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          {t('achievement.unlockedBadge')}
        </div>

        <h2 className="text-text-primary text-xl font-bold mb-1">
          {current.title}
        </h2>
        {current.description && (
          <p className="text-text-secondary text-sm mb-3">
            {current.description}
          </p>
        )}

        <p className="text-primary text-2xl font-bold mb-6">
          +{current.rewardPoints}
          <span className="text-sm font-medium ml-1">{t('common.exp')}</span>
        </p>

        <button
          onClick={shiftUnlock}
          className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
        >
          {pendingUnlocks.length > 1
            ? t('achievement.nextUnlock', { n: pendingUnlocks.length - 1 })
            : t('achievement.awesome')}
        </button>
      </div>
    </Popup>
  );
}
