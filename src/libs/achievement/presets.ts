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
      title: '小步快跑',
      description: '先完成 10 个任务，找回节奏。',
      icon: 'Target',
      condition: { type: 'task_complete_count', target: 10 },
      rewardPoints: 50,
    },
    {
      title: '专注一小时',
      description: '累计专注 60 分钟，把注意力收回来。',
      icon: 'Timer',
      condition: { type: 'pomo_focus_minutes', target: 60 },
      rewardPoints: 40,
    },
    {
      title: '番茄达人',
      description: '累计专注 600 分钟，让专注变成习惯。',
      icon: 'Flame',
      condition: { type: 'pomo_focus_minutes', target: 600 },
      rewardPoints: 200,
    },
    {
      title: '连击一周',
      description: '连续 7 天都有任务完成记录。',
      icon: 'Zap',
      condition: { type: 'streak_days', target: 7 },
      rewardPoints: 150,
    },
    {
      title: '势不可挡',
      description: '连续 30 天持续完成任务，把它变成日常。',
      icon: 'Rocket',
      condition: { type: 'streak_days', target: 30 },
      rewardPoints: 400,
    },
  ];

  if (mostActiveTemplate) {
    base.push({
      title: `《${mostActiveTemplate.title}》进阶`,
      description: '把最常做的任务再推进 20 次。',
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
      title: '渐入佳境',
      description: '累计完成 50 个任务。',
      icon: 'TrendingUp',
      condition: { type: 'task_complete_count', target: 50 },
      rewardPoints: 150,
    });
  }

  return base;
}
