import { useTranslation } from 'react-i18next';
import { CheckCircle2, Sparkles, Trash2 } from 'lucide-react';
import type { Achievement } from '@/db/types';
import { DynamicIcon } from '@/components/DynamicIcon';
import { formatCondition } from '@/libs/achievement/formatCondition';
import { formatUnlockTime } from '../lib';

interface AchievementCardProps {
  achievement: Achievement;
  templateTitle?: string;
  onAbandon?: () => void;
}

export function AchievementCard({
  achievement,
  templateTitle,
  onAbandon,
}: AchievementCardProps) {
  const { t } = useTranslation();
  const isUnlocked = achievement.status === 'unlocked';
  const target = achievement.condition.target;
  const progress = Math.min(achievement.progress, target);
  const percent = target > 0 ? Math.round((progress / target) * 100) : 0;
  const conditionText = formatCondition(
    achievement.condition,
    t,
    templateTitle ?? achievement.templateTitleSnapshot
  );

  return (
    <div
      className={`rounded-xl border p-4 mb-3 ${
        isUnlocked
          ? 'bg-primary/10 border-primary/40'
          : achievement.orphaned
            ? 'bg-surface border-border opacity-70'
            : 'bg-surface border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center ${
            isUnlocked ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
          }`}
        >
          <DynamicIcon name={achievement.icon} className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-text-primary font-bold truncate">
              {achievement.title}
            </h3>
            {isUnlocked && (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            )}
          </div>
          {achievement.description && (
            <p className="text-text-secondary text-sm mt-0.5">
              {achievement.description}
            </p>
          )}
          <p className="text-text-muted text-xs mt-1">{conditionText}</p>

          {achievement.orphaned && (
            <p className="text-yellow-500 text-xs mt-1">
              {t('achievement.orphaned')}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-primary font-bold text-sm">
            +{achievement.rewardPoints}
          </p>
          <p className="text-text-muted text-xs">{t('common.exp')}</p>
        </div>
      </div>

      {!isUnlocked && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-text-secondary text-xs">
              {t('achievement.progress')}
            </span>
            <span className="text-text-primary text-xs font-medium">
              {progress} / {target}
            </span>
          </div>
          <div className="w-full rounded-full bg-surface-light h-2">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {isUnlocked && achievement.unlockedAt && (
        <div className="mt-3 flex items-center gap-1.5 text-text-muted text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          {t('achievement.unlockedAt', { time: formatUnlockTime(achievement.unlockedAt) })}
        </div>
      )}

      {onAbandon && !isUnlocked && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onAbandon}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:text-primary hover:bg-surface-light transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('achievement.abandon')}
          </button>
        </div>
      )}
    </div>
  );
}
