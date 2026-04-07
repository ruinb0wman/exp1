import { getDB } from '../index';
import type { User, PointsHistory, PointsHistoryType } from '../types';
import type { PomoSettings } from '../types/pomo';
import { DEFAULT_POMO_SETTINGS } from '../types/pomo';

const DEFAULT_USER: User = {
  id: 1,
  name: 'User',
  totalPoints: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  dayEndTime: "00:00",
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
 * 更新用户积分 - 在事务内添加积分历史记录并计算新积分
 * @returns 返回更新后的新积分余额
 */
export async function updateUserPoints(
  userId: number,
  amount: number,
  type: PointsHistoryType,
  relatedInstanceId?: string
): Promise<number> {
  const db = getDB();

  return db.transaction('rw', db.users, db.pointsHistory, async () => {
    const user = await db.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 在事务内查询所有积分记录并计算当前积分
    const records = await db.pointsHistory.where('userId').equals(userId).toArray();
    const currentPoints = records.reduce((sum, record) => sum + record.amount, 0);
    
    // 检查积分是否足够扣除
    const newPoints = currentPoints + amount;
    if (newPoints < 0) {
      throw new Error('Insufficient points');
    }

    // 添加积分历史记录
    const now = new Date().toISOString();
    const history: PointsHistory = {
      userId,
      amount,
      type,
      relatedInstanceId,
      createdAt: now,
    } as unknown as PointsHistory;
    await db.pointsHistory.add(history);

    // 返回计算后的新积分（包含刚添加的记录）
    return newPoints;
  });
}

export async function getPointsHistory(userId: number): Promise<PointsHistory[]> {
  const db = getDB();
  return db.pointsHistory.where('userId').equals(userId).reverse().sortBy('createdAt');
}

/**
 * 更新用户的一天结束时间
 * 使用 instanceDate 作为业务主键，无需修改任务实例
 */
export async function updateUserDayEndTime(
  userId: number,
  newDayEndTime: string
): Promise<number> {
  const db = getDB();

  const user = await db.users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return db.users.update(userId, { dayEndTime: newDayEndTime });
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
