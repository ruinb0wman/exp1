/**
 * 同步服务 - HTTP 客户端
 *
 * 手机端用于与 PC 端同步服务器通信
 */

import type {
  SyncData,
  SyncResponse,
  SyncInitResponse,
  DeviceId
} from './types';
import { SyncError } from './types';
import { compressData, decompressData } from './compression';

/**
 * 同步客户端
 */
export class SyncClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.timeout = timeout;
    console.log(`[SyncClient] Created client for server: ${this.baseUrl}, timeout: ${timeout}ms`);
  }

  /**
   * 初始化同步
   * @param deviceId 设备ID
   */
  async initSync(deviceId: DeviceId): Promise<SyncInitResponse> {
    console.log(`[SyncClient] initSync: deviceId=${deviceId}`);
    const requestBody = {
      deviceId,
      timestamp: new Date().toISOString()
    };
    console.log(`[SyncClient] initSync request:`, requestBody);

    const response = await this.fetchWithTimeout('/api/sync/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log(`[SyncClient] initSync response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SyncClient] initSync failed: ${response.status} ${response.statusText}`, errorText);
      throw new SyncError(
        `Init sync failed: ${response.statusText}`,
        'INIT_FAILED',
        true
      );
    }

    const result = await response.json();
    console.log(`[SyncClient] initSync response:`, result);
    return result;
  }

  /**
   * 上传数据
   * @param data 同步数据
   */
  async uploadData(data: SyncData): Promise<SyncResponse> {
    console.log(`[SyncClient] uploadData: sessionId=${data.sessionId}, tables=${Object.keys(data.tables).join(',')}`);
    const compressed = compressData(data);
    console.log(`[SyncClient] uploadData compressed size: ${compressed.byteLength} bytes`);

    const response = await this.fetchWithTimeout('/api/sync/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Session-Id': data.sessionId
      },
      body: compressed
    });

    console.log(`[SyncClient] uploadData response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SyncClient] uploadData failed: ${response.status} ${response.statusText}`, errorText);
      throw new SyncError(
        `Upload failed: ${response.statusText}`,
        'UPLOAD_FAILED',
        true
      );
    }

    const result = await response.json();
    console.log(`[SyncClient] uploadData response:`, result);
    return result;
  }



  /**
   * 下载 PC 端的数据
   * @param sessionId 会话ID
   */
  async downloadData(sessionId: string): Promise<SyncData> {
    console.log(`[SyncClient] downloadData: sessionId=${sessionId}`);
    const requestBody = { sessionId };
    console.log(`[SyncClient] downloadData request:`, requestBody);

    const response = await this.fetchWithTimeout('/api/sync/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log(`[SyncClient] downloadData response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SyncClient] downloadData failed: ${response.status} ${response.statusText}`, errorText);
      throw new SyncError(
        `Download failed: ${response.statusText}`,
        'DOWNLOAD_FAILED',
        true
      );
    }

    // 读取压缩数据
    const compressed = new Uint8Array(await response.arrayBuffer());
    console.log(`[SyncClient] downloadData received ${compressed.byteLength} bytes`);

    // 解压数据
    console.log(`[SyncClient] downloadData decompressing...`);
    const decompressed = decompressData(compressed);
    console.log(`[SyncClient] downloadData decompressed, tables:`, Object.keys(decompressed.tables));

    return decompressed;
  }

  /**
   * 上传合并后的数据到 PC 端
   * @param data 合并后的同步数据
   */
  async applyData(data: SyncData): Promise<SyncResponse> {
    console.log(`[SyncClient] applyData: sessionId=${data.sessionId}, tables=${Object.keys(data.tables).join(',')}`);
    const compressed = compressData(data);
    console.log(`[SyncClient] applyData compressed size: ${compressed.byteLength} bytes`);

    const response = await this.fetchWithTimeout('/api/sync/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Session-Id': data.sessionId
      },
      body: compressed
    });

    console.log(`[SyncClient] applyData response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SyncClient] applyData failed: ${response.status} ${response.statusText}`, errorText);
      throw new SyncError(
        `Apply failed: ${response.statusText}`,
        'APPLY_FAILED',
        true
      );
    }

    const result = await response.json();
    console.log(`[SyncClient] applyData response:`, result);
    return result;
  }

  /**
   * 完成同步
   * @param sessionId 会话ID
   */
  async completeSync(sessionId: string): Promise<{ success: boolean; message?: string }> {
    console.log(`[SyncClient] completeSync: sessionId=${sessionId}`);
    const requestBody = { sessionId };
    console.log(`[SyncClient] completeSync request:`, requestBody);

    const response = await this.fetchWithTimeout('/api/sync/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log(`[SyncClient] completeSync response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SyncClient] completeSync failed: ${response.status} ${response.statusText}`, errorText);
      throw new SyncError(
        `Complete sync failed: ${response.statusText}`,
        'COMPLETE_FAILED',
        true
      );
    }

    const result = await response.json();
    console.log(`[SyncClient] completeSync response:`, result);
    return result;
  }

  /**
   * 带超时的 fetch
   */
  private async fetchWithTimeout(
    path: string,
    options: RequestInit
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    console.log(`[SyncClient] fetch: ${options.method} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn(`[SyncClient] fetch timeout: ${url}`);
      controller.abort();
    }, this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log(`[SyncClient] fetch success: ${options.method} ${path} -> ${response.status}`);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`[SyncClient] fetch aborted (timeout): ${url}`);
          throw new SyncError(
            'Request timeout',
            'TIMEOUT',
            true
          );
        }
      }

      console.error(`[SyncClient] fetch error: ${url}`, error);
      throw new SyncError(
        `Network error: ${error}`,
        'NETWORK_ERROR',
        true
      );
    }
  }
}

/**
 * 创建同步客户端
 * @param serverUrl 服务器地址
 */
export function createSyncClient(serverUrl: string): SyncClient {
  return new SyncClient(serverUrl);
}
