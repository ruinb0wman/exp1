import { getDB } from '../../index';
import type { PointsHistory } from '../../types/user';

export async function createPointsRecord(
  db: ReturnType<typeof getDB>,
  userId: number,
  instanceId: string,
  amount: number,
  type: PointsHistory['type'],
  description: string,
  stageId?: string
): Promise<void> {
  const now = new Date().toISOString();
  
  await db.pointsHistory.put({
    userId,
    amount,
    type,
    relatedInstanceId: instanceId,
    description,
    stageId,
    createdAt: now,
  } as unknown as PointsHistory);

  const user = await db.users.get(userId);
  if (user) {
    const newTotal = Math.max(0, user.totalPoints + amount);
    await db.users.update(userId, {
      totalPoints: newTotal,
    });
  }
}

export async function deductPoints(
  db: ReturnType<typeof getDB>,
  userId: number,
  instanceId: string,
  amount: number,
  description: string
): Promise<void> {
  await createPointsRecord(db, userId, instanceId, -amount, 'task_deduction', description);
}