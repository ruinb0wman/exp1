/**
 * ID 生成工具
 * - UUID 生成
 * - 高效哈希函数（FNV-1a）用于同步确定性 ID
 */

const FNV_1A_PRIME = 0x01000193;
const FNV_1A_OFFSET_BASIS = 0x811c9dc5;

function fnv1a(str: string): number {
  let hash = FNV_1A_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_1A_PRIME);
  }
  return hash >>> 0;
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function hashString(str: string): string {
  return fnv1a(str).toString(16);
}

export function hashTaskInstance(templateId: string, date: string): string {
  return hashString(`${templateId}-${date}`);
}

export function hashPointsHistory(instanceId: string, type: string, stageId?: string): string {
  const base = `${instanceId}-${type}`;
  return hashString(stageId ? `${base}-${stageId}` : base);
}

export function hashRewardInstance(
  templateId: string,
  userId: number,
  timestamp: string
): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return hashString(`${templateId}-${userId}-${timestamp}-${randomSuffix}`);
}