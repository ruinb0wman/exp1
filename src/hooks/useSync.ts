import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { SyncProgress, FieldConflict, DeviceId, SyncData } from '@/services/sync';
import type { SyncTable } from '@/db/sync/types';
import { performSync, performSyncWithResolutions, collectSyncData } from '@/services/sync';
import { getDB } from '@/db';
import { getDeviceId } from '@/db/index';

interface SyncState {
  isOpen: boolean;
  progress: SyncProgress;
  conflicts: FieldConflict[];
  qrCodeContent: string;
  serverUrl: string | null;
  lastSyncAt: string | null;
  currentSessionId: string | null;
}

interface UseSyncReturn {
  state: SyncState;
  deviceId: DeviceId;
  isMobile: boolean;
  openSync: () => Promise<void>;
  closeSync: () => void;
  startSync: (serverUrl: string) => Promise<void>;
  resolveConflicts: (resolutions: { table: SyncTable; syncId: string; field: string; choice: 'local' | 'remote' }[]) => Promise<void>;
  retrySync: () => Promise<void>;
  cancelSync: () => Promise<void>;
}

/**
 * 同步状态管理 Hook
 */
export function useSync(): UseSyncReturn {
  const deviceId = getDeviceId();
  const isMobile = deviceId === 'mobile';
  const unlistenRef = useRef<UnlistenFn[]>([]);

  const [state, setState] = useState<SyncState>({
    isOpen: false,
    progress: {
      phase: 'idle',
      progress: 0,
      message: '准备同步',
    },
    conflicts: [],
    qrCodeContent: '',
    serverUrl: null,
    lastSyncAt: null,
    currentSessionId: null,
  });

  // 加载最后同步时间
  useEffect(() => {
    const loadLastSync = async () => {
      const db = getDB();
      const config = await db.table('syncConfig').where('key').equals('lastSyncAt').first() as { value: string } | undefined;
      if (config) {
        setState(prev => ({ ...prev, lastSyncAt: config.value }));
      }
    };
    loadLastSync();
  }, []);

  // PC端：监听 IPC 事件
  useEffect(() => {
    if (isMobile) return;

    const setupListeners = async () => {
      // 监听请求 PC 数据的事件
      const unlistenRequest = await listen('sync:request-pc-data', async (event) => {
        const { sessionId } = event.payload as { sessionId: string };
        console.log('[PC] Received request for PC data, session:', sessionId);

        try {
          // 收集 PC 本地数据
          const pcData = await collectSyncData(sessionId);

          // 通过 IPC 发送数据到 Rust
          await invoke('set_pc_sync_data', {
            sessionId,
            data: pcData,
          });

          console.log('[PC] PC data sent to Rust backend');
        } catch (error) {
          console.error('[PC] Failed to provide PC data:', error);
        }
      });

      // 监听应用合并后数据的事件
      const unlistenApply = await listen('sync:apply-merged-data', async (event) => {
        const { sessionId } = event.payload as { sessionId: string };
        console.log('[PC] Received request to apply merged data, session:', sessionId);

        try {
          // 从 Rust 获取合并后的数据
          const result = await invoke<SyncData>('get_merged_sync_data', { sessionId });

          if (result) {
            // 应用数据到本地数据库
            const { applySyncData } = await import('@/services/sync');
            await applySyncData(result);

            console.log('[PC] Merged data applied to local database');

            // 通知 Rust 数据已应用
            await invoke('clear_sync_session', { sessionId });
          }
        } catch (error) {
          console.error('[PC] Failed to apply merged data:', error);
          // 恢复备份
          const { restoreFromBackup } = await import('@/services/sync');
          await restoreFromBackup(sessionId);
        }
      });

      // 监听同步完成事件
      const unlistenComplete = await listen('sync:completed', (event) => {
        const { sessionId, success } = event.payload as { sessionId: string; success: boolean };
        console.log('[PC] Sync completed, session:', sessionId, 'success:', success);

        if (success) {
          // 更新最后同步时间
          const now = new Date().toISOString();
          setState(prev => ({
            ...prev,
            lastSyncAt: now,
          }));
        }
      });

      unlistenRef.current = [unlistenRequest, unlistenApply, unlistenComplete];
    };

    setupListeners();

    return () => {
      // 清理监听器
      unlistenRef.current.forEach(unlisten => unlisten());
      unlistenRef.current = [];
    };
  }, [isMobile]);

  // 打开同步弹窗
  const openSync = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      progress: { phase: 'idle', progress: 0, message: '准备同步' },
      conflicts: [],
    }));

    // PC端：启动服务器并生成 QR 码
    if (!isMobile) {
      try {
        // 调用 Rust 命令启动服务器
        const result = await invoke<{ ip: string; port: number; qr_code: string }>('start_sync_server');

        console.log('Sync server started:', result);
        console.log('Server IP:', result.ip);
        console.log('Server Port:', result.port);
        console.log('Server URL:', `http://${result.ip}:${result.port}`);

        setState(prev => ({
          ...prev,
          qrCodeContent: JSON.stringify({
            v: 1,
            ip: result.ip,
            port: result.port,
            ts: Date.now(),
          }),
          serverUrl: `http://${result.ip}:${result.port}`,
        }));
      } catch (error) {
        console.error('Failed to start sync server:', error);
        setState(prev => ({
          ...prev,
          progress: {
            phase: 'error',
            progress: 0,
            message: '启动同步服务器失败',
          },
        }));
      }
    }
  }, [isMobile]);

  // 关闭同步弹窗
  const closeSync = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      progress: { phase: 'idle', progress: 0, message: '准备同步' },
      conflicts: [],
      currentSessionId: null,
    }));

    // PC端：停止服务器
    if (!isMobile) {
      invoke('stop_sync_server').catch(console.error);
    }
  }, [isMobile]);

  // 开始同步（手机端扫码后调用）
  const startSync = useCallback(async (serverUrl: string) => {
    setState(prev => ({
      ...prev,
      serverUrl,
    }));

    try {
      await performSync(serverUrl, (progress) => {
        setState(prev => ({
          ...prev,
          progress,
        }));

        // 如果有冲突，保存冲突列表
        if (progress.phase === 'conflict') {
          // 冲突列表会在 catch 块中处理
        }
      });

      // 同步成功，更新最后同步时间
      const now = new Date().toISOString();
      setState(prev => ({
        ...prev,
        lastSyncAt: now,
        isOpen: false,
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'Conflicts detected') {
        // 冲突已在服务端保存，需要获取冲突列表
        // 这里简化处理，实际应该从服务端获取
        setState(prev => ({
          ...prev,
          progress: {
            phase: 'conflict',
            progress: 60,
            message: '发现冲突，请解决',
          },
        }));
      } else {
        setState(prev => ({
          ...prev,
          progress: {
            phase: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : '同步失败',
          },
        }));
      }
    }
  }, []);

  // 解决冲突
  const resolveConflicts = useCallback(async (resolutions: { table: SyncTable; syncId: string; field: string; choice: 'local' | 'remote' }[]) => {
    if (!state.serverUrl) return;

    try {
      await performSyncWithResolutions(
        state.serverUrl,
        resolutions,
        (progress) => {
          setState(prev => ({
            ...prev,
            progress,
          }));
        }
      );

      // 同步成功
      const now = new Date().toISOString();
      setState(prev => ({
        ...prev,
        lastSyncAt: now,
        conflicts: [],
        isOpen: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        progress: {
          phase: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : '同步失败',
        },
      }));
    }
  }, [state.serverUrl]);

  // 重试同步
  const retrySync = useCallback(async () => {
    if (state.serverUrl) {
      await startSync(state.serverUrl);
    }
  }, [state.serverUrl, startSync]);

  // 取消同步
  const cancelSync = useCallback(async () => {
    // 恢复备份
    if (state.serverUrl) {
      const db = getDB();
      const sessionConfig = await db.table('syncConfig')
        .where('key')
        .equals('currentSessionId')
        .first() as { value: string } | undefined;

      if (sessionConfig) {
        const { restoreFromBackup } = await import('@/services/sync');
        await restoreFromBackup(sessionConfig.value);
      }
    }

    closeSync();
  }, [state.serverUrl, closeSync]);

  return {
    state,
    deviceId,
    isMobile,
    openSync,
    closeSync,
    startSync,
    resolveConflicts,
    retrySync,
    cancelSync,
  };
}
