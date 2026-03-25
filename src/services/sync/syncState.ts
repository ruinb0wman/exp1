/**
 * 同步状态管理
 * 用于在同步期间禁用某些自动触发的操作（如 Hooks）
 */

let isSyncing = false;

/**
 * 设置同步状态
 */
export function setSyncing(value: boolean): void {
  isSyncing = value;
}

/**
 * 获取当前是否正在同步
 */
export function getIsSyncing(): boolean {
  return isSyncing;
}
