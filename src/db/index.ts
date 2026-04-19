import Dexie from 'dexie';
import type { DB } from './types';
import { migration } from './migrations';
import { createTaskTemplateMiddleware } from './middleware/taskTemplateMiddleware';
import { createPointsHistoryMiddleware } from './middleware/pointsHistoryMiddleware';
import {
  generateUUID,
  hashTaskInstance,
  hashPointsHistory,
  hashRewardInstance,
} from '@/libs/id';
import type { TaskTemplate } from './types';
import type { TaskInstance } from './types';
import type { RewardTemplate } from './types';
import type { RewardInstance } from './types';
import type { PointsHistory } from './types';
import type { ReplenishmentRecord } from './types';

const state: { 
  db: null | ReturnType<typeof createDB>;
} = {
  db: null,
};

// using for debugging
//@ts-ignore
if (typeof window !== 'undefined') {
  //@ts-ignore
  window.dbstate = state;
}

function getDB() {
  if (state.db) {
    return state.db;
  } else {
    state.db = createDB();
    return state.db;
  }
}

export { getDB };

const createDB = () => {
  const db = new Dexie('exp-v7') as DB;
  migration(db);

  db.taskTemplates.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as TaskTemplate;
    if (!item.id) {
      item.id = generateUUID();
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    item.updatedAt = undefined as any;
  });

  db.taskTemplates.hook('updating', function () {
    return { updatedAt: new Date().toISOString() };
  });

  db.taskInstances.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as TaskInstance;
    const date = item.instanceDate || new Date().toISOString().split('T')[0];
    if (!item.id) {
      item.id = hashTaskInstance(item.templateId, date);
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    item.updatedAt = undefined as any;
  });

  db.taskInstances.hook('updating', function () {
    return { updatedAt: new Date().toISOString() };
  });

  db.rewardTemplates.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as RewardTemplate;
    if (!item.id) {
      item.id = generateUUID();
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    item.updatedAt = undefined as any;
  });

  db.rewardTemplates.hook('updating', function () {
    return { updatedAt: new Date().toISOString() };
  });

  db.rewardInstances.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as RewardInstance;
    if (!item.id) {
      item.id = hashRewardInstance(item.templateId, item.userId, item.createdAt || new Date().toISOString());
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    item.updatedAt = undefined as any;
  });

  db.rewardInstances.hook('updating', function () {
    return { updatedAt: new Date().toISOString() };
  });

  db.replenishmentRecords.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as ReplenishmentRecord;
    if (!item.id) {
      item.id = generateUUID();
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
  });

  db.pointsHistory.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as PointsHistory;
    if (!item.id && item.relatedInstanceId && item.type) {
      item.id = hashPointsHistory(item.relatedInstanceId, item.type, item.stageId);
    } else if (!item.id) {
      item.id = generateUUID();
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    item.updatedAt = undefined as any;
  });

  db.pointsHistory.hook('updating', function () {
    return { updatedAt: new Date().toISOString() };
  });

  const templateMiddleware = createTaskTemplateMiddleware();
  templateMiddleware.register(db);

  const pointsHistoryMiddleware = createPointsHistoryMiddleware();
  pointsHistoryMiddleware.register(db);

  return db;
};
