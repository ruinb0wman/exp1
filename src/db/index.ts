import Dexie from 'dexie';
import type { DB } from './types';
import { migration } from './migrations';
import { createTaskTemplateMiddleware } from './middleware/taskTemplateMiddleware';
import { createPointsHistoryMiddleware } from './middleware/pointsHistoryMiddleware';

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
  const db = new Dexie('exp-v5') as DB;
  migration(db);

  // 注册任务模板中间件（需要在数据库创建后，但要在任何操作前注册 hooks）
  // 注意：这里先注册 hooks，dayEndTime 会在应用初始化后通过 reRegisterHooks 更新
  const templateMiddleware = createTaskTemplateMiddleware("00:00");
  templateMiddleware.register(db);

  // 注册积分历史中间件（Hooks）
  const pointsHistoryMiddleware = createPointsHistoryMiddleware();
  pointsHistoryMiddleware.register(db);

  return db;
};
