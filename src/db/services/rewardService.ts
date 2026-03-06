import { useDB } from '../index';
import type { RewardTemplate, RewardInstance, RewardStatus, ReplenishmentMode } from '../types';

// ==================== RewardTemplate CRUD ====================

/**
 * 创建奖励模板
 */
export async function createRewardTemplate(
  template: Omit<RewardTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();

  const now = new Date().toISOString();
  const newTemplate: RewardTemplate = {
    ...template,
    createdAt: now,
    updatedAt: now,
  };

  return db.rewardTemplates.add(newTemplate);
}

/**
 * 获取所有奖励模板
 */
export async function getAllRewardTemplates(userId?: number): Promise<RewardTemplate[]> {
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
export async function getRewardTemplateById(id: number): Promise<RewardTemplate | undefined> {
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  id: number,
  updates: Partial<Omit<RewardTemplate, 'id' | 'createdAt'>>
): Promise<number> {
  const { getDB } = useDB();
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
export async function deleteRewardTemplate(id: number): Promise<void> {
  const { getDB } = useDB();
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
  id: number,
  enabled?: boolean
): Promise<number> {
  const { getDB } = useDB();
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
 */
export async function createRewardInstance(
  instance: Omit<RewardInstance, 'id' | 'createdAt'>
): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();

  const newInstance: RewardInstance = {
    ...instance,
    createdAt: new Date().toISOString(),
  };

  return db.rewardInstances.add(newInstance);
}

/**
 * 批量创建奖励实例
 */
export async function createRewardInstances(
  instances: Omit<RewardInstance, 'id' | 'createdAt'>[]
): Promise<number[]> {
  const { getDB } = useDB();
  const db = getDB();

  const now = new Date().toISOString();
  const newInstances: RewardInstance[] = instances.map((instance) => ({
    ...instance,
    createdAt: now,
  }));

  return db.rewardInstances.bulkAdd(newInstances, { allKeys: true });
}

/**
 * 获取所有奖励实例
 */
export async function getAllRewardInstances(userId?: number): Promise<RewardInstance[]> {
  const { getDB } = useDB();
  const db = getDB();

  if (userId !== undefined) {
    return db.rewardInstances.where('userId').equals(userId).toArray();
  }
  return db.rewardInstances.toArray();
}

/**
 * 根据ID获取奖励实例
 */
export async function getRewardInstanceById(id: number): Promise<RewardInstance | undefined> {
  const { getDB } = useDB();
  const db = getDB();
  return db.rewardInstances.get(id);
}

/**
 * 根据模板ID获取奖励实例
 */
export async function getRewardInstancesByTemplateId(templateId: number): Promise<RewardInstance[]> {
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
  id: number,
  updates: Partial<Omit<RewardInstance, 'id'>>
): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();
  return db.rewardInstances.update(id, updates);
}

/**
 * 使用奖励实例
 */
export async function useRewardInstance(id: number): Promise<number> {
  const { getDB } = useDB();
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
 * 检查并更新过期状态
 */
export async function checkAndUpdateExpiredRewards(userId?: number): Promise<number> {
  const { getDB } = useDB();
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
export async function deleteRewardInstance(id: number): Promise<void> {
  const { getDB } = useDB();
  const db = getDB();
  return db.rewardInstances.delete(id);
}

/**
 * 批量删除奖励实例
 */
export async function deleteRewardInstances(ids: number[]): Promise<void> {
  const { getDB } = useDB();
  const db = getDB();
  return db.rewardInstances.bulkDelete(ids);
}

/**
 * 删除指定模板的所有奖励实例
 */
export async function deleteRewardInstancesByTemplateId(templateId: number): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();
  return db.rewardInstances.where('templateId').equals(templateId).delete();
}

// ==================== 复合查询 ====================

/**
 * 获取奖励实例及其模板信息
 */
export async function getRewardInstanceWithTemplate(
  instanceId: number
): Promise<{ instance: RewardInstance; template?: RewardTemplate } | undefined> {
  const { getDB } = useDB();
  const db = getDB();

  const instance = await db.rewardInstances.get(instanceId);
  if (!instance) {
    return undefined;
  }

  const template = await db.rewardTemplates.get(instance.templateId);
  return { instance, template };
}

/**
 * 获取用户的可用奖励实例（包含模板信息）
 */
export async function getAvailableRewardInstances(
  userId: number
): Promise<Array<{ instance: RewardInstance; template: RewardTemplate }>> {
  const { getDB } = useDB();
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
    const template = await db.rewardTemplates.get(instance.templateId);
    if (template) {
      result.push({ instance, template });
    }
  }

  return result;
}

/**
 * 获取用户的背包（所有奖励实例，包含模板信息）
 */
export async function getUserBackpack(
  userId: number
): Promise<Array<{ instance: RewardInstance; template: RewardTemplate }>> {
  const { getDB } = useDB();
  const db = getDB();

  // 先检查并更新过期状态
  await checkAndUpdateExpiredRewards(userId);

  const instances = await db.rewardInstances
    .where('userId')
    .equals(userId)
    .toArray();

  const result: Array<{ instance: RewardInstance; template: RewardTemplate }> = [];

  for (const instance of instances) {
    const template = await db.rewardTemplates.get(instance.templateId);
    if (template) {
      result.push({ instance, template });
    }
  }

  return result;
}

/**
 * 获取商店的奖励模板（启用的模板，包含库存数量）
 */
export async function getStoreRewardTemplates(
  userId: number
): Promise<Array<{ template: RewardTemplate; availableCount: number }>> {
  const { getDB } = useDB();
  const db = getDB();

  // 先检查并更新过期状态
  await checkAndUpdateExpiredRewards(userId);

  const templates = await db.rewardTemplates
    .where('userId')
    .equals(userId)
    .and(t => t.enabled)
    .toArray();

  const result: Array<{ template: RewardTemplate; availableCount: number }> = [];

  for (const template of templates) {
    const availableCount = await db.rewardInstances
      .where('templateId')
      .equals(template.id!)
      .and(i => i.status === 'available')
      .count();

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
  const { getDB } = useDB();
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
  const { getDB } = useDB();
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
 */
export async function replenishRewardTemplate(templateId: number): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();

  const template = await db.rewardTemplates.get(templateId);
  if (!template) {
    throw new Error('Reward template not found');
  }

  if (!template.enabled) {
    throw new Error('Reward template is disabled');
  }

  // 检查当前库存
  const currentCount = await db.rewardInstances
    .where('templateId')
    .equals(templateId)
    .and(i => i.status === 'available')
    .count();

  // 检查库存限制
  if (template.replenishmentLimit !== undefined && currentCount >= template.replenishmentLimit) {
    return 0; // 已达到库存上限，无需补货
  }

  // 计算补货数量
  let replenishCount = template.replenishmentNum || 1;
  if (template.replenishmentLimit !== undefined) {
    const availableSpace = template.replenishmentLimit - currentCount;
    replenishCount = Math.min(replenishCount, availableSpace);
  }

  if (replenishCount <= 0) {
    return 0;
  }

  // 创建奖励实例
  const expiresAt = template.validDuration > 0
    ? new Date(Date.now() + template.validDuration * 1000).toISOString()
    : undefined;

  const newInstances: Omit<RewardInstance, 'id' | 'createdAt'>[] = Array.from(
    { length: replenishCount },
    () => ({
      templateId,
      userId: template.userId,
      status: 'available' as RewardStatus,
      expiresAt,
    })
  );

  const ids = await createRewardInstances(newInstances);
  return ids.length;
}
