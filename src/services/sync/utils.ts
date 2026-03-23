/**
 * 同步服务 - 工具函数
 * 
 * 提供 UUID 生成、哈希计算等工具函数
 */

/**
 * 生成 UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 计算对象的简单哈希（用于校验和）
 * 使用 JSON.stringify + 简单哈希算法
 */
export function computeChecksum(obj: any): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32bit 整数
  }
  return hash.toString(16);
}

/**
 * 深度比较两个对象是否相等
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return false;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return false;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 将对象转换为 Uint8Array
 */
export function objectToUint8Array(obj: any): Uint8Array {
  const json = JSON.stringify(obj);
  const encoder = new TextEncoder();
  return encoder.encode(json);
}

/**
 * 将 Uint8Array 转换为对象
 */
export function uint8ArrayToObject(arr: Uint8Array): any {
  const decoder = new TextDecoder();
  const json = decoder.decode(arr);
  return JSON.parse(json);
}
