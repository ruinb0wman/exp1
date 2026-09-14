import type { Achievement } from '@/db/types';
import { formatLocalDateTime } from '@/libs/time';

export type AchievementTab = 'proposed' | 'active' | 'unlocked';

export const ACHIEVEMENT_TABS: AchievementTab[] = ['proposed', 'active', 'unlocked'];

export function formatUnlockTime(iso?: string): string {
  if (!iso) return '';
  return formatLocalDateTime(iso);
}

/** 取当前生效的模板标题：优先实时标题，其次生成时的快照 */
export function resolveTemplateTitle(
  achievement: Achievement,
  templateTitles: Map<string, string>
): string | undefined {
  if (!achievement.condition.templateId) return undefined;
  return (
    templateTitles.get(achievement.condition.templateId) ??
    achievement.templateTitleSnapshot
  );
}
