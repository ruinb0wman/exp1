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

export type DeviceId = 'pc' | 'mobile';

const state: { 
  db: null | ReturnType<typeof createDB>;
  deviceId: DeviceId;
} = {
  db: null,
  deviceId: 'pc' // 默认为 pc，在应用启动时根据平台设置
};

// using for debugging
//@ts-ignore
if (typeof window !== 'undefined') {
  //@ts-ignore
  window.dbstate = state;
}

/**
 * 设置设备标识
 * 应在应用启动时调用，根据平台设置为 'pc' 或 'mobile'
 */
export function setDeviceId(deviceId: DeviceId) {
  state.deviceId = deviceId;
}

/**
 * 获取当前设备标识
 */
export function getDeviceId(): DeviceId {
  return state.deviceId;
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
  const db = new Dexie('exp-v6') as DB;
  migration(db);

  db.taskTemplates.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as TaskTemplate;
    if (!item.id) {
      item.id = generateUUID();
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    if (!item.updatedAt) item.updatedAt = now;
  });

  db.taskInstances.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as TaskInstance;
    const date = item.instanceDate || item.startAt?.split('T')[0] || new Date().toISOString().split('T')[0];
    if (!item.id) {
      item.id = hashTaskInstance(item.templateId, date);
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    if (!item.updatedAt) item.updatedAt = now;
  });

  db.rewardTemplates.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as RewardTemplate;
    if (!item.id) {
      item.id = generateUUID();
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    if (!item.updatedAt) item.updatedAt = now;
  });

  db.rewardInstances.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as RewardInstance;
    if (!item.id) {
      item.id = hashRewardInstance(item.templateId, item.userId, item.createdAt || new Date().toISOString());
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    if (!item.updatedAt) item.updatedAt = now;
  });

  db.pointsHistory.hook('creating', function (_primKey, obj, _trans) {
    const item = obj as PointsHistory;
    if (!item.id && item.relatedInstanceId && item.type) {
      item.id = hashPointsHistory(item.relatedInstanceId, item.type);
    } else if (!item.id) {
      item.id = generateUUID();
    }
    const now = new Date().toISOString();
    if (!item.createdAt) item.createdAt = now;
    if (!item.updatedAt) item.updatedAt = now;
  });

  const templateMiddleware = createTaskTemplateMiddleware("00:00");
  templateMiddleware.register(db);

  const pointsHistoryMiddleware = createPointsHistoryMiddleware();
  pointsHistoryMiddleware.register(db);

  return db;
};
