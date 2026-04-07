import { getDB } from '../index';
import type { RewardTemplate, RewardInstance, RewardStatus, ReplenishmentMode } from '../types';

// ==================== RewardTemplate CRUD ====================

/**
 * 创建奖励模板
 */
export async function createRewardTemplate(
  template: Omit<RewardTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = getDB();

  const now = new Date().toISOString();
  const newTemplate: RewardTemplate = {
    ...template,
    id: '' as string, // Dexie auto-generates
    createdAt: now,
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
 * 删除奖励模板（同时删除关联的奖励实例）
 */
export async function deleteRewardTemplate(id: string): Promise<void> {
  const db = getDB();

  await db.transaction('rw', db.rewardTemplates, db.rewardInstances, async () => {
    await db.rewardInstances.where('templateId').equals(id).delete();
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

/**
 * 获取需要补货的奖励模板
 * 根据 replenishmentMode 和上次补货时间判断是否需要补货
 */
export async function getTemplatesNeedingReplenishment(
  userId: number
): Promise<RewardTemplate[]> {
  const db = getDB();

  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentDayOfMonth = now.getDate();

  const templates = await db.rewardTemplates
    .where('userId')
    .equals(userId)
    .and(t => t.enabled && t.replenishmentMode !== 'none')
    .toArray();

  return templates.filter(template => {
    const { replenishmentMode, repeatDaysOfWeek, repeatDaysOfMonth, repeatInterval } = template;

    switch (replenishmentMode) {
      case 'daily': {
        // 每天或每N天
        if (!repeatInterval || repeatInterval === 1) return true;
        // 这里简化处理，实际应该记录上次补货时间
        return true;
      }
      case 'weekly': {
        // 检查今天是否在指定的星期几列表中
        if (repeatDaysOfWeek && repeatDaysOfWeek.length > 0) {
          return repeatDaysOfWeek.includes(currentDayOfWeek);
        }
        return currentDayOfWeek === 1; // 默认周一
      }
      case 'monthly': {
        // 检查今天是否在指定的日期列表中
        if (repeatDaysOfMonth && repeatDaysOfMonth.length > 0) {
          return repeatDaysOfMonth.includes(currentDayOfMonth);
        }
        return currentDayOfMonth === 1; // 默认每月1号
      }
      default:
        return false;
    }
  });
}

/**
 * 为模板补货
 * 修改：增加 currentStock 而不是直接创建实例
 */
export async function replenishRewardTemplate(templateId: string): Promise<number> {
  const db = getDB();

  const template = await db.rewardTemplates.get(templateId);
  if (!template) {
    throw new Error('Reward template not found');
  }

  if (!template.enabled) {
    throw new Error('Reward template is disabled');
  }

  // 使用 currentStock 作为当前库存（如果没有则默认为0）
  const currentStock = template.currentStock ?? 0;

  // 检查库存限制
  if (template.replenishmentLimit !== undefined && currentStock >= template.replenishmentLimit) {
    return 0; // 已达到库存上限，无需补货
  }

  // 计算补货数量
  let replenishCount = template.replenishmentNum || 1;
  if (template.replenishmentLimit !== undefined) {
    const availableSpace = template.replenishmentLimit - currentStock;
    replenishCount = Math.min(replenishCount, availableSpace);
  }

  if (replenishCount <= 0) {
    return 0;
  }

  // 更新库存数量
  const newStock = currentStock + replenishCount;
  await db.rewardTemplates.update(templateId, {
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  });

  return replenishCount;
}
