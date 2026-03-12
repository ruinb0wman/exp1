import { getDB } from '../index';
import type { User, PointsHistory, PointsHistoryType } from '../types';
import type { PomoSettings } from '../types/pomo';
import { DEFAULT_POMO_SETTINGS } from '../types/pomo';
import { calculateExpiredAt, getUserStartOfDay } from '@/libs/time';
import { toUserDateString } from '@/libs/task';

const DEFAULT_USER: Omit<User, 'id'> = {
  name: 'User',
  createdAt: new Date().toISOString(),
};

/**
 * 计算用户的当前积分（根据积分历史记录实时计算）
 */
export async function calculateUserPoints(userId: number): Promise<number> {
  const db = getDB();
  const records = await db.pointsHistory.where('userId').equals(userId).toArray();
  return records.reduce((sum, record) => sum + record.amount, 0);
}

export async function getOrCreateUser(): Promise<User> {
  const db = getDB();

  let user = await db.users.toCollection().first();

  if (!user) {
    const id = await db.users.add(DEFAULT_USER as User);
    user = await db.users.get(id);
  }

  if (!user) {
    throw new Error('Failed to get or create user');
  }

  return user;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = getDB();
  return db.users.get(id);
}

export async function updateUser(
  id: number,
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<number> {
  const db = getDB();
  return db.users.update(id, updates);
}

/**
 * 更新用户积分 - 只添加积分历史记录，不直接存储 currentPoints
 * 积分通过 calculateUserPoints 函数实时计算
 */
export async function updateUserPoints(
  userId: number,
  amount: number,
  type: PointsHistoryType,
  relatedTemplateId?: number
): Promise<void> {
  const db = getDB();

  await db.transaction('rw', db.users, db.pointsHistory, async () => {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 计算当前积分，检查是否足够扣除
    const currentPoints = await calculateUserPoints(userId);
    const newPoints = currentPoints + amount;
    if (newPoints < 0) {
      throw new Error('Insufficient points');
    }

    // 只添加积分历史记录，不再更新 user.currentPoints
    const history: PointsHistory = {
      userId,
      amount,
      type,
      relatedTemplateId,
      createdAt: new Date().toISOString(),
    };
    await db.pointsHistory.add(history);
  });
}

export async function getPointsHistory(userId: number): Promise<PointsHistory[]> {
  const db = getDB();
  return db.pointsHistory.where('userId').equals(userId).reverse().sortBy('createdAt');
}

/**
 * 更新用户的一天结束时间
 * 同时重新计算所有 pending 状态任务实例的 startAt 和 expiredAt
 * 确保实例在新的 dayEndTime 下能正确显示在"今天"的任务列表中
 */
export async function updateUserDayEndTime(
  userId: number,
  newDayEndTime: string
): Promise<number> {
  const db = getDB();

  return db.transaction('rw', db.users, db.taskInstances, db.taskTemplates, async () => {
    // 1. 获取用户当前的 dayEndTime（旧值）
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const oldDayEndTime = user.dayEndTime ?? "00:00";

    // 2. 更新用户的 dayEndTime
    const updateResult = await db.users.update(userId, { dayEndTime: newDayEndTime });

    // 3. 获取所有 pending 状态的任务实例（包括有 startAt 的）
    const pendingInstances = await db.taskInstances
      .where('userId')
      .equals(userId)
      .and(instance => instance.status === 'pending' && !!instance.startAt)
      .toArray();

    if (pendingInstances.length === 0) {
      return updateResult;
    }

    // 4. 获取所有需要的模板信息（用于重新计算 expiredAt）
    const templateIds = [...new Set(pendingInstances.map(i => i.templateId))];
    const templates = await db.taskTemplates
      .where('id')
      .anyOf(templateIds)
      .toArray();
    const templateMap = new Map(templates.map(t => [t.id!, t]));

    // 5. 重新计算每个实例的 startAt 和 expiredAt
    const updates: { id: number; startAt: string; expiredAt?: string }[] = [];
    
    for (const instance of pendingInstances) {
      const template = templateMap.get(instance.templateId);
      
      // 用旧的 dayEndTime 计算实例原来的"用户日期"
      const oldUserDateStr = toUserDateString(instance.startAt!, oldDayEndTime);
      const [year, month, day] = oldUserDateStr.split('-').map(Number);
      const oldUserDate = new Date(year, month - 1, day);

      // 用新的 dayEndTime 重新计算 startAt
      const newStartAt = getUserStartOfDay(oldUserDate, newDayEndTime);
      
      // 如果有过期设置，重新计算 expiredAt
      let newExpiredAt: string | undefined;
      if (template?.completeExpireDays && template.completeExpireDays > 0) {
        newExpiredAt = calculateExpiredAt(newStartAt, template.completeExpireDays, newDayEndTime);
      }

      // 检查是否有变化
      const hasStartAtChanged = newStartAt !== instance.startAt;
      const hasExpiredAtChanged = newExpiredAt !== instance.expiredAt;

      if (hasStartAtChanged || hasExpiredAtChanged) {
        updates.push({ 
          id: instance.id!, 
          startAt: newStartAt, 
          expiredAt: newExpiredAt 
        });
      }
    }

    // 6. 批量更新实例
    if (updates.length > 0) {
      await Promise.all(
        updates.map(({ id, startAt, expiredAt }) =>
          db.taskInstances.update(id, { startAt, expiredAt })
        )
      );
    }

    return updateResult;
  });
}

/**
 * 获取用户的番茄钟设置
 * 如果不存在则返回默认设置
 */
export async function getUserPomoSettings(userId: number): Promise<PomoSettings> {
  const db = getDB();
  const user = await db.users.get(userId);
  return user?.pomoSettings ? { ...DEFAULT_POMO_SETTINGS, ...user.pomoSettings } : { ...DEFAULT_POMO_SETTINGS };
}

/**
 * 更新用户的番茄钟设置
 */
export async function updateUserPomoSettings(
  userId: number,
  settings: Partial<PomoSettings>
): Promise<number> {
  const db = getDB();
  const user = await db.users.get(userId);
  const currentSettings = user?.pomoSettings || { ...DEFAULT_POMO_SETTINGS };
  const newSettings = { ...currentSettings, ...settings };
  return db.users.update(userId, { pomoSettings: newSettings });
}
