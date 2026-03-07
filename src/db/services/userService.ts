import { getDB } from '../index';
import type { User, PointsHistory, PointsHistoryType } from '../types';

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
  relatedEntityId?: number
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
      relatedEntityId,
      createdAt: new Date().toISOString(),
    };
    await db.pointsHistory.add(history);
  });
}

export async function getPointsHistory(userId: number): Promise<PointsHistory[]> {
  const db = getDB();
  return db.pointsHistory.where('userId').equals(userId).reverse().sortBy('createdAt');
}
