import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ACHIEVEMENT_ICONS, type Achievement, type AchievementIconName } from '@/db/types';
import type { AcceptAchievementOverrides } from '@/db/services';
import { DynamicIcon } from '@/components/DynamicIcon';
import { Popup } from '@/components/Popup';
import { NumberInput } from '@/components/NumberInput';
import { formatCondition } from '@/libs/achievement/formatCondition';

interface AchievementAcceptDialogProps {
  isOpen: boolean;
  achievement: Achievement | null;
  templateTitle?: string;
  onClose: () => void;
  onConfirm: (overrides: AcceptAchievementOverrides) => Promise<void>;
}

export function AchievementAcceptDialog({
  isOpen,
  achievement,
  templateTitle,
  onClose,
  onConfirm,
}: AchievementAcceptDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<AchievementIconName>('Trophy');
  const [rewardPoints, setRewardPoints] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && achievement) {
      setTitle(achievement.title);
      setDescription(achievement.description);
      setIcon(achievement.icon);
      setRewardPoints(achievement.rewardPoints);
      setIsSaving(false);
    }
  }, [isOpen, achievement]);

  if (!achievement) return null;

  const conditionText = formatCondition(
    achievement.condition,
    t,
    templateTitle ?? achievement.templateTitleSnapshot
  );

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm({
        title: title.trim() || achievement.title,
        description: description.trim(),
        icon,
        rewardPoints,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popup
      isOpen={isOpen}
      onClose={onClose}
      position="bottom"
      title={t('achievement.acceptTitle')}
      maxHeight="85vh"
      footer={
        <button
          onClick={handleConfirm}
          disabled={isSaving}
          className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('achievement.acceptConfirm')}
        </button>
      }
    >
      <div className="pb-2">
        <div className="rounded-xl bg-surface-light p-3 mb-4">
          <p className="text-text-secondary text-xs mb-1">
            {t('achievement.condition')}
          </p>
          <p className="text-text-primary text-sm font-medium">{conditionText}</p>
          <p className="text-text-muted text-xs mt-1">
            {t('achievement.progressHint')}
          </p>
        </div>

        <label className="block text-text-secondary text-sm mb-2">
          {t('achievement.fieldTitle')}
        </label>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value.slice(0, 40))}
          className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary mb-4"
        />

        <label className="block text-text-secondary text-sm mb-2">
          {t('achievement.fieldDescription')}
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value.slice(0, 120))}
          rows={2}
          className="w-full rounded-xl bg-surface border border-border px-3 py-2.5 text-text-primary focus:outline-none focus:border-primary resize-none mb-4"
        />

        <label className="block text-text-secondary text-sm mb-2">
          {t('achievement.fieldIcon')}
        </label>
        <div className="grid grid-cols-8 gap-2 mb-4">
          {ACHIEVEMENT_ICONS.map((name) => (
            <button
              key={name}
              onClick={() => setIcon(name)}
              className={`aspect-square rounded-lg flex items-center justify-center transition-colors ${
                icon === name
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-surface-light'
              }`}
              aria-label={name}
            >
              <DynamicIcon name={name} className="w-5 h-5" />
            </button>
          ))}
        </div>

        <label className="block text-text-secondary text-sm mb-2">
          {t('achievement.fieldReward')}
        </label>
        <NumberInput
          value={rewardPoints}
          onChange={setRewardPoints}
          min={1}
          max={1000}
          step={5}
          size="lg"
        />
      </div>
    </Popup>
  );
}
