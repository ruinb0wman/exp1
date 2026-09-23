import { describe, it, expect, beforeEach } from 'vitest';
import { getDB } from '@/db';
import type { RewardTemplate } from '@/db/types';
import { roundMoney } from '@/libs/reward';
import {
  purchaseReward,
  getRewardPurchases,
  getRewardPurchaseById,
  getRewardPurchaseStats,
  getRewardPurchaseCount,
  deleteRewardPurchase,
  deleteRewardTemplate,
  createRewardTemplate,
  getStoreRewardTemplates,
  toggleRewardTemplateEnabled,
} from './rewardService';

const db = getDB();

const USER_ID = 1;

/** 构造商品模板（默认 100 积分 / 比例 1:1） */
function template(overrides: Partial<RewardTemplate> = {}): Omit<RewardTemplate, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId: USER_ID,
    title: '吃饭',
    pointsCost: 100,
    moneyCost: 100,
    countInConsumption: true,
    enabled: true,
    replenishmentMode: 'none',
    icon: 'Pizza',
    ...overrides,
  };
}

/** 直接写一条积分收入，模拟任务奖励 */
async function seedPoints(amount: number, createdAt = '2026-09-01T00:00:00.000Z') {
  await db.pointsHistory.add({
    id: `seed-${amount}`,
    userId: USER_ID,
    amount,
    type: 'task_completion',
    createdAt,
  } as never);
}

async function currentPoints(): Promise<number> {
  const records = await db.pointsHistory.where('userId').equals(USER_ID).toArray();
  return records.reduce((sum, record) => sum + record.amount, 0);
}

describe('rewardService - 购买即消费', () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.rewardTemplates.clear();
    await db.rewardPurchases.clear();
    await db.pointsHistory.clear();
    await db.replenishmentRecords.clear();
  });

  it('购买成功后扣积分并写入一条消费记录', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());

    const purchaseId = await purchaseReward(templateId, USER_ID, 1);

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase).toBeDefined();
    expect(purchase!.pointsSpent).toBe(100);
    expect(purchase!.moneyAmount).toBe(100);
    expect(purchase!.quantity).toBe(1);
    expect(purchase!.template.title).toBe('吃饭');

    // 积分流水：一条 +300 的收入，一条 -100 的消费
    expect(await currentPoints()).toBe(200);
    const spendRecords = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .toArray();
    expect(spendRecords).toHaveLength(1);
    expect(spendRecords[0].amount).toBe(-100);
    expect(spendRecords[0].relatedInstanceId).toBe(purchaseId);
  });

  it('数量 > 1 时按单价累加积分与金额', async () => {
    await seedPoints(500);
    const templateId = await createRewardTemplate(template());

    const purchaseId = await purchaseReward(templateId, USER_ID, 3);

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.quantity).toBe(3);
    expect(purchase!.pointsSpent).toBe(300);
    expect(purchase!.moneyAmount).toBe(300);
    expect(await currentPoints()).toBe(200);
  });

  it('按单件金额累计：¥50/份 时单价不变，数量倍增金额', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(
      template({ pointsCost: 20, moneyCost: 50 })
    );

    const one = await getRewardPurchaseById(await purchaseReward(templateId, USER_ID, 1));
    expect(one!.pointsSpent).toBe(20);
    expect(one!.moneyAmount).toBe(50);

    const three = await getRewardPurchaseById(await purchaseReward(templateId, USER_ID, 3));
    expect(three!.pointsSpent).toBe(60);
    expect(three!.moneyAmount).toBe(150);
  });

  it('小数单件金额保留 2 位小数', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(
      template({ pointsCost: 20, moneyCost: 0.5 })
    );

    const purchaseId = await purchaseReward(templateId, USER_ID, 3);

    const purchase = await getRewardPurchaseById(purchaseId);
    // 0.5 × 3 = 1.5
    expect(purchase!.moneyAmount).toBe(1.5);
    expect(purchase!.moneyAmount).toBe(roundMoney(0.5 * 3));
  });

  it('0 积分的免费额度：可以购买、按单件金额记账、不写 0 分流水', async () => {
    await seedPoints(100);
    const templateId = await createRewardTemplate(
      template({
        title: '吃饭',
        pointsCost: 0,
        moneyCost: 1,
        replenishmentMode: 'daily',
        replenishmentNum: 25,
      })
    );
    await db.rewardTemplates.update(templateId, { currentStock: 25 });

    const purchaseId = await purchaseReward(templateId, USER_ID, 25);

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.pointsSpent).toBe(0);
    expect(purchase!.moneyAmount).toBe(25);
    expect(purchase!.template.moneyCost).toBe(1);
    // 额度被扣减
    expect((await db.rewardTemplates.get(templateId))!.currentStock).toBe(0);
    // 积分余额不变，且没有 0 分的 reward_exchange 流水
    expect(await currentPoints()).toBe(100);
    const spendRecords = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .toArray();
    expect(spendRecords).toHaveLength(0);
  });

  it('0 积分但额度不足时仍抛错', async () => {
    await seedPoints(100);
    const templateId = await createRewardTemplate(
      template({ pointsCost: 0, moneyCost: 1, replenishmentMode: 'daily', replenishmentNum: 2 })
    );
    await db.rewardTemplates.update(templateId, { currentStock: 2 });

    await expect(purchaseReward(templateId, USER_ID, 3)).rejects.toThrow('消费额度不足');
    expect(await db.rewardPurchases.count()).toBe(0);
  });

  it('负数积分价被视为无效', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template({ pointsCost: -1 }));

    await expect(purchaseReward(templateId, USER_ID, 1)).rejects.toThrow('商品积分价格无效');
  });

  it('关闭统计：不写金额、快照标记不计入，但积分照扣', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template({ countInConsumption: false }));

    const purchaseId = await purchaseReward(templateId, USER_ID, 1);

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.moneyAmount).toBeUndefined();
    expect(purchase!.template.countInConsumption).toBe(false);
    expect(purchase!.pointsSpent).toBe(100);
    expect(await currentPoints()).toBe(200);

    // 积分流水照常写入：积分明细与消费统计是两回事
    const spendRecords = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .toArray();
    expect(spendRecords).toHaveLength(1);
  });

  it('积分不足时抛出错误，且不产生任何消费记录或积分流水', async () => {
    await seedPoints(50);
    const templateId = await createRewardTemplate(template());

    await expect(purchaseReward(templateId, USER_ID, 1)).rejects.toThrow(/积分不足/);

    expect(await db.rewardPurchases.count()).toBe(0);
    const spendRecords = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .toArray();
    expect(spendRecords).toHaveLength(0);
    expect(await currentPoints()).toBe(50);
  });

  it('数量不合法时抛出错误', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());

    await expect(purchaseReward(templateId, USER_ID, 0)).rejects.toThrow('数量不合法');
    await expect(purchaseReward(templateId, USER_ID, 1.5)).rejects.toThrow('数量不合法');
  });

  it('商品已下架时不能购买', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template({ enabled: false }));

    await expect(purchaseReward(templateId, USER_ID, 1)).rejects.toThrow('商品已下架');
    expect(await db.rewardPurchases.count()).toBe(0);
  });

  it('额度不足时抛出错误且额度不变', async () => {
    await seedPoints(1000);
    const templateId = await createRewardTemplate(
      template({ replenishmentMode: 'daily', replenishmentNum: 2 })
    );
    // 建模板时库存恒为 0，初始额度由补货流程负责，这里直接设置
    await db.rewardTemplates.update(templateId, { currentStock: 2 });

    await expect(purchaseReward(templateId, USER_ID, 3)).rejects.toThrow('消费额度不足');

    const stored = await db.rewardTemplates.get(templateId);
    expect(stored!.currentStock).toBe(2);
    expect(await db.rewardPurchases.count()).toBe(0);
  });

  it('额度模式下购买成功会扣减额度', async () => {
    await seedPoints(1000);
    const templateId = await createRewardTemplate(
      template({ replenishmentMode: 'daily', replenishmentNum: 5 })
    );
    await db.rewardTemplates.update(templateId, { currentStock: 5 });

    await purchaseReward(templateId, USER_ID, 2);

    const stored = await db.rewardTemplates.get(templateId);
    expect(stored!.currentStock).toBe(3);
  });

  it('消费记录按时间倒序返回', async () => {
    await seedPoints(1000);
    const templateId = await createRewardTemplate(template());
    await purchaseReward(templateId, USER_ID, 1);
    await purchaseReward(templateId, USER_ID, 1);

    const purchases = await getRewardPurchases(USER_ID);
    expect(purchases).toHaveLength(2);
    expect(purchases[0].createdAt >= purchases[1].createdAt).toBe(true);
  });

  it('带备注兑换：备注落在消费记录上，并拼进积分流水描述', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());

    const purchaseId = await purchaseReward(templateId, USER_ID, 1, '  和朋友一起  ');

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.note).toBe('和朋友一起');

    const spendRecord = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .first();
    expect(spendRecord!.description).toBe('购买 吃饭 ×1 · 和朋友一起');
  });

  it('不带备注时保持旧文案，且不写 note 字段', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());

    const purchaseId = await purchaseReward(templateId, USER_ID, 1);

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.note).toBeUndefined();

    const spendRecord = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .first();
    expect(spendRecord!.description).toBe('购买 吃饭 ×1');
  });

  it('空白备注视为未填（不写 note、文案不变）', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());

    const purchaseId = await purchaseReward(templateId, USER_ID, 1, '   \n  ');

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.note).toBeUndefined();
    const spendRecord = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .first();
    expect(spendRecord!.description).toBe('购买 吃饭 ×1');
  });

  it('备注里的换行在流水描述里压成空格，但消费记录原样保留', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());

    const purchaseId = await purchaseReward(templateId, USER_ID, 2, '第一行\n第二行');

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.note).toBe('第一行\n第二行');

    const spendRecord = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .first();
    expect(spendRecord!.description).toBe('购买 吃饭 ×2 · 第一行 第二行');
  });

  it('0 积分免费额度：备注只存消费记录，不产生积分流水', async () => {
    const templateId = await createRewardTemplate(template({ pointsCost: 0 }));

    const purchaseId = await purchaseReward(templateId, USER_ID, 1, '免费的那一份');

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.note).toBe('免费的那一份');
    expect(await currentPoints()).toBe(0);
    const spendRecords = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .toArray();
    expect(spendRecords).toHaveLength(0);
  });

  it('超长备注截断到 200 字符', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());

    const purchaseId = await purchaseReward(templateId, USER_ID, 1, 'a'.repeat(250));

    const purchase = await getRewardPurchaseById(purchaseId);
    expect(purchase!.note).toHaveLength(200);
  });
});

describe('rewardService - 删除消费记录并回滚', () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.rewardTemplates.clear();
    await db.rewardPurchases.clear();
    await db.pointsHistory.clear();
    await db.replenishmentRecords.clear();
  });

  it('删除记录会返还积分并删除对应流水', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());
    const purchaseId = await purchaseReward(templateId, USER_ID, 1);
    expect(await currentPoints()).toBe(200);

    await deleteRewardPurchase(purchaseId);

    expect(await db.rewardPurchases.count()).toBe(0);
    expect(await currentPoints()).toBe(300);
    const spendRecords = await db.pointsHistory
      .where('userId')
      .equals(USER_ID)
      .filter((record) => record.type === 'reward_exchange')
      .toArray();
    expect(spendRecords).toHaveLength(0);
  });

  it('删除记录会返还消费额度，且不超过额度上限', async () => {
    await seedPoints(1000);
    const templateId = await createRewardTemplate(
      template({
        replenishmentMode: 'daily',
        replenishmentNum: 2,
        replenishmentLimit: 2,
      })
    );
    await db.rewardTemplates.update(templateId, { currentStock: 2 });
    const purchaseId = await purchaseReward(templateId, USER_ID, 2);
    expect((await db.rewardTemplates.get(templateId))!.currentStock).toBe(0);

    await deleteRewardPurchase(purchaseId);

    // 返还后不得超过 replenishmentLimit
    expect((await db.rewardTemplates.get(templateId))!.currentStock).toBe(2);
  });

  it('删除不存在的记录不会抛错', async () => {
    await expect(deleteRewardPurchase('not-exist')).resolves.toBeUndefined();
  });

  it('商品已删除时仍可回滚积分', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());
    const purchaseId = await purchaseReward(templateId, USER_ID, 1);

    await deleteRewardTemplate(templateId);

    await deleteRewardPurchase(purchaseId);
    expect(await currentPoints()).toBe(300);
  });

  it('删除商品不会删除消费记录（记账历史保留）', async () => {
    await seedPoints(300);
    const templateId = await createRewardTemplate(template());
    await purchaseReward(templateId, USER_ID, 1);

    await deleteRewardTemplate(templateId);

    expect(await db.rewardTemplates.get(templateId)).toBeUndefined();
    expect(await db.rewardPurchases.count()).toBe(1);
    const purchases = await getRewardPurchases(USER_ID);
    expect(purchases[0].template.title).toBe('吃饭');
  });
});

describe('rewardService - 消费统计', () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.rewardTemplates.clear();
    await db.rewardPurchases.clear();
    await db.pointsHistory.clear();
    await db.replenishmentRecords.clear();
  });

  it('按时间窗过滤（含头不含尾）并聚合总数与按商品分组', async () => {
    await db.rewardPurchases.bulkAdd([
      {
        id: 'p1',
        userId: USER_ID,
        templateId: 't1',
        template: { templateId: 't1', title: '吃饭', icon: 'Pizza', pointsCost: 100, moneyCost: 100 },
        quantity: 2,
        pointsCost: 100,
        pointsSpent: 200,
        moneyAmount: 200,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'p2',
        userId: USER_ID,
        templateId: 't2',
        template: { templateId: 't2', title: '香烟', icon: 'Cigarette', pointsCost: 20, moneyCost: 10 },
        quantity: 1,
        pointsCost: 20,
        pointsSpent: 20,
        moneyAmount: 10,
        createdAt: '2026-09-15T00:00:00.000Z',
      },
      {
        id: 'p3',
        userId: USER_ID,
        templateId: 't2',
        template: { templateId: 't2', title: '香烟', icon: 'Cigarette', pointsCost: 20, moneyCost: 10 },
        quantity: 1,
        pointsCost: 20,
        pointsSpent: 20,
        moneyAmount: 10,
        createdAt: '2026-10-01T00:00:00.000Z',
      },
      // 其他用户的数据不应计入
      {
        id: 'p4',
        userId: 2,
        templateId: 't1',
        template: { templateId: 't1', title: '吃饭', icon: 'Pizza', pointsCost: 100, moneyCost: 100 },
        quantity: 1,
        pointsCost: 100,
        pointsSpent: 100,
        moneyAmount: 100,
        createdAt: '2026-09-10T00:00:00.000Z',
      },
    ] as never);

    const stats = await getRewardPurchaseStats(
      USER_ID,
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z'
    );

    // p3 落在结束边界（不含），p4 属于其他用户
    expect(stats.count).toBe(2);
    expect(stats.quantity).toBe(3);
    expect(stats.pointsSpent).toBe(220);
    expect(stats.moneyAmount).toBe(210);

    expect(stats.byTemplate).toHaveLength(2);
    // 按积分消耗倒序：吃饭 200 > 香烟 40
    expect(stats.byTemplate[0]).toMatchObject({
      templateId: 't1',
      title: '吃饭',
      count: 1,
      quantity: 2,
      pointsSpent: 200,
      moneyAmount: 200,
    });
    expect(stats.byTemplate[1]).toMatchObject({
      templateId: 't2',
      title: '香烟',
      count: 1,
      quantity: 1,
      pointsSpent: 20,
      moneyAmount: 10,
    });

    // 明细按时间倒序
    expect(stats.purchases.map((purchase) => purchase.id)).toEqual(['p2', 'p1']);
  });

  it('空区间返回全零', async () => {
    const stats = await getRewardPurchaseStats(
      USER_ID,
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z'
    );

    expect(stats.count).toBe(0);
    expect(stats.pointsSpent).toBe(0);
    expect(stats.moneyAmount).toBe(0);
    expect(stats.byTemplate).toEqual([]);
  });

  it('商品改名后统计使用最近一次购买的快照标题', async () => {
    await db.rewardPurchases.bulkAdd([
      {
        id: 'p1',
        userId: USER_ID,
        templateId: 't1',
        template: { templateId: 't1', title: '旧名字', icon: 'Pizza', pointsCost: 10, moneyCost: 10 },
        quantity: 1,
        pointsCost: 10,
        pointsSpent: 10,
        moneyAmount: 10,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'p2',
        userId: USER_ID,
        templateId: 't1',
        template: { templateId: 't1', title: '新名字', icon: 'Pizza', pointsCost: 10, moneyCost: 10 },
        quantity: 1,
        pointsCost: 10,
        pointsSpent: 10,
        moneyAmount: 10,
        createdAt: '2026-09-05T00:00:00.000Z',
      },
    ] as never);

    const stats = await getRewardPurchaseStats(
      USER_ID,
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z'
    );

    expect(stats.byTemplate).toHaveLength(1);
    expect(stats.byTemplate[0].title).toBe('新名字');
    expect(stats.byTemplate[0].count).toBe(2);
  });

  it('不计入统计的购买：汇总与商品占比不含，但明细仍保留', async () => {
    await db.rewardPurchases.bulkAdd([
      {
        id: 'p1',
        userId: USER_ID,
        templateId: 't1',
        template: {
          templateId: 't1',
          title: '吃饭',
          icon: 'Pizza',
          pointsCost: 100,
          moneyCost: 100,
          countInConsumption: true,
        },
        quantity: 2,
        pointsCost: 100,
        pointsSpent: 200,
        moneyAmount: 200,
        createdAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'p2',
        userId: USER_ID,
        templateId: 't2',
        template: {
          templateId: 't2',
          title: '看电影',
          icon: 'Film',
          pointsCost: 50,
          moneyCost: 50,
          countInConsumption: false,
        },
        quantity: 1,
        pointsCost: 50,
        pointsSpent: 50,
        createdAt: '2026-09-03T00:00:00.000Z',
      },
    ] as never);

    const stats = await getRewardPurchaseStats(
      USER_ID,
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z'
    );

    expect(stats.count).toBe(1);
    expect(stats.quantity).toBe(2);
    expect(stats.pointsSpent).toBe(200);
    expect(stats.moneyAmount).toBe(200);
    expect(stats.byTemplate).toHaveLength(1);
    expect(stats.byTemplate[0].templateId).toBe('t1');

    // 明细保留全部（含不计入统计的那条），否则就没了撤销入口
    expect(stats.purchases.map((purchase) => purchase.id)).toEqual(['p2', 'p1']);
  });

  it('快照口径：关闭比例只影响之后的购买，历史统计不回算', async () => {
    await seedPoints(1000);
    const templateId = await createRewardTemplate(template());

    await purchaseReward(templateId, USER_ID, 1);
    await db.rewardTemplates.update(templateId, { countInConsumption: false });
    await purchaseReward(templateId, USER_ID, 1);

    const now = Date.now();
    const stats = await getRewardPurchaseStats(
      USER_ID,
      new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      new Date(now + 24 * 60 * 60 * 1000).toISOString()
    );

    // 两笔都在明细里，只有关闭前那笔计入统计
    expect(stats.purchases).toHaveLength(2);
    expect(stats.count).toBe(1);
    expect(stats.pointsSpent).toBe(100);
    expect(stats.moneyAmount).toBe(100);
    expect(stats.byTemplate).toHaveLength(1);
    expect(stats.byTemplate[0].count).toBe(1);
  });

  it('旧记录没有 countInConsumption 字段时视为计入统计', async () => {
    await db.rewardPurchases.bulkAdd([
      {
        id: 'p1',
        userId: USER_ID,
        templateId: 't1',
        template: { templateId: 't1', title: '旧奖品', icon: 'Gift', pointsCost: 10, moneyCost: 5 },
        quantity: 1,
        pointsCost: 10,
        pointsSpent: 10,
        moneyAmount: 5,
        createdAt: '2026-09-05T00:00:00.000Z',
      },
    ] as never);

    const stats = await getRewardPurchaseStats(
      USER_ID,
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z'
    );

    expect(stats.count).toBe(1);
    expect(stats.moneyAmount).toBe(5);
  });

  it('商品占比与排名按金额倒序（与积分序不一致时以金额为准）', async () => {
    await db.rewardPurchases.bulkAdd([
      {
        id: 'p1',
        userId: USER_ID,
        templateId: 'points-heavy',
        template: {
          templateId: 'points-heavy',
          title: '积分王',
          icon: 'Crown',
          pointsCost: 1000,
          moneyCost: 1,
        },
        quantity: 1,
        pointsCost: 1000,
        pointsSpent: 1000,
        moneyAmount: 1,
        createdAt: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'p2',
        userId: USER_ID,
        templateId: 'money-heavy',
        template: {
          templateId: 'money-heavy',
          title: '小钱多',
          icon: 'Gift',
          pointsCost: 10,
          moneyCost: 50,
        },
        quantity: 1,
        pointsCost: 10,
        pointsSpent: 10,
        moneyAmount: 50,
        createdAt: '2026-09-03T00:00:00.000Z',
      },
    ] as never);

    const stats = await getRewardPurchaseStats(
      USER_ID,
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z'
    );

    // 金额多的在前；若改成按积分排序会得到 ['points-heavy', 'money-heavy']
    expect(stats.byTemplate.map((bucket) => bucket.templateId)).toEqual([
      'money-heavy',
      'points-heavy',
    ]);
    expect(stats.byTemplate[0].moneyAmount).toBe(50);
    expect(stats.byTemplate[1].moneyAmount).toBe(1);
  });

  it('getRewardPurchaseCount 只统计当前用户', async () => {
    await db.rewardPurchases.bulkAdd([
      {
        id: 'p1',
        userId: USER_ID,
        templateId: 't1',
        template: { templateId: 't1', title: 'A', icon: 'Gift', pointsCost: 1, moneyCost: 1 },
        quantity: 1,
        pointsCost: 1,
        pointsSpent: 1,
        moneyAmount: 1,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'p2',
        userId: 2,
        templateId: 't1',
        template: { templateId: 't1', title: 'A', icon: 'Gift', pointsCost: 1, moneyCost: 1 },
        quantity: 1,
        pointsCost: 1,
        pointsSpent: 1,
        moneyAmount: 1,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ] as never);

    expect(await getRewardPurchaseCount(USER_ID)).toBe(1);
  });
});

describe('rewardService - 商店列表顺序', () => {
  beforeEach(async () => {
    await db.rewardTemplates.clear();
  });

  it('按积分升序返回：0 积分的免费额度在最前，且只含当前用户', async () => {
    await createRewardTemplate(template({ title: '大餐', pointsCost: 100 }));
    await createRewardTemplate(template({ title: '免费额度', pointsCost: 0 }));
    await createRewardTemplate(template({ title: '咖啡', pointsCost: 10 }));
    await createRewardTemplate(template({ userId: 2, title: '别人的' , pointsCost: 1 }));

    const store = await getStoreRewardTemplates(USER_ID);

    expect(store.map(({ template: t }) => t.title)).toEqual(['免费额度', '咖啡', '大餐']);
    expect(store.map(({ template: t }) => t.pointsCost)).toEqual([0, 10, 100]);
  });

  it('停用的商品不出现，其余商品的相对顺序不变', async () => {
    const coffeeId = await createRewardTemplate(template({ title: '咖啡', pointsCost: 10 }));
    await createRewardTemplate(template({ title: '大餐', pointsCost: 100 }));
    await createRewardTemplate(template({ title: '免费额度', pointsCost: 0 }));

    await toggleRewardTemplateEnabled(coffeeId, false);

    const store = await getStoreRewardTemplates(USER_ID);

    expect(store.map(({ template: t }) => t.title)).toEqual(['免费额度', '大餐']);
  });

  it('排序不影响 availableCount 的计算', async () => {
    const coffeeId = await createRewardTemplate(
      template({ title: '咖啡', pointsCost: 10, replenishmentMode: 'daily', replenishmentNum: 2 })
    );
    await createRewardTemplate(template({ title: '免费额度', pointsCost: 0 }));
    await db.rewardTemplates.update(coffeeId, { currentStock: 3 });

    const store = await getStoreRewardTemplates(USER_ID);

    expect(store.map(({ template: t }) => t.title)).toEqual(['免费额度', '咖啡']);
    expect(store[0].availableCount).toBe(Infinity);
    expect(store[1].availableCount).toBe(3);
  });
});
