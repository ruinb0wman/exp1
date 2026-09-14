import { describe, it, expect, afterAll } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/libs/i18n';
import type { AchievementCondition } from '@/db/types';
import { formatCondition } from './formatCondition';

const t = i18n.t.bind(i18n) as unknown as TFunction;

function condition(
  type: AchievementCondition['type'],
  target: number,
  extra: Partial<AchievementCondition> = {}
): AchievementCondition {
  return { type, target, ...extra };
}

afterAll(async () => {
  await i18n.changeLanguage('zh');
});

describe('formatCondition', () => {
  it('全局成就文案（中文）', async () => {
    await i18n.changeLanguage('zh');
    expect(formatCondition(condition('task_complete_count', 100), t)).toBe(
      '累计完成 100 个任务'
    );
    expect(formatCondition(condition('pomo_focus_minutes', 600), t)).toBe(
      '累计专注 600 分钟'
    );
    expect(formatCondition(condition('streak_days', 7), t)).toBe('连续 7 天完成任务');
    expect(formatCondition(condition('reward_redeem_count', 5), t)).toBe('兑换 5 次奖励');
  });

  it('绑定任务的成就文案会带上任务标题（中文）', async () => {
    await i18n.changeLanguage('zh');
    expect(
      formatCondition(condition('task_complete_count', 20, { templateId: 't1' }), t, '晨跑')
    ).toBe('《晨跑》累计完成 20 个任务');
  });

  it('带任务类型过滤时使用专门的文案（中文）', async () => {
    await i18n.changeLanguage('zh');
    expect(
      formatCondition(condition('task_complete_count', 10, { taskType: 'time' }), t)
    ).toBe('累计完成 10 个计时任务');
  });

  it('英文文案', async () => {
    await i18n.changeLanguage('en');
    expect(formatCondition(condition('task_complete_count', 100), t)).toBe(
      'Complete 100 tasks in total'
    );
    expect(formatCondition(condition('daily_task_count', 5), t)).toBe(
      'Complete 5 tasks in one day'
    );
  });
});
