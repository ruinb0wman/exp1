import type { Dexie } from 'dexie';
import type { DeviceId, SyncMetadata, SyncTable } from './types';
import { isSyncableTable } from './types';

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 计算对象的简单哈希（用于校验和）
 * 使用 JSON.stringify + 简单哈希算法
 */
function computeChecksum(obj: any): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32bit 整数
  }
  return hash.toString(16);
}

/**
 * 获取数据库实例
 * 注意：这里使用动态导入避免循环依赖
 */
async function getDB(): Promise<Dexie> {
  const { getDB } = await import('../index');
  return getDB();
}

/**
 * 记录变更到 SyncMetadata
 */
async function recordChange(
  table: SyncTable,
  localId: number,
  data: any,
  deviceId: DeviceId,
  _isUpdate: boolean
): Promise<void> {
  try {
    const db = await getDB();
    const syncMetadataTable = db.table('syncMetadata');
    
    // 查询现有元数据
    let metadata = await syncMetadataTable
      .where({ table, localId })
      .first() as SyncMetadata | undefined;
    
    if (!metadata) {
      // 新记录
      metadata = {
        table,
        localId,
        syncId: generateUUID(),
        version: 1,
        modifiedAt: new Date().toISOString(),
        modifiedBy: deviceId,
        checksum: computeChecksum(data),
        isDeleted: false
      };
    } else {
      // 更新记录
      metadata.version++;
      metadata.modifiedAt = new Date().toISOString();
      metadata.modifiedBy = deviceId;
      metadata.checksum = computeChecksum(data);
      metadata.isDeleted = false;
    }
    
    await syncMetadataTable.put(metadata);
  } catch (error) {
    console.error('[SyncMiddleware] Failed to record change:', error);
    // 不抛出错误，避免影响业务操作
  }
}

/**
 * 记录删除（软删除）
 */
async function recordDeletion(
  table: SyncTable,
  localId: number,
  deviceId: DeviceId
): Promise<void> {
  try {
    const db = await getDB();
    const syncMetadataTable = db.table('syncMetadata');
    
    const metadata = await syncMetadataTable
      .where({ table, localId })
      .first() as SyncMetadata | undefined;
    
    if (metadata) {
      metadata.version++;
      metadata.modifiedAt = new Date().toISOString();
      metadata.modifiedBy = deviceId;
      metadata.isDeleted = true;
      await syncMetadataTable.put(metadata);
    }
  } catch (error) {
    console.error('[SyncMiddleware] Failed to record deletion:', error);
  }
}

/**
 * 创建 Dexie 同步中间件
 * 
 * 拦截所有 CRUD 操作，自动记录变更到影子表
 * 
 * @param deviceId 设备标识 'pc' | 'mobile'
 * @returns Dexie 中间件对象
 */
export function createSyncMiddleware(deviceId: DeviceId) {
  return {
    stack: 'dbcore' as const,

    create(downlevelDatabase: any) {
      return {
        ...downlevelDatabase,

        table(tableName: string) {
          const downlevelTable = downlevelDatabase.table(tableName);

          // 只拦截需要同步的表
          if (!isSyncableTable(tableName)) {
            return downlevelTable;
          }

          return {
            ...downlevelTable,

            /**
             * 拦截 put 操作（插入或更新）
             */
            put: async (req: any) => {
              // 判断是插入还是更新
              const isUpdate = req.key !== undefined;
              
              // 执行业务表的 put 操作
              const result = await downlevelTable.put(req);
              
              // 异步记录到影子表（不阻塞业务操作）
              queueMicrotask(() => {
                recordChange(
                  tableName as SyncTable,
                  result,
                  req.value,
                  deviceId,
                  isUpdate
                );
              });

              return result;
            },

            /**
             * 拦截 delete 操作
             */
            delete: async (req: any) => {
              // 先获取要删除的 key
              const key = req.key;
              
              // 执行业务表的 delete 操作
              const result = await downlevelTable.delete(req);
              
              // 异步记录软删除
              queueMicrotask(() => {
                recordDeletion(
                  tableName as SyncTable,
                  key,
                  deviceId
                );
              });

              return result;
            },

            /**
             * 拦截 bulkPut 操作（批量插入/更新）
             */
            bulkPut: async (req: any) => {
              // 执行业务表的 bulkPut 操作
              const result = await downlevelTable.bulkPut(req);
              
              // 异步批量记录
              queueMicrotask(() => {
                const values = req.values || [];
                values.forEach((value: any, index: number) => {
                  const key = Array.isArray(result) ? result[index] : result;
                  const isUpdate = value.id !== undefined;
                  recordChange(
                    tableName as SyncTable,
                    key,
                    value,
                    deviceId,
                    isUpdate
                  );
                });
              });

              return result;
            },

            /**
             * 拦截 bulkDelete 操作（批量删除）
             */
            bulkDelete: async (req: any) => {
              const keys = req.keys || [];
              
              // 执行业务表的 bulkDelete 操作
              const result = await downlevelTable.bulkDelete(req);
              
              // 异步批量记录软删除
              queueMicrotask(() => {
                keys.forEach((key: number) => {
                  recordDeletion(
                    tableName as SyncTable,
                    key,
                    deviceId
                  );
                });
              });

              return result;
            }
          };
        }
      };
    }
  };
}

/**
 * 同步中间件类型
 */
export type SyncMiddleware = ReturnType<typeof createSyncMiddleware>;
