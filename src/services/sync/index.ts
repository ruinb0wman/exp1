/**
 * 同步服务模块导出
 */

// 类型（避免重复导出 MergeResult）
export type {
  DeviceId,
  SyncTable,
  SyncMetadata,
  FieldConflict,
  ConflictResolution,
  SyncData,
  SyncTableData,
  SyncResponse,
  SyncInitResponse,
  SyncResolveRequest,
  SyncProgress,
  SyncConfig,
  SyncError
} from './types';

// 工具函数
export * from './utils';

// 压缩模块
export * from './compression';

// 备份恢复
export * from './backup';

// 合并算法 - 单独导出 MergeResult 类型
export type { MergeResult } from './merge';
export { threeWayMerge, applyConflictResolutions } from './merge';

// HTTP 客户端
export * from './syncClient';

// 核心逻辑
export * from './syncService';
