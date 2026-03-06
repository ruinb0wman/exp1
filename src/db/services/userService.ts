import { getDB } from '../index';
import type { User, PointsHistory, PointsHistoryType } from '../types';

const DEFAULT_USER: Omit<User, 'id'> = {
  name: 'User',
  currentPoints: 0,
  createdAt: new Date().toISOString(),
};

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

    const newPoints = user.currentPoints + amount;
    if (newPoints < 0) {
      throw new Error('Insufficient points');
    }

    await db.users.update(userId, { currentPoints: newPoints });

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
