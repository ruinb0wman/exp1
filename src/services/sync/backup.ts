/**
 * 同步服务 - 备份与恢复模块
 * 
 * 提供同步前的备份和失败后的恢复功能
 */

import { getDB } from '@/db';
import type { SyncTable, SyncBackup } from '@/db/sync/types';
import { SYNCABLE_TABLES } from '@/db/sync/types';

/**
 * 创建同步备份
 * @param sessionId 同步会话ID
 */
export async function createSyncBackup(sessionId: string): Promise<void> {
  const db = getDB();
  const timestamp = new Date().toISOString();
  
  for (const tableName of SYNCABLE_TABLES) {
    const table = db.table(tableName);
    const records = await table.toArray();
    
    const backup: SyncBackup = {
      sessionId,
      table: tableName,
      data: JSON.stringify(records),
      createdAt: timestamp
    };
    
    await db.table('syncBackups').add(backup);
  }
  
  console.log(`[SyncBackup] Created backup for session: ${sessionId}`);
}

/**
 * 从备份恢复数据
 * @param sessionId 同步会话ID
 */
export async function restoreFromBackup(sessionId: string): Promise<void> {
  const db = getDB();
  const backupTable = db.table('syncBackups');
  
  // 获取该会话的所有备份
  const backups = await backupTable
    .where('sessionId')
    .equals(sessionId)
    .toArray() as SyncBackup[];
  
  if (backups.length === 0) {
    console.warn(`[SyncBackup] No backup found for session: ${sessionId}`);
    return;
  }
  
  // 在一个事务中恢复所有表
  const tables = SYNCABLE_TABLES.map(name => db.table(name));
  
  await db.transaction('rw', [...tables, backupTable], async () => {
    for (const backup of backups) {
      const table = db.table(backup.table);
      const records = JSON.parse(backup.data);
      
      // 清空表并恢复数据
      await table.clear();
      if (records.length > 0) {
        await table.bulkAdd(records);
      }
      
      console.log(`[SyncBackup] Restored ${records.length} records to ${backup.table}`);
    }
    
    // 恢复后删除备份
    await backupTable.where('sessionId').equals(sessionId).delete();
  });
  
  console.log(`[SyncBackup] Restored from backup for session: ${sessionId}`);
}

/**
 * 清理备份
 * @param sessionId 同步会话ID
 */
export async function cleanupBackup(sessionId: string): Promise<void> {
  const db = getDB();
  await db.table('syncBackups').where('sessionId').equals(sessionId).delete();
  console.log(`[SyncBackup] Cleaned up backup for session: ${sessionId}`);
}

/**
 * 获取备份信息
 * @param sessionId 同步会话ID
 */
export async function getBackupInfo(sessionId: string): Promise<{ table: SyncTable; count: number }[]> {
  const db = getDB();
  const backups = await db.table('syncBackups')
    .where('sessionId')
    .equals(sessionId)
    .toArray() as SyncBackup[];
  
  return backups.map(backup => ({
    table: backup.table,
    count: JSON.parse(backup.data).length
  }));
}
