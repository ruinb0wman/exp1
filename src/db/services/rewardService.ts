import { getDB } from '../index';
import type { RewardTemplate, RewardInstance, RewardStatus, ReplenishmentMode, ReplenishmentRecord } from '../types';
import { getUserCurrentDate } from '@/libs/time';

// ==================== RewardTemplate CRUD ====================

/**
 * 创建奖励模板
 */
export async function createRewardTemplate(
  template: Omit<RewardTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDB();

  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const shouldReplenish = template.replenishmentMode !== 'none';

  const newTemplate: RewardTemplate = {
    ...template,
    id: '' as string,
    createdAt: now,
    currentStock: shouldReplenish ? 0 : undefined,
    lastReplenishedDate: shouldReplenish ? today : undefined,
  };

  return db.rewardTemplates.add(newTemplate as unknown as RewardTemplate);
}

/**
 * 获取所有奖励模板
 */
export async function getAllRewardTemplates(userId?: number): Promise<RewardTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    return db.rewardTemplates.where('userId').equals(userId).toArray();
  }
  return db.rewardTemplates.toArray();
}

/**
 * 获取启用的奖励模板
 */
export async function getEnabledRewardTemplates(userId?: number): Promise<RewardTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.rewardTemplates.where('userId').equals(userId).toArray();
    return templates.filter(t => t.enabled);
  }
  return db.rewardTemplates.filter(t => t.enabled).toArray();
}

/**
 * 根据ID获取奖励模板
 */
export async function getRewardTemplateById(id: string): Promise<RewardTemplate | undefined> {
  const db = getDB();
  return db.rewardTemplates.get(id);
}

/**
 * 根据补货模式获取奖励模板
 */
export async function getRewardTemplatesByReplenishmentMode(
  mode: ReplenishmentMode,
  userId?: number
): Promise<RewardTemplate[]> {
  const db = getDB();

  if (userId !== undefined) {
    const templates = await db.rewardTemplates.where('userId').equals(userId).toArray();
    return templates.filter(t => t.replenishmentMode === mode);
  }
  return db.rewardTemplates.where('replenishmentMode').equals(mode).toArray();
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
    updatedAt: new Date().toISOString(),
  };

  return db.rewardTemplates.update(id, updateData);
}

/**
 * 删除奖励模板（同时删除关联的奖励实例和补货记录）
 */
export async function deleteRewardTemplate(id: string): Promise<void> {
  const db = getDB();

  await db.transaction('rw', db.rewardTemplates, db.rewardInstances, db.replenishmentRecords, async () => {
    await db.rewardInstances.where('templateId').equals(id).delete();
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

// ==================== RewardInstance CRUD ====================

/**
 * 创建奖励实例（兑换奖励）
 * 注意：此函数不检查库存，直接使用 createRewardInstanceWithStockCheck
 */
export async function createRewardInstance(
  instance: Omit<RewardInstance, 'id' | 'createdAt'>
): Promise<string> {
  const db = getDB();

  const newInstance: RewardInstance = {
    ...instance,
    id: '' as string, // Dexie auto-generates
    createdAt: new Date().toISOString(),
  };

  return db.rewardInstances.add(newInstance as unknown as RewardInstance);
}

/**
 * 兑换奖励（带库存检查）
 * 检查库存、扣除库存，然后创建奖励实例
 */
export async function redeemRewardWithStockCheck(
  templateId: string,
  userId: number
): Promise<string> {
  const ids = await redeemRewardsWithStockCheck(templateId, userId, 1);
  return ids[0];
}

export async function redeemRewardsWithStockCheck(
  templateId: string,
  userId: number,
  quantity: number
): Promise<string[]> {
  const db = getDB();

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  return db.transaction('rw', db.rewardTemplates, db.rewardInstances, db.pointsHistory, async () => {
    const template = await db.rewardTemplates.get(templateId);
    if (!template) {
      throw new Error('Reward template not found');
    }

    if (!template.enabled) {
      throw new Error('Reward template is disabled');
    }

    // 检查库存（仅对自动补货的奖品）
    if (template.replenishmentMode !== 'none') {
      const currentStock = template.currentStock ?? 0;
      if (currentStock < quantity) {
        throw new Error('Reward out of stock');
      }

      // 扣除库存
      await db.rewardTemplates.update(templateId, {
        currentStock: currentStock - quantity,
        updatedAt: new Date().toISOString(),
      });
    }

    // 检查积分是否足够
    const totalCost = template.pointsCost * quantity;
    const pointsRecords = await db.pointsHistory.where('userId').equals(userId).toArray();
    const currentPoints = pointsRecords.reduce((sum, record) => sum + record.amount, 0);

    if (currentPoints < totalCost) {
      throw new Error(`积分不足。需要: ${totalCost}, 当前: ${currentPoints}`);
    }

    // 批量创建奖励实例
    const expiresAt = template.validDuration > 0
      ? new Date(Date.now() + template.validDuration * 1000).toISOString()
      : undefined;

    const now = new Date().toISOString();
    const newInstances: Omit<RewardInstance, 'id'>[] = Array.from(
      { length: quantity },
      () => ({
        templateId,
        template: { ...template }, // 保存完整的模板快照
        userId,
        status: 'available',
        createdAt: now,
        expiresAt,
      })
    );

    const ids = await createRewardInstances(newInstances);
    return ids;
  });
}

/**
 * 批量创建奖励实例
 */
export async function createRewardInstances(
  instances: Omit<RewardInstance, 'id' | 'createdAt'>[]
): Promise<string[]> {
  const db = getDB();

  const now = new Date().toISOString();
  const newInstances: RewardInstance[] = instances.map((instance) => ({
    ...instance,
    id: '' as string, // Dexie auto-generates
    createdAt: now,
  }));

  return db.rewardInstances.bulkAdd(newInstances as unknown as RewardInstance[], { allKeys: true });
}

/**
 * 获取所有奖励实例
 */
export async function getAllRewardInstances(userId?: number): Promise<RewardInstance[]> {
  const db = getDB();

  if (userId !== undefined) {
    return db.rewardInstances.where('userId').equals(userId).toArray();
  }
  return db.rewardInstances.toArray();
}

/**
 * 根据ID获取奖励实例
 */
export async function getRewardInstanceById(id: string): Promise<RewardInstance | undefined> {
  const db = getDB();
  return db.rewardInstances.get(id);
}

export async function getRewardInstancesByTemplateId(templateId: string): Promise<RewardInstance[]> {
  const db = getDB();
  return db.rewardInstances.where('templateId').equals(templateId).toArray();
}

/**
 * 根据状态获取奖励实例
 */
export async function getRewardInstancesByStatus(
  status: RewardStatus,
  userId?: number
): Promise<RewardInstance[]> {
  const db = getDB();

  if (userId !== undefined) {
    const instances = await db.rewardInstances.where('userId').equals(userId).toArray();
    return instances.filter(i => i.status === status);
  }
  return db.rewardInstances.where('status').equals(status).toArray();
}

/**
 * 更新奖励实例
 */
export async function updateRewardInstance(
  id: string,
  updates: Partial<Omit<RewardInstance, 'id'>>
): Promise<number> {
  const db = getDB();
  return db.rewardInstances.update(id, updates);
}

export async function useRewardInstance(id: string): Promise<number> {
  const db = getDB();

  const instance = await db.rewardInstances.get(id);
  if (!instance) {
    throw new Error('Reward instance not found');
  }

  if (instance.status === 'used') {
    throw new Error('Reward instance already used');
  }

  if (instance.status === 'expired') {
    throw new Error('Reward instance has expired');
  }

  // 检查是否过期
  if (instance.expiresAt && new Date(instance.expiresAt) < new Date()) {
    await db.rewardInstances.update(id, { status: 'expired' });
    throw new Error('Reward instance has expired');
  }

  return db.rewardInstances.update(id, {
    status: 'used',
    usedAt: new Date().toISOString(),
  });
}

/**
 * 批量使用奖励实例
 * 按创建时间排序（FIFO），过滤掉已过期/已使用的实例
 * @param ids 实例ID数组
 * @param quantity 要使用数量，默认为全部
 * @returns 实际使用的数量
 */
export async function useRewardInstances(
  ids: string[],
  quantity?: number
): Promise<number> {
  const db = getDB();
  const now = new Date().toISOString();

  return db.transaction('rw', db.rewardInstances, async () => {
    // 获取所有实例
    const instances = await db.rewardInstances.bulkGet(ids);

    // 过滤有效实例（available + 未过期）
    const validInstances = instances
      .filter((instance): instance is NonNullable<typeof instance> => {
        if (!instance) return false;
        if (instance.status !== 'available') return false;
        if (instance.expiresAt && instance.expiresAt < now) return false;
        return true;
      })
      // 按创建时间排序（FIFO）
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (validInstances.length === 0) {
      throw new Error('No valid reward instances found');
    }

    // 确定实际使用数量
    const useCount = quantity !== undefined
      ? Math.min(quantity, validInstances.length)
      : validInstances.length;

    // 取前 useCount 个实例
    const instancesToUse = validInstances.slice(0, useCount);

    // 批量更新
    const updates = instancesToUse.map((instance) => ({
      key: instance.id!,
      changes: {
        status: 'used' as const,
        usedAt: now,
      },
    }));

    await db.rewardInstances.bulkUpdate(updates);

    return useCount;
  });
}

/**
 * 检查并更新过期状态
 */
export async function checkAndUpdateExpiredRewards(userId?: number): Promise<number> {
  const db = getDB();

  const now = new Date().toISOString();
  let instances: RewardInstance[];

  if (userId !== undefined) {
    instances = await db.rewardInstances
      .where('userId')
      .equals(userId)
      .and(i => i.status === 'available')
      .toArray();
  } else {
    instances = await db.rewardInstances
      .where('status')
      .equals('available')
      .toArray();
  }

  const expiredIds = instances
    .filter(i => i.expiresAt && i.expiresAt < now)
    .map(i => i.id!);

  if (expiredIds.length > 0) {
    await db.rewardInstances.bulkUpdate(
      expiredIds.map(id => ({ key: id, changes: { status: 'expired' } }))
    );
  }

  return expiredIds.length;
}

/**
 * 删除奖励实例
 */
export async function deleteRewardInstance(id: string): Promise<void> {
  const db = getDB();
  return db.rewardInstances.delete(id);
}

export async function deleteRewardInstances(ids: string[]): Promise<void> {
  const db = getDB();
  return db.rewardInstances.bulkDelete(ids);
}

export async function deleteRewardInstancesByTemplateId(templateId: string): Promise<number> {
  const db = getDB();
  return db.rewardInstances.where('templateId').equals(templateId).delete();
}

// ==================== 复合查询 ====================

/**
 * 获取奖励实例及其模板信息
 * 使用实例中保存的 template 快照
 */
export async function getRewardInstanceWithTemplate(
  instanceId: string
): Promise<{ instance: RewardInstance; template: RewardTemplate } | undefined> {
  const db = getDB();

  const instance = await db.rewardInstances.get(instanceId);
  if (!instance) {
    return undefined;
  }

  // 使用快照中的模板
  return { instance, template: instance.template };
}

/**
 * 获取用户的可用奖励实例（包含模板信息）
 * 优先使用实例中保存的 template 快照
 */
export async function getAvailableRewardInstances(
  userId: number
): Promise<Array<{ instance: RewardInstance; template: RewardTemplate }>> {
  const db = getDB();

  // 先检查并更新过期状态
  await checkAndUpdateExpiredRewards(userId);

  const instances = await db.rewardInstances
    .where('userId')
    .equals(userId)
    .and(i => i.status === 'available')
    .toArray();

  const result: Array<{ instance: RewardInstance; template: RewardTemplate }> = [];

  for (const instance of instances) {
    // 使用快照中的模板
    result.push({ instance, template: instance.template });
  }

  return result;
}

/**
 * 获取用户的背包（所有奖励实例，包含模板信息）
 * 使用实例中保存的 template 快照
 */
export async function getUserBackpack(
  userId: number
): Promise<Array<{ instance: RewardInstance; template: RewardTemplate }>> {
  const db = getDB();

  // 先检查并更新过期状态
  await checkAndUpdateExpiredRewards(userId);

  const instances = await db.rewardInstances
    .where('userId')
    .equals(userId)
    .toArray();

  const result: Array<{ instance: RewardInstance; template: RewardTemplate }> = [];

  for (const instance of instances) {
    // 使用快照中的模板
    result.push({ instance, template: instance.template });
  }

  return result;
}

/**
 * 获取商店的奖励模板（启用的模板，包含库存数量）
 * 修改：使用 currentStock 而不是实例数量
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

  for (const template of templates) {
    // 对不自动补货的奖品，库存为无限；否则使用 currentStock
    const availableCount = template.replenishmentMode === 'none'
      ? Infinity
      : (template.currentStock ?? 0);
    result.push({ template, availableCount });
  }

  return result;
}

/**
 * 获取奖励统计信息
 */
export async function getRewardStatistics(
  userId: number
): Promise<{
  total: number;
  available: number;
  used: number;
  expired: number;
}> {
  const db = getDB();

  // 先检查并更新过期状态
  await checkAndUpdateExpiredRewards(userId);

  const instances = await db.rewardInstances.where('userId').equals(userId).toArray();

  return {
    total: instances.length,
    available: instances.filter(i => i.status === 'available').length,
    used: instances.filter(i => i.status === 'used').length,
    expired: instances.filter(i => i.status === 'expired').length,
  };
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
