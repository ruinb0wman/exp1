import { describe, it, expect } from 'vitest';
import type {
  AchievementCondition,
  PomoSession,
  PointsHistory,
  RewardInstance,
  TaskInstance,
  TaskTemplate,
} from '@/db/types';
import {
  computeProgress,
  computeRawMetric,
  isCumulativeCondition,
  type AchievementSources,
} from './metrics';

function template(id: string, type: 'simple' | 'time' | 'count' | 'subtask'): TaskTemplate {
  return {
    id,
    userId: 1,
    title: `Template ${id}`,
    repeatMode: 'daily',
    endCondition: 'manual',
    enabled: true,
    subtasks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    completeRule: { type, stages: [], completionPoints: 10 },
  } as unknown as TaskTemplate;
}

function instance(
  id: string,
  templateId: string,
  overrides: Partial<TaskInstance> = {}
): TaskInstance {
  return {
    id,
    userId: 1,
    templateId,
    template: template(templateId, 'simple'),
    status: 'pending',
    subtasks: [],
    instanceDate: '2026-05-01',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  } as unknown as TaskInstance;
}

function points(id: string, amount: number, type: PointsHistory['type']): PointsHistory {
  return {
    id,
    userId: 1,
    amount,
    type,
    createdAt: '2026-05-01T00:00:00.000Z',
  } as unknown as PointsHistory;
}

function session(
  id: number,
  overrides: Partial<PomoSession> = {}
): PomoSession {
  return {
    id,
    userId: 1,
    mode: 'focus',
    duration: 1500,
    actualDuration: 1500,
    status: 'completed',
    startedAt: '2026-05-01T10:00:00.000Z',
    interruptions: 0,
    ...overrides,
  };
}

function reward(id: string): RewardInstance {
  return { id, userId: 1, templateId: 'r1', status: 'available' } as unknown as RewardInstance;
}

function sources(partial: Partial<AchievementSources> = {}): AchievementSources {
  return {
    instances: [],
    sessions: [],
    pointsRecords: [],
    rewardInstances: [],
    ...partial,
  };
}

function condition(
  type: AchievementCondition['type'],
  target: number,
  extra: Partial<AchievementCondition> = {}
): AchievementCondition {
  return { type, target, ...extra };
}

describe('isCumulativeCondition', () => {
  it('累计型与状态型条件区分正确', () => {
    expect(isCumulativeCondition(condition('task_complete_count', 10))).toBe(true);
    expect(isCumulativeCondition(condition('points_earned', 10))).toBe(true);
    expect(isCumulativeCondition(condition('streak_days', 7))).toBe(false);
    expect(isCumulativeCondition(condition('daily_task_count', 5))).toBe(false);
  });
});

describe('computeRawMetric', () => {
  it('task_complete_count 只统计已完成实例，并支持 templateId / taskType 过滤', () => {
    const data = sources({
      instances: [
        instance('a', 't1', { status: 'completed' }),
        instance('b', 't1', { status: 'pending' }),
        instance('c', 't2', {
          status: 'completed',
          template: template('t2', 'time'),
        }),
      ],
    });

    expect(computeRawMetric(condition('task_complete_count', 1), data)).toBe(2);
    expect(
      computeRawMetric(condition('task_complete_count', 1, { templateId: 't1' }), data)
    ).toBe(1);
    expect(
      computeRawMetric(condition('task_complete_count', 1, { taskType: 'time' }), data)
    ).toBe(1);
  });

  it('stage_complete_count 累加阶段数，subtask 类型累加已完成子任务', () => {
    const data = sources({
      instances: [
        instance('a', 't1', {
          completedStages: [
            { stageId: 's1', completedAt: '2026-05-01T00:00:00.000Z', points: 5 },
            { stageId: 's2', completedAt: '2026-05-01T00:00:00.000Z', points: 5 },
          ],
        }),
        instance('b', 't2', {
          template: template('t2', 'subtask'),
          completedSubtasks: [true, false, true],
        }),
      ],
    });

    expect(computeRawMetric(condition('stage_complete_count', 1), data)).toBe(4);
    expect(
      computeRawMetric(condition('stage_complete_count', 1, { templateId: 't2' }), data)
    ).toBe(2);
  });

  it('points_earned 只累加正向收入，且排除 achievement 自身', () => {
    const data = sources({
      pointsRecords: [
        points('p1', 10, 'task_stage'),
        points('p2', 20, 'task_completion'),
        points('p3', 30, 'achievement'),
        points('p4', -15, 'task_undo'),
        points('p5', -5, 'reward_exchange'),
        points('p6', 7, 'admin_adjustment'),
      ],
    });

    expect(computeRawMetric(condition('points_earned', 1), data)).toBe(37);
  });

  it('番茄指标按 mode 与绑定模板过滤，分钟数向下取整', () => {
    const data = sources({
      instances: [instance('i1', 't1')],
      sessions: [
        session(1, { actualDuration: 1500 }),
        session(2, { actualDuration: 190 }),
        session(3, { status: 'aborted', actualDuration: 1500 }),
        session(4, { mode: 'shortBreak', actualDuration: 300 }),
        session(5, { taskId: 'i1', actualDuration: 600 }),
      ],
    });

    expect(computeRawMetric(condition('pomo_focus_minutes', 1), data)).toBe(25 + 3 + 10);
    expect(computeRawMetric(condition('pomo_session_count', 1), data)).toBe(3);
    expect(
      computeRawMetric(condition('pomo_session_count', 1, { templateId: 't1' }), data)
    ).toBe(1);
    expect(
      computeRawMetric(condition('pomo_session_count', 1, { mode: 'shortBreak' }), data)
    ).toBe(1);
  });

  it('streak_days 取窗口内最长连续天数，且忽略窗口之前的记录', () => {
    const data = sources({
      instances: [
        instance('a', 't1', { status: 'completed', completedAt: '2026-05-01T10:00:00.000Z' }),
        instance('b', 't1', { status: 'completed', completedAt: '2026-05-02T10:00:00.000Z' }),
        instance('c', 't1', { status: 'completed', completedAt: '2026-05-03T10:00:00.000Z' }),
        instance('d', 't1', { status: 'completed', completedAt: '2026-05-06T10:00:00.000Z' }),
      ],
    });

    expect(computeRawMetric(condition('streak_days', 1), data)).toBe(3);
    expect(computeRawMetric(condition('streak_days', 1), data, '2026-05-03')).toBe(1);
    expect(computeRawMetric(condition('streak_days', 1), data, '2026-05-06')).toBe(1);
  });

  it('daily_task_count 取窗口内单日完成数的峰值', () => {
    const data = sources({
      instances: [
        instance('a', 't1', { status: 'completed', completedAt: '2026-05-01T10:00:00.000Z' }),
        instance('b', 't1', { status: 'completed', completedAt: '2026-05-02T10:00:00.000Z' }),
        instance('c', 't1', { status: 'completed', completedAt: '2026-05-02T11:00:00.000Z' }),
        instance('d', 't1', { status: 'completed', completedAt: '2026-05-02T12:00:00.000Z' }),
      ],
    });

    expect(computeRawMetric(condition('daily_task_count', 1), data)).toBe(3);
    expect(computeRawMetric(condition('daily_task_count', 1), data, '2026-05-02')).toBe(3);
  });

  it('reward_redeem_count 统计兑换记录数', () => {
    const data = sources({ rewardInstances: [reward('r1'), reward('r2')] });
    expect(computeRawMetric(condition('reward_redeem_count', 1), data)).toBe(2);
  });
});

describe('computeProgress', () => {
  it('累计型减去接取基线，且不会为负', () => {
    const cond = condition('task_complete_count', 5);
    expect(computeProgress(cond, 13, 10)).toBe(3);
    expect(computeProgress(cond, 8, 10)).toBe(0);
  });

  it('状态/峰值型直接使用窗口内原始值', () => {
    const cond = condition('streak_days', 7);
    expect(computeProgress(cond, 4, 999)).toBe(4);
  });
});
