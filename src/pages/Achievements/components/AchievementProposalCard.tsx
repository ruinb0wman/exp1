import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import type { Achievement } from '@/db/types';
import { DynamicIcon } from '@/components/DynamicIcon';
import { formatCondition } from '@/libs/achievement/formatCondition';

interface AchievementProposalCardProps {
  achievement: Achievement;
  templateTitle?: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function AchievementProposalCard({
  achievement,
  templateTitle,
  onAccept,
  onDismiss,
}: AchievementProposalCardProps) {
  const { t } = useTranslation();
  const conditionText = formatCondition(
    achievement.condition,
    t,
    templateTitle ?? achievement.templateTitleSnapshot
  );

  return (
    <div className="rounded-xl border border-border bg-surface p-4 mb-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <DynamicIcon name={achievement.icon} className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-text-primary font-bold">{achievement.title}</h3>
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

      <div className="mt-3 flex gap-2 justify-end">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
        >
          <X className="w-4 h-4" />
          {t('achievement.dismiss')}
        </button>
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors"
        >
          <Check className="w-4 h-4" />
          {t('achievement.accept')}
        </button>
      </div>
    </div>
  );
}
