/**
 * 同步服务 - 三路合并算法
 * 
 * 实现字段级三路合并算法
 */

import type { SyncTable, FieldConflict, SyncData } from './types';
import { deepEqual } from './utils';

/**
 * 合并结果
 */
export interface MergeResult {
  success: boolean;
  data?: any;
  conflicts?: FieldConflict[];
}

/**
 * 三路合并算法
 * @param base 基础版本（上次同步时的状态）
 * @param local 本地版本（PC端当前数据）
 * @param remote 远程版本（手机端上传数据）
 * @param table 表名
 * @param syncId 同步ID
 * @returns 合并结果
 */
export function threeWayMerge(
  base: any,
  local: any,
  remote: any,
  table: SyncTable,
  syncId: string
): MergeResult {
  // 1. 如果 local === remote，无需合并
  if (deepEqual(local, remote)) {
    return { success: true, data: local };
  }

  // 2. 如果 base === local，采用 remote
  if (deepEqual(base, local)) {
    return { success: true, data: remote };
  }

  // 3. 如果 base === remote，采用 local
  if (deepEqual(base, remote)) {
    return { success: true, data: local };
  }

  // 4. 字段级三路合并
  const result: any = {};
  const conflicts: FieldConflict[] = [];

  const allFields = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(local || {}),
    ...Object.keys(remote || {})
  ]);

  for (const field of allFields) {
    const baseVal = base?.[field];
    const localVal = local?.[field];
    const remoteVal = remote?.[field];

    if (deepEqual(baseVal, localVal) && !deepEqual(baseVal, remoteVal)) {
      // 只有 remote 修改
      result[field] = remoteVal;
    } else if (deepEqual(baseVal, remoteVal) && !deepEqual(baseVal, localVal)) {
      // 只有 local 修改
      result[field] = localVal;
    } else if (deepEqual(localVal, remoteVal)) {
      // 修改相同
      result[field] = localVal;
    } else {
      // 冲突
      conflicts.push({
        table,
        syncId,
        field,
        baseValue: baseVal,
        localValue: localVal,
        remoteValue: remoteVal
      });
    }
  }

  if (conflicts.length > 0) {
    return { success: false, conflicts };
  }

  return { success: true, data: result };
}

/**
 * 应用冲突解决
 * @param base 基础版本
 * @param local 本地版本
 * @param remote 远程版本
 * @param resolutions 冲突解决选择
 * @returns 合并后的数据
 */
export function applyConflictResolutions(
  base: any,
  local: any,
  remote: any,
  resolutions: { field: string; choice: 'local' | 'remote' }[]
): any {
  const result: any = {};
  const resolutionMap = new Map(resolutions.map(r => [r.field, r.choice]));

  const allFields = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(local || {}),
    ...Object.keys(remote || {})
  ]);

  for (const field of allFields) {
    const baseVal = base?.[field];
    const localVal = local?.[field];
    const remoteVal = remote?.[field];

    // 检查是否有冲突解决选择
    const choice = resolutionMap.get(field);
    if (choice) {
      result[field] = choice === 'local' ? localVal : remoteVal;
    } else if (deepEqual(baseVal, localVal) && !deepEqual(baseVal, remoteVal)) {
      result[field] = remoteVal;
    } else if (deepEqual(baseVal, remoteVal) && !deepEqual(baseVal, localVal)) {
      result[field] = localVal;
    } else if (deepEqual(localVal, remoteVal)) {
      result[field] = localVal;
    } else {
      // 默认使用 local
      result[field] = localVal;
    }
  }

  return result;
}

/**
 * 表级合并结果
 */
export interface TableMergeResult {
  success: boolean;
  mergedData?: SyncData;
  conflicts?: FieldConflict[];
}

/**
 * 合并两个 SyncData（手机端执行）
 * @param mobileData 手机端数据
 * @param pcData PC 端数据
 * @returns 合并结果
 */
export async function threeWayMergeTables(
  mobileData: SyncData,
  pcData: SyncData
): Promise<TableMergeResult> {
  const conflicts: FieldConflict[] = [];
  const mergedTables: any = {};

  // 获取所有表名
  const allTables = new Set([
    ...Object.keys(mobileData.tables),
    ...Object.keys(pcData.tables)
  ]);

  for (const tableName of allTables) {
    const mobileTable = mobileData.tables[tableName as SyncTable];
    const pcTable = pcData.tables[tableName as SyncTable];

    if (!mobileTable && pcTable) {
      // 只有 PC 有数据，使用 PC 数据
      mergedTables[tableName] = pcTable;
    } else if (mobileTable && !pcTable) {
      // 只有手机有数据，使用手机数据
      mergedTables[tableName] = mobileTable;
    } else if (mobileTable && pcTable) {
      // 双方都有数据，需要合并记录
      const mergedRecords: any[] = [];
      const mergedMetadata: any[] = [];

      // 创建 syncId 到记录的映射
      const mobileRecordsMap = new Map(mobileTable.records.map(r => [r.syncId || r.id, r]));
      const pcRecordsMap = new Map(pcTable.records.map(r => [r.syncId || r.id, r]));
      const allSyncIds = new Set([...mobileRecordsMap.keys(), ...pcRecordsMap.keys()]);

      for (const syncId of allSyncIds) {
        const mobileRecord = mobileRecordsMap.get(syncId);
        const pcRecord = pcRecordsMap.get(syncId);

        if (!mobileRecord && pcRecord) {
          // 只有 PC 有记录
          mergedRecords.push(pcRecord);
          const meta = pcTable.metadata.find(m => m.syncId === syncId);
          if (meta) mergedMetadata.push(meta);
        } else if (mobileRecord && !pcRecord) {
          // 只有手机有记录
          mergedRecords.push(mobileRecord);
          const meta = mobileTable.metadata.find(m => m.syncId === syncId);
          if (meta) mergedMetadata.push(meta);
        } else if (mobileRecord && pcRecord) {
          // 双方都有记录，执行字段级三路合并
          // 简化处理：比较时间戳，使用更新的版本
          const mobileMeta = mobileTable.metadata.find(m => m.syncId === syncId);
          const pcMeta = pcTable.metadata.find(m => m.syncId === syncId);

          const mobileTime = new Date(mobileMeta?.modifiedAt || 0).getTime();
          const pcTime = new Date(pcMeta?.modifiedAt || 0).getTime();

          if (mobileTime >= pcTime) {
            // 手机数据更新或相同，使用手机数据
            mergedRecords.push(mobileRecord);
            if (mobileMeta) mergedMetadata.push(mobileMeta);
          } else {
            // PC 数据更新，使用 PC 数据
            mergedRecords.push(pcRecord);
            if (pcMeta) mergedMetadata.push(pcMeta);
          }
        }
      }

      mergedTables[tableName] = {
        records: mergedRecords,
        metadata: mergedMetadata
      };
    }
  }

  if (conflicts.length > 0) {
    return { success: false, conflicts };
  }

  const mergedData: SyncData = {
    deviceId: mobileData.deviceId,
    sessionId: mobileData.sessionId,
    timestamp: new Date().toISOString(),
    tables: mergedTables
  };

  return { success: true, mergedData };
}
