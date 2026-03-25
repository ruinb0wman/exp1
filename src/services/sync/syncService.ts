/**
 * 同步服务 - 核心逻辑（简化版）
 *
 * 提供数据收集、打包、应用等功能
 * 移除影子表依赖，直接使用业务表的 updatedAt 字段
 */

import { getDB } from '@/db';
import { getDeviceId } from '@/db/index';

import { SYNCABLE_TABLES } from '@/db/sync/types';
import type { SyncData, SyncTableData, SyncProgress } from './types';
import { SyncError } from './types';
import { createSyncBackup, restoreFromBackup, cleanupBackup } from './backup';
import { SyncClient } from './syncClient';
import { setSyncing } from './syncState';

/**
 * 收集同步数据
 * @param sessionId 会话ID
 */
export async function collectSyncData(sessionId: string): Promise<SyncData> {
  console.log(`[SyncService] Collecting sync data for session: ${sessionId}`);
  const db = getDB();
  const deviceId = getDeviceId();
  const tables: Partial<SyncTableData> = {};

  for (const tableName of SYNCABLE_TABLES) {
    // 直接获取业务表数据（不再需要元数据）
    const records = await db.table(tableName).toArray();
    console.log(`[SyncService] Table ${tableName}: ${records.length} records`);

    (tables as any)[tableName] = records;
  }

  const result = {
    deviceId,
    sessionId,
    timestamp: new Date().toISOString(),
    tables: tables as SyncTableData
  };

  console.log(`[SyncService] Collected data:`, {
    deviceId,
    sessionId,
    tableCount: Object.keys(tables).length,
    timestamp: result.timestamp
  });

  return result;
}

/**
 * 应用同步数据到本地数据库
 * @param data 同步数据
 * @param onProgress 进度回调
 */
export async function applySyncData(
  data: SyncData,
  onProgress?: (progress: SyncProgress) => void
): Promise<void> {
  console.log(`[SyncService] Applying sync data, session: ${data.sessionId}`);
  
  // 设置同步标志，禁用自动 Hooks
  setSyncing(true);
  
  const db = getDB();
  const totalTables = Object.keys(data.tables).length;
  let processedTables = 0;

  console.log(`[SyncService] Total tables to apply: ${totalTables}`);

  // 获取所有需要操作的表
  const tables = Object.keys(data.tables).map(name => db.table(name));

  await db.transaction('rw', tables, async () => {
    for (const [tableName, records] of Object.entries(data.tables)) {
      const table = db.table(tableName);

      console.log(`[SyncService] Applying table ${tableName}: ${records.length} records`);

      // 更新进度
      onProgress?.({
        phase: 'apply',
        progress: Math.round((processedTables / totalTables) * 100),
        message: `正在应用 ${tableName}...`
      });

      // 清空表并插入新数据
      await table.clear();
      if (records.length > 0) {
        await table.bulkAdd(records);
      }

      processedTables++;
    }
  });

  // 更新最后同步时间
  await db.table('syncConfig').put({
    key: 'lastSyncAt',
    value: data.timestamp,
    updatedAt: new Date().toISOString()
  });

  console.log(`[SyncService] Applied sync data successfully`);

  onProgress?.({
    phase: 'complete',
    progress: 100,
    message: '同步完成'
  });
  
  // 清除同步标志，恢复自动 Hooks
  setSyncing(false);
}

/**
 * 执行同步（手机端）
 * 流程：
 * 1. 手机上传数据到 PC
 * 2. 手机下载 PC 的数据
 * 3. 手机端执行合并（比较 updatedAt，新的覆盖旧的）
 * 4. 手机上传合并后的数据到 PC
 * 5. PC 端应用数据
 * 6. 手机端应用数据
 * 7. 完成同步
 *
 * @param serverUrl 服务器地址
 * @param onProgress 进度回调
 */
export async function performSync(
  serverUrl: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<void> {
  console.log(`[SyncService] Starting sync to server: ${serverUrl}`);
  const client = new SyncClient(serverUrl);
  const deviceId = getDeviceId();
  let sessionId: string;
  const startTime = Date.now();

  try {
    // 1. 初始化同步
    console.log(`[SyncService] Step 1: Initializing sync...`);
    onProgress?.({
      phase: 'init',
      progress: 10,
      message: '正在连接服务器...'
    });

    const initResponse = await client.initSync(deviceId);
    sessionId = initResponse.sessionId;
    console.log(`[SyncService] Sync initialized, sessionId: ${sessionId}`);

    // 保存 sessionId 到配置
    const db = getDB();
    await db.table('syncConfig').put({
      key: 'currentSessionId',
      value: sessionId,
      updatedAt: new Date().toISOString()
    });

    // 2. 创建备份
    console.log(`[SyncService] Step 2: Creating backup...`);
    onProgress?.({
      phase: 'init',
      progress: 20,
      message: '正在创建备份...'
    });

    await createSyncBackup(sessionId);
    console.log(`[SyncService] Backup created successfully`);

    // 3. 收集手机数据
    console.log(`[SyncService] Step 3: Collecting mobile data...`);
    onProgress?.({
      phase: 'upload',
      progress: 30,
      message: '正在收集数据...'
    });

    const mobileData = await collectSyncData(sessionId);
    console.log(`[SyncService] Mobile data collected, tables:`, Object.keys(mobileData.tables));

    // 4. 上传手机数据到 PC
    console.log(`[SyncService] Step 4: Uploading mobile data to PC...`);
    onProgress?.({
      phase: 'upload',
      progress: 40,
      message: '正在上传数据到 PC...'
    });

    const uploadResponse = await client.uploadData(mobileData);
    console.log(`[SyncService] Mobile data uploaded, response:`, uploadResponse);

    // 5. 等待 PC 前端提供数据（通过 IPC），然后下载 PC 数据
    console.log(`[SyncService] Step 5: Downloading PC data...`);
    onProgress?.({
      phase: 'download',
      progress: 50,
      message: '正在获取 PC 数据...'
    });

    // 等待一段时间让 PC 前端响应
    console.log(`[SyncService] Waiting 500ms for PC to provide data...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log(`[SyncService] Downloading PC data for session: ${sessionId}`);
    const pcData = await client.downloadData(sessionId);
    console.log(`[SyncService] PC data downloaded, tables:`, Object.keys(pcData.tables));

    // 6. 执行合并（手机端）
    console.log(`[SyncService] Step 6: Merging data...`);
    onProgress?.({
      phase: 'merge',
      progress: 60,
      message: '正在合并数据...'
    });

    const { mergeTables } = await import('./merge');
    console.log(`[SyncService] Starting merge...`);
    const mergeResult = await mergeTables(mobileData, pcData);
    console.log(`[SyncService] Merge result:`, {
      success: mergeResult.success,
      hasMergedData: !!mergeResult.mergedData
    });

    if (!mergeResult.success || !mergeResult.mergedData) {
      console.error(`[SyncService] Merge failed`);
      throw new SyncError('Merge failed', 'MERGE_FAILED', false);
    }

    // 7. 上传合并后的数据到 PC
    console.log(`[SyncService] Step 7: Uploading merged data to PC...`);
    onProgress?.({
      phase: 'upload',
      progress: 70,
      message: '正在发送合并后的数据到 PC...'
    });

    const applyResponse = await client.applyData(mergeResult.mergedData);
    console.log(`[SyncService] Merged data uploaded, response:`, applyResponse);

    // 8. 手机端应用合并后的数据
    console.log(`[SyncService] Step 8: Applying merged data on mobile...`);
    onProgress?.({
      phase: 'apply',
      progress: 80,
      message: '正在应用数据...'
    });

    await applySyncData(mergeResult.mergedData, onProgress);
    console.log(`[SyncService] Merged data applied on mobile`);

    // 9. 完成同步
    console.log(`[SyncService] Step 9: Completing sync...`);
    onProgress?.({
      phase: 'complete',
      progress: 90,
      message: '正在完成同步...'
    });

    const completeResponse = await client.completeSync(sessionId);
    console.log(`[SyncService] Sync completed, response:`, completeResponse);

    // 10. 清理备份
    console.log(`[SyncService] Step 10: Cleaning up backup...`);
    await cleanupBackup(sessionId);

    // 清理配置
    await db.table('syncConfig').delete('currentSessionId');

    const duration = Date.now() - startTime;
    console.log(`[SyncService] Sync completed successfully in ${duration}ms`);

    onProgress?.({
      phase: 'complete',
      progress: 100,
      message: '同步成功'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[SyncService] Sync failed after ${duration}ms:`, error);

    // 恢复备份
    if (sessionId!) {
      console.log(`[SyncService] Restoring backup for session: ${sessionId}`);
      onProgress?.({
        phase: 'error',
        progress: 0,
        message: '同步失败，正在恢复...'
      });
      await restoreFromBackup(sessionId);
      console.log(`[SyncService] Backup restored`);
    }

    throw error;
  }
}
