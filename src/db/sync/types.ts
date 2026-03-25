/**
 * 同步系统 - 简化后的类型定义
 * 
 * 移除影子表，直接使用业务表的 updatedAt 字段进行同步
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
 * 各表的同步数据（简化后只包含记录）
 */
export type SyncTableData = {
  [key in SyncTable]: any[];  // 直接存储业务记录数组
};

/**
 * 同步响应
 */
export interface SyncResponse {
  sessionId: string;
  status: 'success' | 'error';
  message?: string;
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
