/**
 * 同步服务 - 简化后的合并算法
 *
 * 使用 createdAt 时间戳比较，最早的写入保留
 */

import type { SyncTable, SyncData } from './types';

/**
 * 表级合并结果
 */
export interface TableMergeResult {
  success: boolean;
  mergedData?: SyncData;
}

/**
 * 合并两个 SyncData（手机端执行）
 * 规则：比较 createdAt 时间戳，最早的写入保留
 *
 * @param mobileData 手机端数据
 * @param pcData PC 端数据
 * @returns 合并结果
 */
export async function mergeTables(
  mobileData: SyncData,
  pcData: SyncData
): Promise<TableMergeResult> {
  const mergedTables: any = {};

  // 获取所有表名
  const allTables = new Set([
    ...Object.keys(mobileData.tables),
    ...Object.keys(pcData.tables)
  ]);

  for (const tableName of allTables) {
    const mobileRecords = mobileData.tables[tableName as SyncTable] || [];
    const pcRecords = pcData.tables[tableName as SyncTable] || [];

    // 创建记录映射（以 id 为键）
    const mobileMap = new Map(mobileRecords.map((r: any) => [r.id, r]));
    const pcMap = new Map(pcRecords.map((r: any) => [r.id, r]));
    
    // 获取所有记录 ID
    const allIds = new Set([...mobileMap.keys(), ...pcMap.keys()]);
    
    const mergedRecords: any[] = [];

    for (const id of allIds) {
      const mobileRecord = mobileMap.get(id);
      const pcRecord = pcMap.get(id);

      if (!mobileRecord && pcRecord) {
        // 只有 PC 有记录
        mergedRecords.push(pcRecord);
      } else if (mobileRecord && !pcRecord) {
        // 只有手机有记录
        mergedRecords.push(mobileRecord);
      } else if (mobileRecord && pcRecord) {
        // 双方都有记录，比较 createdAt
        const mobileTime = new Date(mobileRecord.createdAt || 0).getTime();
        const pcTime = new Date(pcRecord.createdAt || 0).getTime();

        // 最早的覆盖新的（先写入获胜）
        if (mobileTime <= pcTime) {
          mergedRecords.push(mobileRecord);
        } else {
          mergedRecords.push(pcRecord);
        }
      }
    }

    mergedTables[tableName] = mergedRecords;
  }

  const mergedData: SyncData = {
    deviceId: mobileData.deviceId,
    sessionId: mobileData.sessionId,
    timestamp: new Date().toISOString(),
    tables: mergedTables
  };

  return { success: true, mergedData };
}
