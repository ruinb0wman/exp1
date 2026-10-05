import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_CONDITION_TYPES, type AchievementCondition } from '@/db/types';
import { formatCondition } from './formatCondition';

function condition(
  type: AchievementCondition['type'],
  target: number,
  extra: Partial<AchievementCondition> = {}
): AchievementCondition {
  return { type, target, ...extra };
}

describe('formatCondition', () => {
  it('全局成就文案', () => {
    expect(formatCondition(condition('task_complete_count', 100))).toBe(
      'Complete 100 tasks in total'
    );
    expect(formatCondition(condition('pomo_focus_minutes', 600))).toBe(
      'Focus for 600 minutes in total'
    );
    expect(formatCondition(condition('streak_days', 7))).toBe(
      'Complete tasks 7 days in a row'
    );
    expect(formatCondition(condition('reward_redeem_count', 5))).toBe(
      'Redeem 5 rewards'
    );
  });

  it('绑定任务的成就文案会带上任务标题', () => {
    expect(
      formatCondition(condition('task_complete_count', 20, { templateId: 't1' }), 'Morning Run')
    ).toBe('“Morning Run” Complete 20 tasks in total');
  });

  it('带任务类型过滤时使用专门的文案', () => {
    expect(
      formatCondition(condition('task_complete_count', 10, { taskType: 'time' }))
    ).toBe('Complete 10 timed tasks in total');
  });

  it('单日峰值文案', () => {
    expect(formatCondition(condition('daily_task_count', 5))).toBe(
      'Complete 5 tasks in one day'
    );
  });

  it('每种条件类型都有文案，且不残留 { } 占位符', () => {
    for (const type of ACHIEVEMENT_CONDITION_TYPES) {
      const text = formatCondition(condition(type, 3));
      expect(text, type).not.toBe('');
      expect(text, type).not.toMatch(/\{[^}]*\}/);
      expect(text, type).not.toContain('undefined');
    }
  });
});
