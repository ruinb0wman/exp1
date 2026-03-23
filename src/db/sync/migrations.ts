import type { DB } from '../types';

/**
 * Version 10: 添加同步系统影子表
 * 
 * 新增表:
 * - syncMetadata: 记录每个业务记录的同步状态
 * - syncSnapshots: 记录上次同步时的完整状态
 * - syncSessions: 记录同步历史和状态
 * - syncBackups: 同步前的完整备份
 * - syncConfig: 存储设备标识等配置
 */
export function migrationV10(db: DB) {
  db.version(10).stores({
    // 业务表（保持不变）
    taskTemplates: '++id, userId, repeatMode, enabled, *subtasks, [userId+enabled]',
    taskInstances: '++id, userId, templateId, startAt, status, createdAt, [templateId+startAt]',
    rewardTemplates: '++id, userId, replenishmentMode, enabled',
    rewardInstances: '++id, templateId, userId, status, expiresAt',
    users: '++id, name',
    pointsHistory: '++id, userId, type, createdAt, [userId+createdAt]',
    pomoSessions: '++id, userId, taskId, mode, status, startedAt',
    
    // 影子表（新增）
    // 同步元数据表：记录每个业务记录的同步状态
    // 索引说明:
    // - ++id: 自增主键
    // - [table+localId]: 按表名和本地ID查询
    // - syncId: 按全局ID查询
    // - [table+syncId]: 按表名和全局ID查询
    syncMetadata: '++id, [table+localId], syncId, [table+syncId]',
    
    // 同步快照表：记录上次同步时的状态
    // 索引说明:
    // - ++id: 自增主键
    // - sessionId: 按会话查询
    // - [table+syncId]: 按表名和全局ID查询
    // - syncedAt: 按同步时间查询
    syncSnapshots: '++id, sessionId, [table+syncId], syncedAt',
    
    // 同步会话表：记录同步历史
    // 索引说明:
    // - ++id: 自增主键
    // - sessionId: 按会话ID查询
    // - device: 按设备查询
    // - status: 按状态查询
    // - startedAt: 按开始时间查询
    syncSessions: '++id, sessionId, device, status, startedAt',
    
    // 备份记录表：存储同步前的备份
    // 索引说明:
    // - ++id: 自增主键
    // - sessionId: 按会话查询
    // - table: 按表名查询
    syncBackups: '++id, sessionId, table',
    
    // 同步配置表：存储设备标识等配置
    // 索引说明:
    // - key: 主键（配置项名称）
    syncConfig: 'key'
  });
}
