import { useDB } from '../index';
import type { PointsHistory, PointsHistoryType } from '../types';

export type PointsHistoryFilterType = 'all' | PointsHistoryType;

export interface PointsHistoryQueryOptions {
  page?: number;
  pageSize?: number;
  type?: PointsHistoryFilterType;
  startDate?: string;
  endDate?: string;
}

export interface PointsStats {
  income: number; // 总收入（任务奖励）
  expense: number; // 总支出（兑换奖励 + 撤销扣除）
  balance: number; // 结余
  taskReward: number; // 任务获得
  taskUndo: number; // 撤销扣除
  rewardExchange: number; // 兑换消费
  adminAdjustment: number; // 管理员调整
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * 分页查询积分历史
 */
export async function getPointsHistoryPaged(
  userId: number,
  options: PointsHistoryQueryOptions = {}
): Promise<{
  list: PointsHistory[];
  hasMore: boolean;
  total: number;
}> {
  const { getDB } = useDB();
  const db = getDB();

  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, type = 'all', startDate, endDate } = options;

  let collection = db.pointsHistory.where('userId').equals(userId);

  // 应用类型筛选
  if (type !== 'all') {
    collection = collection.filter((item) => item.type === type);
  }

  // 获取所有符合条件的记录（用于计算总数和分页）
  let allRecords = await collection.reverse().sortBy('createdAt');

  // 应用时间范围筛选
  if (startDate) {
    allRecords = allRecords.filter((item) => item.createdAt >= startDate);
  }
  if (endDate) {
    allRecords = allRecords.filter((item) => item.createdAt <= endDate);
  }

  const total = allRecords.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const list = allRecords.slice(startIndex, endIndex);
  const hasMore = endIndex < total;

  return { list, hasMore, total };
}

/**
 * 按时间范围查询积分历史
 */
export async function getPointsHistoryByDateRange(
  userId: number,
  startDate: string,
  endDate: string,
  type?: PointsHistoryFilterType
): Promise<PointsHistory[]> {
  const { getDB } = useDB();
  const db = getDB();

  let collection = db.pointsHistory.where('userId').equals(userId);

  // 先按用户和时间范围筛选
  const records = await collection.filter((item) => item.createdAt >= startDate && item.createdAt <= endDate).reverse().sortBy('createdAt');

  // 应用类型筛选
  if (type && type !== 'all') {
    return records.filter((item) => item.type === type);
  }

  return records;
}

/**
 * 获取积分统计
 */
export async function getPointsStats(
  userId: number,
  startDate: string,
  endDate: string
): Promise<PointsStats> {
  const { getDB } = useDB();
  const db = getDB();

  const records = await db.pointsHistory
    .where('userId')
    .equals(userId)
    .filter((item) => item.createdAt >= startDate && item.createdAt <= endDate)
    .toArray();

  const stats: PointsStats = {
    income: 0,
    expense: 0,
    balance: 0,
    taskReward: 0,
    taskUndo: 0,
    rewardExchange: 0,
    adminAdjustment: 0,
  };

  for (const record of records) {
    const amount = record.amount;

    // 按类型统计
    switch (record.type) {
      case 'task_reward':
        stats.taskReward += amount;
        stats.income += amount;
        break;
      case 'task_undo':
        stats.taskUndo += Math.abs(amount);
        stats.expense += Math.abs(amount);
        break;
      case 'reward_exchange':
        stats.rewardExchange += Math.abs(amount);
        stats.expense += Math.abs(amount);
        break;
      case 'admin_adjustment':
        stats.adminAdjustment += amount;
        if (amount > 0) {
          stats.income += amount;
        } else {
          stats.expense += Math.abs(amount);
        }
        break;
    }
  }

  stats.balance = stats.income - stats.expense;

  return stats;
}

/**
 * 记录任务撤销（扣除积分）
 */
export async function recordTaskUndo(
  userId: number,
  taskInstanceId: number,
  pointsToDeduct: number
): Promise<number> {
  const { getDB } = useDB();
  const db = getDB();

  const history: PointsHistory = {
    userId,
    amount: -Math.abs(pointsToDeduct),
    type: 'task_undo',
    relatedEntityId: taskInstanceId,
    createdAt: new Date().toISOString(),
  };

  return db.pointsHistory.add(history);
}

/**
 * 获取某个任务实例的所有积分记录
 */
export async function getTaskPointsRecords(
  userId: number,
  taskInstanceId: number
): Promise<PointsHistory[]> {
  const { getDB } = useDB();
  const db = getDB();

  return db.pointsHistory
    .where({ userId })
    .filter((item) => item.relatedEntityId === taskInstanceId)
    .reverse()
    .sortBy('createdAt');
}

/**
 * 获取某个任务实例的净积分（用于判断能否撤销）
 */
export async function getTaskNetPoints(
  userId: number,
  taskInstanceId: number
): Promise<number> {
  const records = await getTaskPointsRecords(userId, taskInstanceId);
  return records.reduce((sum, record) => sum + record.amount, 0);
}
