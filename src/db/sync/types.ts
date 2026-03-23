/**
 * 同步系统 - 影子表类型定义
 * 
 * 这些表用于记录业务表的同步状态，业务表本身不感知同步逻辑
 */

export type SyncTable =
  | 'taskTemplates'
  | 'taskInstances'
  | 'rewardTemplates'
  | 'rewardInstances'
  | 'users'
  | 'pointsHistory';

export type DeviceId = 'pc' | 'mobile';

/**
 * 同步元数据表 - 记录每个业务记录的同步状态
 * 
 * 表名: syncMetadata
 * 索引: ++id, [table+localId], syncId, [table+syncId]
 */
export interface SyncMetadata {
  id?: number;
  table: SyncTable;           // 业务表名
  localId: number;            // 业务表本地自增ID
  syncId: string;             // 全局UUID v4
  version: number;            // 版本号，每次修改+1
  modifiedAt: string;         // ISO 8601 时间戳
  modifiedBy: DeviceId;       // 修改设备
  checksum: string;           // 内容哈希（用于快速比对）
  isDeleted: boolean;         // 软删除标记
}

/**
 * 同步快照表 - 记录上次同步时的完整状态
 * 
 * 表名: syncSnapshots
 * 索引: ++id, sessionId, [table+syncId], syncedAt
 */
export interface SyncSnapshot {
  id?: number;
  sessionId: string;          // 同步会话UUID
  table: SyncTable;           // 业务表名
  syncId: string;             // 对应 SyncMetadata.syncId
  version: number;            // 同步时的版本
  dataHash: string;           // 数据内容哈希（用于快速比对）
  syncedAt: string;           // 同步时间
  device: DeviceId;           // 同步目标设备
}

/**
 * 同步会话表 - 记录同步历史和状态
 * 
 * 表名: syncSessions
 * 索引: ++id, sessionId, device, status, startedAt
 */
export interface SyncSession {
  id?: number;
  sessionId: string;          // UUID
  device: DeviceId;           // 对端设备
  direction: 'upload' | 'download' | 'bidirectional';  // 同步方向
  status: 'pending' | 'success' | 'failed' | 'conflict' | 'cancelled';
  startedAt: string;          // 开始时间
  completedAt?: string;       // 完成时间
  errorMessage?: string;      // 错误信息
  stats?: SyncStats;          // 同步统计
}

/**
 * 同步统计信息
 */
export interface SyncStats {
  recordsUploaded: number;    // 上传记录数
  recordsDownloaded: number;  // 下载记录数
  conflictsResolved: number;  // 解决的冲突数
  durationMs: number;         // 同步耗时
}

/**
 * 备份记录表 - 同步前的完整备份
 * 
 * 表名: syncBackups
 * 索引: ++id, sessionId, table
 */
export interface SyncBackup {
  id?: number;
  sessionId: string;          // 关联的同步会话
  table: SyncTable;           // 业务表名
  data: string;               // JSON 字符串，完整表数据
  createdAt: string;          // 备份时间
}

/**
 * 同步配置表 - 存储设备标识等配置
 * 
 * 表名: syncConfig
 * 索引: key (主键)
 */
export interface SyncConfig {
  key: string;                // 配置项名称
  value: string;              // 配置值
  updatedAt: string;          // 更新时间
}

/**
 * 同步数据包 - 传输的数据格式
 */
export interface SyncData {
  deviceId: DeviceId;
  sessionId: string;
  timestamp: string;
  tables: SyncTableData;
}

/**
 * 各表的同步数据
 */
export type SyncTableData = {
  [key in SyncTable]: {
    metadata: SyncMetadata[];
    records: any[];
  }
};

/**
 * 同步响应
 */
export interface SyncResponse {
  sessionId: string;
  status: 'success' | 'conflict' | 'error';
  conflicts?: FieldConflict[];
  message?: string;
}

/**
 * 字段冲突信息
 */
export interface FieldConflict {
  table: SyncTable;
  syncId: string;
  field: string;
  baseValue: any;
  localValue: any;   // PC端值
  remoteValue: any;  // 手机端值
}

/**
 * 冲突解决选择
 */
export interface ConflictResolution {
  table: SyncTable;
  syncId: string;
  field: string;
  choice: 'local' | 'remote';
}

/**
 * 需要同步的表列表
 */
export const SYNCABLE_TABLES: SyncTable[] = [
  'taskTemplates',
  'taskInstances',
  'rewardTemplates',
  'rewardInstances',
  'users',
  'pointsHistory'
];

/**
 * 检查表是否需要同步
 */
export function isSyncableTable(tableName: string): tableName is SyncTable {
  return SYNCABLE_TABLES.includes(tableName as SyncTable);
}
