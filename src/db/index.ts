import Dexie, { Table } from 'dexie';
import { TaskTemplate, TaskInstance, RewardInstance, RewardTemplate, PointsHistory, User } from './type';

interface DB extends Dexie {
  taskTemplates: Table<TaskTemplate, number>;
  taskInstances: Table<TaskInstance, number>;
  rewardTemplates: Table<RewardTemplate, number>;
  rewardInstances: Table<RewardInstance, number>;
  users: Table<User, number>;
  pointsHistory: Table<PointsHistory, number>;
}

const state: { db: null | ReturnType<typeof createDB> } = {
  db: null
};

export function useDB() {
  const getDB = () => {
    if (state.db) {
      return state.db;
    } else {
      state.db = createDB()
      return state.db;
    }
  }

  return { getDB }
}

const createDB = () => {
  const db = new Dexie('TaskRewardDB') as DB;

  db.version(1).stores({
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks',
    taskInstances: '++id, userId, templateId, scheduledDate, status, [templateId+scheduledDate]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: 'id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]'
  });

  return db;
};
