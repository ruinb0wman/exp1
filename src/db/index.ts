import Dexie from 'dexie';
import type { DB } from './types';
import { migration } from './migrations';
import { createSyncMiddleware } from './sync/middleware';
import { createTaskTemplateMiddleware } from './middleware/taskTemplateMiddleware';
import type { DeviceId } from './sync/types';

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
  // 如果数据库已创建，需要重新创建以应用新的中间件
  if (state.db) {
    state.db = createDB();
  }
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
  const db = new Dexie('exp-v4') as DB;
  migration(db);

  // 注册同步中间件
  const syncMiddleware = createSyncMiddleware(state.deviceId);
  db.use(syncMiddleware);

  // 注册任务模板中间件（需要在数据库创建后，但要在任何操作前注册 hooks）
  // 注意：这里先注册 hooks，dayEndTime 会在应用初始化后通过 reRegisterHooks 更新
  const templateMiddleware = createTaskTemplateMiddleware("00:00");
  templateMiddleware.register(db);

  return db;
};
