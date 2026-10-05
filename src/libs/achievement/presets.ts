import type { AchievementProposal } from '@/db/types';

/**
 * 内置推荐成就（预设）
 * 未配置 API Key 或生成失败时的兜底，走与 LLM 提案相同的「接取」流程
 */
export function buildPresetProposals(
  mostActiveTemplate?: { id: string; title: string }
): AchievementProposal[] {
  const base: AchievementProposal[] = [
    {
      title: 'Baby Steps',
      description: 'Complete 10 tasks and get back into rhythm.',
      icon: 'Target',
      condition: { type: 'task_complete_count', target: 10 },
      rewardPoints: 50,
    },
    {
      title: 'One Hour of Focus',
      description: 'Focus for 60 minutes in total and reclaim your attention.',
      icon: 'Timer',
      condition: { type: 'pomo_focus_minutes', target: 60 },
      rewardPoints: 40,
    },
    {
      title: 'Pomodoro Pro',
      description: 'Focus for 600 minutes in total and make it a habit.',
      icon: 'Flame',
      condition: { type: 'pomo_focus_minutes', target: 600 },
      rewardPoints: 200,
    },
    {
      title: 'Seven-Day Streak',
      description: 'Complete at least one task 7 days in a row.',
      icon: 'Zap',
      condition: { type: 'streak_days', target: 7 },
      rewardPoints: 150,
    },
    {
      title: 'Unstoppable',
      description: 'Keep completing tasks for 30 days straight and make it routine.',
      icon: 'Rocket',
      condition: { type: 'streak_days', target: 30 },
      rewardPoints: 400,
    },
  ];

  if (mostActiveTemplate) {
    base.push({
      title: `${mostActiveTemplate.title}: Next Level`,
      description: 'Push your most frequent task 20 more times.',
      icon: 'Star',
      condition: {
        type: 'task_complete_count',
        target: 20,
        templateId: mostActiveTemplate.id,
      },
      rewardPoints: 80,
    });
  } else {
    base.push({
      title: 'Getting There',
      description: 'Complete 50 tasks in total.',
      icon: 'TrendingUp',
      condition: { type: 'task_complete_count', target: 50 },
      rewardPoints: 150,
    });
  }

  return base;
}
