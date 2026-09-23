import { getDB } from '../index';
import type {
  RewardTemplate,
  ReplenishmentMode,
  ReplenishmentRecord,
  RewardPurchase,
  RewardPurchaseSnapshot,
  RewardIconName,
  RewardIconColor,
  PointsHistory,
} from '../types';
import { getUserCurrentDate } from '@/libs/time';
import { generateUUID } from '@/libs/id';
import { roundMoney, isValidMoneyCost, isCountedInConsumption, sortRewardTemplates, normalizePurchaseNote } from '@/libs/reward';

/** 单件金额归一化：非法值兜底为 0（不记金额） */
function normalizeMoneyCost(moneyCost: number | undefined): number {
  return isValidMoneyCost(moneyCost as number) ? roundMoney(moneyCost as number) : 0;
}

// ==================== RewardTemplate CRUD ====================

/**
 * 创建奖励模板
 */
export async function createRewardTemplate(
  template: Omit<RewardTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDB();

  const now = new Date().toISOString();
  const shouldReplenish = template.replenishmentMode !== 'none';

	const newTemplate: RewardTemplate = {
		...template,
		moneyCost: normalizeMoneyCost(template.moneyCost),
		countInConsumption: isCountedInConsumption(template.countInConsumption),
		id: '' as string,
		createdAt: now,
		currentStock: shouldReplenish ? 0 : undefined,
	};

  return db.rewardTemplates.add(newTemplate as unknown as RewardTemplate);
}

/**
 * 获取所有奖励模板（按积分升序）
 */
export async function getAllRewardTemplates(userId?: number): Promise<RewardTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    return sortRewardTemplates(await db.rewardTemplates.where('userId').equals(userId).toArray());
  }
  return sortRewardTemplates(await db.rewardTemplates.toArray());
}

/**
 * 获取启用的奖励模板（按积分升序）
 */
export async function getEnabledRewardTemplates(userId?: number): Promise<RewardTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.rewardTemplates.where('userId').equals(userId).toArray();
    return sortRewardTemplates(templates.filter(t => t.enabled));
  }
  return sortRewardTemplates(await db.rewardTemplates.filter(t => t.enabled).toArray());
}

/**
 * 根据ID获取奖励模板
 */
export async function getRewardTemplateById(id: string): Promise<RewardTemplate | undefined> {
  const db = getDB();
  return db.rewardTemplates.get(id);
}

/**
 * 根据补货模式获取奖励模板（按积分升序）
 */
export async function getRewardTemplatesByReplenishmentMode(
  mode: ReplenishmentMode,
  userId?: number
): Promise<RewardTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.rewardTemplates.where('userId').equals(userId).toArray();
    return sortRewardTemplates(templates.filter(t => t.replenishmentMode === mode));
  }
  return sortRewardTemplates(await db.rewardTemplates.where('replenishmentMode').equals(mode).toArray());
}

/**
 * 更新奖励模板
 */
export async function updateRewardTemplate(
  id: string,
  updates: Partial<Omit<RewardTemplate, 'id' | 'createdAt'>>
): Promise<number> {
  const db = getDB();

  const updateData = {
    ...updates,
    ...(updates.moneyCost !== undefined
      ? { moneyCost: normalizeMoneyCost(updates.moneyCost) }
      : {}),
    updatedAt: new Date().toISOString(),
  };

  return db.rewardTemplates.update(id, updateData);
}

/**
 * 删除奖励模板（同时删除关联的补货记录）
 * 注意：消费记录必须保留 —— 删掉商品不能抹掉记账历史
 */
export async function deleteRewardTemplate(id: string): Promise<void> {
  const db = getDB();

  await db.transaction('rw', db.rewardTemplates, db.replenishmentRecords, async () => {
    await db.replenishmentRecords.where('templateId').equals(id).delete();
    await db.rewardTemplates.delete(id);
  });
}

/**
 * 切换奖励模板启用状态
 */
export async function toggleRewardTemplateEnabled(
  id: string,
  enabled?: boolean
): Promise<number> {
  const db = getDB();

  const template = await db.rewardTemplates.get(id);
  if (!template) {
    throw new Error('Reward template not found');
  }

  const newEnabled = enabled !== undefined ? enabled : !template.enabled;

  return db.rewardTemplates.update(id, {
    enabled: newEnabled,
    updatedAt: new Date().toISOString(),
  });
}

// ==================== 购买（购买即消费） ====================

/** 从模板生成购买快照 */
function toPurchaseSnapshot(template: RewardTemplate): RewardPurchaseSnapshot {
  return {
    templateId: template.id,
    title: template.title,
    icon: template.icon,
    iconColor: template.iconColor,
    pointsCost: template.pointsCost,
    moneyCost: normalizeMoneyCost(template.moneyCost),
    countInConsumption: isCountedInConsumption(template.countInConsumption),
  };
}

/**
 * 购买奖励：一次性扣除积分并写入消费记录（购买即消费，无中间态）
 *
 * 事务内完成：额度校验与扣减、积分校验、写消费记录、写积分流水
 *
 * @param note 兑换时填写的可选备注（整单一条）；空/空白视为未填。会原样存在
 *   消费记录上，并拼进积分流水描述（积分明细/报告据此展示）
 * @returns 消费记录 ID
 */
export async function purchaseReward(
  templateId: string,
  userId: number,
  quantity: number = 1,
  note?: string
): Promise<string> {
  const db = getDB();

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('数量不合法');
  }

  // 归一化放在事务外：纯函数、与校验无关，失败也不该占用事务
  const normalizedNote = normalizePurchaseNote(note);

  return db.transaction(
    'rw',
    [db.rewardTemplates, db.rewardPurchases, db.pointsHistory],
    async () => {
      const template = await db.rewardTemplates.get(templateId);
      if (!template) {
        throw new Error('商品不存在');
      }
      if (!template.enabled) {
        throw new Error('商品已下架');
      }

      // 关闭「计入消费统计」的奖品：不写金额，也不计入消费统计
      const counted = isCountedInConsumption(template.countInConsumption);
      const pointsCost = template.pointsCost;
      // 0 积分是合法值（如每日免费额度），只拒绝负数与非法值
      if (!Number.isFinite(pointsCost) || pointsCost < 0) {
        throw new Error('商品积分价格无效');
      }
      const moneyCost = normalizeMoneyCost(template.moneyCost);

      // 消费额度检查（补货模式即额度模式）
      const hasQuota = template.replenishmentMode !== 'none';
      const currentStock = template.currentStock ?? 0;
      if (hasQuota && currentStock < quantity) {
        throw new Error('消费额度不足');
      }

      // 积分检查
      const totalCost = pointsCost * quantity;
      const pointsRecords = await db.pointsHistory.where('userId').equals(userId).toArray();
      const balance = pointsRecords.reduce((sum, record) => sum + record.amount, 0);

      if (balance < totalCost) {
        throw new Error(`积分不足。需要: ${totalCost}, 当前: ${balance}`);
      }

      const purchaseId = generateUUID();
      const now = new Date().toISOString();

      const purchase: RewardPurchase = {
        id: purchaseId,
        userId,
        templateId,
        template: toPurchaseSnapshot(template),
        quantity,
        pointsCost,
        pointsSpent: totalCost,
        moneyAmount: counted ? roundMoney(moneyCost * quantity) : undefined,
        note: normalizedNote,
        createdAt: now,
      };
      await db.rewardPurchases.add(purchase);

      // 积分扣减与消费记录同事务写入，避免出现「扣了积分没有记录」
      // 0 积分的免费额度不写 0 分流水，避免刷屏积分明细
      if (totalCost > 0) {
        // 备注写进流水描述，积分明细与报告无需额外查询即可展示
        // （换行压成空格，保持描述是单行文本）
        const purchaseLabel = `购买 ${template.title} ×${quantity}`;
        const description = normalizedNote
          ? `${purchaseLabel} · ${normalizedNote.replace(/\s+/g, ' ')}`
          : purchaseLabel;

        const spendRecord: PointsHistory = {
          id: generateUUID(),
          userId,
          amount: -totalCost,
          type: 'reward_exchange',
          relatedInstanceId: purchaseId,
          description,
          createdAt: now,
        };
        await db.pointsHistory.add(spendRecord);
      }

      if (hasQuota) {
        await db.rewardTemplates.update(templateId, {
          currentStock: currentStock - quantity,
          updatedAt: now,
        });
      }

      return purchaseId;
    }
  );
}

/**
 * 获取用户的全部消费记录（按时间倒序）
 */
export async function getRewardPurchases(userId: number): Promise<RewardPurchase[]> {
  const db = getDB();
  const purchases = await db.rewardPurchases.where('userId').equals(userId).toArray();
  return purchases.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRewardPurchaseById(id: string): Promise<RewardPurchase | undefined> {
  const db = getDB();
  return db.rewardPurchases.get(id);
}

/**
 * 获取用户的消费笔数
 */
export async function getRewardPurchaseCount(userId: number): Promise<number> {
  const db = getDB();
  return db.rewardPurchases.where('userId').equals(userId).count();
}

/**
 * 删除消费记录并回滚：删记录 + 删对应积分流水 + 返还消费额度
 *
 * 直接删除原积分流水（而非写反向流水），保证积分明细与消费统计
 * 不会出现「已撤销但仍显示」的幽灵记录。
 */
export async function deleteRewardPurchase(id: string): Promise<void> {
  const db = getDB();

  await db.transaction(
    'rw',
    [db.rewardTemplates, db.rewardPurchases, db.pointsHistory],
    async () => {
      const purchase = await db.rewardPurchases.get(id);
      if (!purchase) {
        return;
      }

      await db.rewardPurchases.delete(id);

      await db.pointsHistory
        .where('userId')
        .equals(purchase.userId)
        .filter((record) => record.relatedInstanceId === id && record.type === 'reward_exchange')
        .delete();

      const template = await db.rewardTemplates.get(purchase.templateId);
      if (template && template.replenishmentMode !== 'none') {
        const restored = (template.currentStock ?? 0) + purchase.quantity;
        const limited =
          template.replenishmentLimit !== undefined
            ? Math.min(restored, template.replenishmentLimit)
            : restored;
        await db.rewardTemplates.update(template.id, {
          currentStock: limited,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  );
}

// ==================== 消费统计 ====================

/** 按商品聚合的消费统计 */
export interface PurchaseTemplateBucket {
  templateId: string;
  title: string;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  /** 笔数 */
  count: number;
  /** 件数 */
  quantity: number;
  pointsSpent: number;
  moneyAmount: number;
}

export interface RewardPurchaseStats {
  pointsSpent: number;
  moneyAmount: number;
  /** 笔数（仅计入消费统计的记录） */
  count: number;
  /** 件数（仅计入消费统计的记录） */
  quantity: number;
  /** 按金额倒序（仅计入消费统计的记录）：商品占比与排名都以金额为准 */
  byTemplate: PurchaseTemplateBucket[];
  /** 区间内明细，按时间倒序；**含**不计入消费统计的记录（明细保留撤销入口） */
  purchases: RewardPurchase[];
}

/**
 * 统计指定时间窗内的消费
 *
 * 汇总（积分 / 金额 / 笔数 / 件数 / 商品占比）只累加「计入消费统计」的记录；
 * 「是否计入」按购买时的快照判定（`purchase.template.countInConsumption`），
 * 因此事后关闭奖品比例不会回算历史统计。
 * 明细 `purchases` 仍返回窗口内全部记录，由 UI 标注不计入的行。
 *
 * @param startISO 起始 ISO 时间（含）
 * @param endExclusiveISO 结束 ISO 时间（不含）
 */
export async function getRewardPurchaseStats(
  userId: number,
  startISO: string,
  endExclusiveISO: string
): Promise<RewardPurchaseStats> {
  const db = getDB();

  const all = await db.rewardPurchases.where('userId').equals(userId).toArray();
  const purchases = all
    .filter((p) => p.createdAt >= startISO && p.createdAt < endExclusiveISO)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 明细保留全部，汇总与占比只算计入统计的
  const counted = purchases.filter((purchase) =>
    isCountedInConsumption(purchase.template.countInConsumption)
  );

  const bucketMap = new Map<string, PurchaseTemplateBucket>();
  let pointsSpent = 0;
  let moneyAmount = 0;
  let quantity = 0;

  for (const purchase of counted) {
    pointsSpent += purchase.pointsSpent;
    moneyAmount += purchase.moneyAmount ?? 0;
    quantity += purchase.quantity;

    const existing = bucketMap.get(purchase.templateId);
    if (existing) {
      existing.count += 1;
      existing.quantity += purchase.quantity;
      existing.pointsSpent += purchase.pointsSpent;
      existing.moneyAmount += purchase.moneyAmount ?? 0;
    } else {
      // purchases 已按时间倒序，首条即该商品最近的快照
      bucketMap.set(purchase.templateId, {
        templateId: purchase.templateId,
        title: purchase.template.title,
        icon: purchase.template.icon,
        iconColor: purchase.template.iconColor,
        count: 1,
        quantity: purchase.quantity,
        pointsSpent: purchase.pointsSpent,
        moneyAmount: purchase.moneyAmount ?? 0,
      });
    }
  }

  const byTemplate = Array.from(bucketMap.values()).sort(
    (a, b) => b.moneyAmount - a.moneyAmount
  );

  return {
    pointsSpent,
    moneyAmount: Math.round(moneyAmount * 100) / 100,
    count: counted.length,
    quantity,
    byTemplate,
    purchases,
  };
}

// ==================== 商店查询 ====================

/**
 * 获取商店的奖励模板（启用的模板，包含剩余额度；按积分升序，0 积分的免费额度在最前）
 */
export async function getStoreRewardTemplates(
  userId: number
): Promise<Array<{ template: RewardTemplate; availableCount: number }>> {
  const db = getDB();

  const templates = await db.rewardTemplates
    .where('userId')
    .equals(userId)
    .and(t => t.enabled)
    .toArray();

  const result: Array<{ template: RewardTemplate; availableCount: number }> = [];

  for (const template of sortRewardTemplates(templates)) {
    // 对不自动补货的奖品，库存为无限；否则使用 currentStock
    const availableCount = template.replenishmentMode === 'none'
      ? Infinity
      : (template.currentStock ?? 0);
    result.push({ template, availableCount });
  }

  return result;
}

// ==================== 补货相关 ====================

export interface TemplateNeedingReplenishment {
  template: RewardTemplate;
  missedDays: number;
}

/**
 * 计算漏掉的天数
 */
function calculateMissedDays(
  replenishmentMode: ReplenishmentMode,
  lastReplenishedDate: string | undefined,
  userCurrentDate: string,
  repeatDaysOfWeek?: number[],
  repeatDaysOfMonth?: number[]
): number {
  if (lastReplenishedDate === userCurrentDate) return 0;

  if (!lastReplenishedDate) return 1;

  const lastDateObj = new Date(lastReplenishedDate);
  const userCurrentDateObj = new Date(userCurrentDate);

  switch (replenishmentMode) {
    case 'daily': {
      const daysDiff = Math.floor(
        (userCurrentDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff;
    }
    case 'weekly': {
      const targetDays = repeatDaysOfWeek?.length ? repeatDaysOfWeek : [1];
      let missedCount = 0;
      const checkDate = new Date(lastDateObj);
      checkDate.setDate(checkDate.getDate() + 1);
      
      while (checkDate <= userCurrentDateObj) {
        const dayOfWeek = checkDate.getDay();
        if (targetDays.includes(dayOfWeek)) {
          missedCount++;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      return missedCount;
    }
    case 'monthly': {
      const targetDays = repeatDaysOfMonth?.length ? repeatDaysOfMonth : [1];
      let missedCount = 0;
      const checkDate = new Date(lastDateObj);
      checkDate.setDate(checkDate.getDate() + 1);
      
      while (checkDate <= userCurrentDateObj) {
        const dayOfMonth = checkDate.getDate();
        if (targetDays.includes(dayOfMonth)) {
          missedCount++;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      return missedCount;
    }
    default:
      return 0;
  }
}

/**
 * 获取应补货日期列表
 * 按从旧到新的顺序返回
 */
function getReplenishmentScheduledDates(
  replenishmentMode: ReplenishmentMode,
  lastReplenishedDate: string | undefined,
  userCurrentDate: string,
  repeatDaysOfWeek?: number[],
  repeatDaysOfMonth?: number[]
): string[] {
  if (!lastReplenishedDate) return [userCurrentDate];
  if (lastReplenishedDate === userCurrentDate) return [];

  const lastDateObj = new Date(lastReplenishedDate);
  const userCurrentDateObj = new Date(userCurrentDate);
  const dates: string[] = [];

  const checkDate = new Date(lastDateObj);
  checkDate.setDate(checkDate.getDate() + 1);

  while (checkDate <= userCurrentDateObj) {
    let shouldInclude = false;

    switch (replenishmentMode) {
      case 'daily':
        shouldInclude = true;
        break;
      case 'weekly': {
        const targetDays = repeatDaysOfWeek?.length ? repeatDaysOfWeek : [1];
        shouldInclude = targetDays.includes(checkDate.getDay());
        break;
      }
      case 'monthly': {
        const targetDays = repeatDaysOfMonth?.length ? repeatDaysOfMonth : [1];
        shouldInclude = targetDays.includes(checkDate.getDate());
        break;
      }
    }

    if (shouldInclude) {
      const y = checkDate.getFullYear();
      const m = String(checkDate.getMonth() + 1).padStart(2, '0');
      const d = String(checkDate.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }

    checkDate.setDate(checkDate.getDate() + 1);
  }

  return dates;
}

/**
 * 获取需要补货的奖励模板
 * 根据 replenishmentMode 和上次补货时间判断是否需要补货
 * 返回需要补货的模板及其漏掉天数
 */
export async function getTemplatesNeedingReplenishment(
  userId: number,
  dayEndTime: string = "00:00"
): Promise<TemplateNeedingReplenishment[]> {
  const db = getDB();

  const userCurrentDate = getUserCurrentDate(dayEndTime);

  const templates = await db.rewardTemplates
    .where('userId')
    .equals(userId)
    .and(t => t.enabled && t.replenishmentMode !== 'none')
    .toArray();

  return templates
    .map(template => {
      const { replenishmentMode, repeatDaysOfWeek, repeatDaysOfMonth, lastReplenishedDate } = template;

      const missedDays = calculateMissedDays(
        replenishmentMode,
        lastReplenishedDate,
        userCurrentDate,
        repeatDaysOfWeek,
        repeatDaysOfMonth
      );

      return { template, missedDays };
    })
    .filter(t => t.missedDays > 0);
}

/**
 * 为模板补货
 * @param templateId 模板ID
 * @param missedDays 漏掉的天数，默认为1
 * @param reason 补货原因，默认为自动补货
 */
export async function replenishRewardTemplate(
  templateId: string,
  missedDays: number = 1,
  reason: "auto" | "manual" = "auto"
): Promise<number> {
  const db = getDB();

  return db.transaction(
    "rw",
    [db.rewardTemplates, db.replenishmentRecords],
    async () => {
      const template = await db.rewardTemplates.get(templateId);
      if (!template) {
        throw new Error('Reward template not found');
      }

      if (!template.enabled) {
        throw new Error('Reward template is disabled');
      }

      // 防止竞态条件：在 transaction 内重新检查是否仍需要补货
      const userCurrentDate = getUserCurrentDate();
      const actualMissedDays = calculateMissedDays(
        template.replenishmentMode,
        template.lastReplenishedDate,
        userCurrentDate,
        template.repeatDaysOfWeek,
        template.repeatDaysOfMonth
      );
      if (actualMissedDays <= 0) {
        return 0;
      }
      // 如果实际漏掉天数小于传入值，以实际为准（其他进程已补货了部分）
      const effectiveMissedDays = Math.min(missedDays, actualMissedDays);

      // 获取应补货日期列表
      const scheduledDates = getReplenishmentScheduledDates(
        template.replenishmentMode,
        template.lastReplenishedDate,
        userCurrentDate,
        template.repeatDaysOfWeek,
        template.repeatDaysOfMonth
      );
      const datesToReplenish = scheduledDates.slice(0, effectiveMissedDays);
      if (datesToReplenish.length === 0) {
        return 0;
      }

      let currentStock = template.currentStock ?? 0;
      const dailyReplenishCount = template.replenishmentNum || 1;
      const now = new Date().toISOString();
      let totalReplenished = 0;

      for (const scheduledDate of datesToReplenish) {
        // 检查库存上限
        if (template.replenishmentLimit !== undefined && currentStock >= template.replenishmentLimit) {
          break;
        }

        let dayCount = dailyReplenishCount;
        if (template.replenishmentLimit !== undefined) {
          const availableSpace = template.replenishmentLimit - currentStock;
          dayCount = Math.min(dayCount, availableSpace);
        }

        if (dayCount <= 0) break;

        const newStock = currentStock + dayCount;

        // 写入补货记录（每天一条）
        await db.replenishmentRecords.add({
          id: "" as string,
          templateId,
          userId: template.userId,
          quantity: dayCount,
          stockBefore: currentStock,
          stockAfter: newStock,
          reason,
          scheduledDate,
          createdAt: now,
        } as unknown as ReplenishmentRecord);

        currentStock = newStock;
        totalReplenished += dayCount;
      }

      if (totalReplenished > 0) {
        // 更新模板库存和最后补货日期
        const lastScheduledDate = datesToReplenish[datesToReplenish.length - 1];
        await db.rewardTemplates.update(templateId, {
          currentStock,
          lastReplenishedDate: lastScheduledDate,
          updatedAt: now,
        });
      }

      return totalReplenished;
    }
  );
}

// ==================== ReplenishmentRecord CRUD ====================

/**
 * 创建补货记录
 */
export async function createReplenishmentRecord(
  record: Omit<ReplenishmentRecord, "id" | "createdAt">
): Promise<string> {
  const db = getDB();
  return db.replenishmentRecords.add({
    ...record,
    id: "" as string,
    createdAt: new Date().toISOString(),
  } as unknown as ReplenishmentRecord);
}

/**
 * 根据模板ID获取补货记录（按时间倒序）
 */
export async function getReplenishmentRecordsByTemplateId(
  templateId: string
): Promise<ReplenishmentRecord[]> {
  const db = getDB();
  return db.replenishmentRecords
    .where("templateId")
    .equals(templateId)
    .reverse()
    .sortBy("createdAt");
}

/**
 * 根据用户ID获取补货记录
 */
export async function getReplenishmentRecordsByUserId(
  userId: number,
  limit?: number
): Promise<ReplenishmentRecord[]> {
  const db = getDB();
  const records = await db.replenishmentRecords
    .where("userId")
    .equals(userId)
    .reverse()
    .sortBy("createdAt");
  return limit ? records.slice(0, limit) : records;
}

/**
 * 删除某模板的所有补货记录
 */
export async function deleteReplenishmentRecordsByTemplateId(templateId: string): Promise<number> {
  const db = getDB();
  return db.replenishmentRecords.where("templateId").equals(templateId).delete();
}
