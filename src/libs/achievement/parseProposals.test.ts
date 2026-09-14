import { describe, it, expect } from 'vitest';
import { extractJson, normalizeProposal, parseProposals } from './parseProposals';

const context = { validTemplateIds: new Set(['t1', 't2']) };

function payload(items: unknown[]): string {
  return JSON.stringify({ achievements: items });
}

describe('extractJson', () => {
  it('解析纯 JSON 对象', () => {
    expect(extractJson('{"achievements":[]}')).toEqual({ achievements: [] });
  });

  it('解析 ```json 围栏', () => {
    const raw = '```json\n{"achievements":[{"title":"A"}]}\n```';
    expect(extractJson(raw)).toEqual({ achievements: [{ title: 'A' }] });
  });

  it('解析前后带散文的 JSON', () => {
    const raw = 'Sure! Here you go:\n{"achievements":[{"title":"A"}]}\nHope that helps.';
    expect(extractJson(raw)).toEqual({ achievements: [{ title: 'A' }] });
  });

  it('解析顶层数组', () => {
    expect(extractJson('[{"title":"A"}]')).toEqual([{ title: 'A' }]);
  });

  it('空响应抛错', () => {
    expect(() => extractJson('')).toThrow('EMPTY_RESPONSE');
  });

  it('没有 JSON 时抛错', () => {
    expect(() => extractJson('no json here')).toThrow('NO_JSON_FOUND');
  });
});

describe('normalizeProposal', () => {
  it('合法条目被保留并补齐默认值', () => {
    const result = normalizeProposal(
      {
        title: '晨跑达人',
        description: '坚持晨跑',
        icon: 'Rocket',
        condition: { type: 'task_complete_count', target: 20, templateId: 't1' },
        rewardPoints: 80,
      },
      context
    );

    expect(result).toEqual({
      title: '晨跑达人',
      description: '坚持晨跑',
      icon: 'Rocket',
      condition: { type: 'task_complete_count', target: 20, templateId: 't1' },
      rewardPoints: 80,
    });
  });

  it('未知条件类型被丢弃', () => {
    expect(
      normalizeProposal(
        { title: 'X', condition: { type: 'unknown_type', target: 5 }, rewardPoints: 10 },
        context
      )
    ).toBeNull();
  });

  it('缺少标题被丢弃', () => {
    expect(
      normalizeProposal(
        { title: '   ', condition: { type: 'task_complete_count', target: 5 } },
        context
      )
    ).toBeNull();
  });

  it('target 越界时被夹取到合法区间', () => {
    const low = normalizeProposal(
      { title: 'X', condition: { type: 'task_complete_count', target: 0 } },
      context
    );
    const high = normalizeProposal(
      { title: 'X', condition: { type: 'task_complete_count', target: 99999999 } },
      context
    );
    expect(low?.condition.target).toBe(1);
    expect(high?.condition.target).toBe(100000);
  });

  it('未知 templateId 降级为全局成就', () => {
    const result = normalizeProposal(
      {
        title: 'X',
        condition: { type: 'task_complete_count', target: 5, templateId: 'ghost' },
      },
      context
    );
    expect(result?.condition.templateId).toBeUndefined();
  });

  it('非法 taskType / mode 被忽略', () => {
    const result = normalizeProposal(
      {
        title: 'X',
        condition: {
          type: 'task_complete_count',
          target: 5,
          taskType: 'bogus',
        },
      },
      context
    );
    expect(result?.condition.taskType).toBeUndefined();

    const pomo = normalizeProposal(
      {
        title: 'Y',
        condition: { type: 'pomo_session_count', target: 5, mode: 'bogus' },
      },
      context
    );
    expect(pomo?.condition.mode).toBeUndefined();
  });

  it('未知图标回落 Trophy，奖励分夹取到 [1,1000]', () => {
    const result = normalizeProposal(
      {
        title: 'X',
        icon: 'NotAnIcon',
        condition: { type: 'streak_days', target: 7 },
        rewardPoints: 100000,
      },
      context
    );
    expect(result?.icon).toBe('Trophy');
    expect(result?.rewardPoints).toBe(1000);
  });

  it('超长标题与描述被截断', () => {
    const result = normalizeProposal(
      {
        title: 'a'.repeat(80),
        description: 'b'.repeat(300),
        condition: { type: 'streak_days', target: 7 },
      },
      context
    );
    expect(result?.title).toHaveLength(40);
    expect(result?.description).toHaveLength(120);
  });
});

describe('parseProposals', () => {
  it('丢弃非法条目并保留合法条目', () => {
    const raw = payload([
      { title: 'A', condition: { type: 'task_complete_count', target: 10 } },
      { title: '', condition: { type: 'task_complete_count', target: 10 } },
      { condition: { type: 'task_complete_count', target: 10 } },
      { title: 'D', condition: { type: 'nope', target: 10 } },
    ]);

    const result = parseProposals(raw, context);
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].title).toBe('A');
    expect(result.dropped).toBe(3);
  });

  it('超过 5 条时截断', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      title: `A${index}`,
      condition: { type: 'task_complete_count', target: 10 + index },
    }));

    const result = parseProposals(payload(items), context);
    expect(result.proposals).toHaveLength(5);
    expect(result.dropped).toBe(3);
  });

  it('全部非法时抛错', () => {
    const raw = payload([{ title: '', condition: { type: 'task_complete_count', target: 1 } }]);
    expect(() => parseProposals(raw, context)).toThrow('NO_VALID_PROPOSALS');
  });

  it('顶层数组也可解析', () => {
    const raw = JSON.stringify([
      { title: 'A', condition: { type: 'streak_days', target: 7 } },
    ]);
    expect(parseProposals(raw, context).proposals).toHaveLength(1);
  });

  it('无法解析时抛错', () => {
    expect(() => parseProposals('not json', context)).toThrow('NO_JSON_FOUND');
  });
});
