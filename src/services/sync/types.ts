/**
 * 同步服务 - 类型定义
 * 
 * 定义同步服务相关的类型和接口
 */

import type {
  DeviceId,
  SyncTable,
  SyncMetadata,
  FieldConflict,
  ConflictResolution
} from '@/db/sync/types';

export type {
  DeviceId,
  SyncTable,
  SyncMetadata,
  FieldConflict,
  ConflictResolution
};

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
 * 初始化同步响应
 */
export interface SyncInitResponse {
  serverTime: string;
  lastSyncAt?: string;
  sessionId: string;
}

/**
 * 冲突解决请求
 */
export interface SyncResolveRequest {
  sessionId: string;
  resolutions: ConflictResolution[];
}

/**
 * 同步进度状态
 */
export interface SyncProgress {
  phase: 'idle' | 'init' | 'upload' | 'merge' | 'conflict' | 'download' | 'apply' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

/**
 * 同步配置
 */
export interface SyncConfig {
  serverUrl?: string;
  sessionId?: string;
  lastSyncAt?: string;
}

/**
 * 合并结果
 */
export interface MergeResult {
  success: boolean;
  data?: any;
  conflicts?: FieldConflict[];
}

/**
 * 同步错误
 */
export class SyncError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'SyncError';
  }
}
