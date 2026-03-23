/**
 * 同步服务 - 压缩模块
 * 
 * 提供 gzip 压缩和解压功能
 */

import pako from 'pako';

/**
 * 压缩数据
 * @param data 要压缩的数据
 * @returns 压缩后的 Uint8Array
 */
export function compressData(data: any): Uint8Array {
  const json = JSON.stringify(data);
  return pako.gzip(json);
}

/**
 * 解压数据
 * @param compressed 压缩后的 Uint8Array
 * @returns 解压后的数据
 */
export function decompressData(compressed: Uint8Array): any {
  const json = pako.ungzip(compressed, { to: 'string' });
  return JSON.parse(json);
}

/**
 * 将 Uint8Array 转换为 Base64 字符串
 * @param arr Uint8Array 数据
 * @returns Base64 字符串
 */
export function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

/**
 * 将 Base64 字符串转换为 Uint8Array
 * @param base64 Base64 字符串
 * @returns Uint8Array 数据
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * 压缩数据并转为 Base64
 * @param data 要压缩的数据
 * @returns Base64 字符串
 */
export function compressToBase64(data: any): string {
  const compressed = compressData(data);
  return uint8ArrayToBase64(compressed);
}

/**
 * 从 Base64 解压数据
 * @param base64 Base64 字符串
 * @returns 解压后的数据
 */
export function decompressFromBase64(base64: string): any {
  const compressed = base64ToUint8Array(base64);
  return decompressData(compressed);
}
