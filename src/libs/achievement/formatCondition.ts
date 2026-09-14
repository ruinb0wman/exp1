import type { TFunction } from 'i18next';
import type { AchievementCondition } from '@/db/types';

/**
 * 将成就条件格式化为用户可读的短句
 * 例：「累计完成 100 个任务」/「《晨跑》累计专注 600 分钟」
 */
export function formatCondition(
  condition: AchievementCondition,
  t: TFunction,
  templateTitle?: string
): string {
  const scope = templateTitle
    ? t('achievement.conditions.scopeTemplate', { title: templateTitle })
    : t('achievement.conditions.scopeAll');

  const baseKey =
    condition.type === 'task_complete_count' && condition.taskType
      ? 'achievement.conditions.task_complete_count_typed'
      : `achievement.conditions.${condition.type}`;

  return t(baseKey, {
    scope,
    target: condition.target,
    type: condition.taskType ? t(`achievement.taskTypes.${condition.taskType}`) : '',
  });
}
