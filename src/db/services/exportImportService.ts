import { getDB } from '../index';
import type { TaskTemplate, TaskInstance } from '../types/task';
import type { RewardTemplate, RewardPurchase, ReplenishmentRecord } from '../types/reward';
import type { User, PointsHistory } from '../types/user';
import type { Achievement } from '../types/achievement';
import { roundMoney, isValidMoneyCost, isCountedInConsumption } from '@/libs/reward';

/** v7 之前模板上的积分货币比例（旧模型：金额 = pointsCost / pointsPerYuan） */
type LegacyRatioField = { pointsPerYuan?: number };

/** 取旧备份里可用的比例，非法值兜底为 1 */
function readLegacyRatio(template: unknown): number {
  const { pointsPerYuan } = template as LegacyRatioField;
  return Number.isFinite(pointsPerYuan) && (pointsPerYuan as number) > 0
    ? (pointsPerYuan as number)
    : 1;
}

/** 单件金额：新备份直接用；旧备份（无 moneyCost）按 pointsCost / pointsPerYuan 换算 */
function resolveMoneyCost(template: RewardTemplate): number {
  if (isValidMoneyCost(template.moneyCost)) {
    return roundMoney(template.moneyCost);
  }
  return roundMoney(template.pointsCost / readLegacyRatio(template));
}

// 备份文件格式版本
const BACKUP_VERSION = '1.1';

// 导出数据接口
export interface ExportData {
  version: string;
  exportedAt: string;
  appVersion: string;
  data: {
    taskTemplates: TaskTemplate[];
    taskInstances: TaskInstance[];
    rewardTemplates: RewardTemplate[];
    rewardPurchases: RewardPurchase[];
    replenishmentRecords: ReplenishmentRecord[];
    users: User[];
    pointsHistory: PointsHistory[];
    achievements: Achievement[];
  };
}

// 导入策略（仅支持全量覆盖）
export type ImportStrategy = 'overwrite';

// 导入结果
export interface ImportResult {
  success: boolean;
  message: string;
  userId?: number;
  stats?: {
    taskTemplates: number;
    taskInstances: number;
    rewardTemplates: number;
    rewardPurchases: number;
    replenishmentRecords: number;
    users: number;
    pointsHistory: number;
    achievements: number;
  };
}

// 导入预览数据
export interface ImportPreview {
  isValid: boolean;
  error?: string;
  version?: string;
  exportedAt?: string;
  stats?: {
    taskTemplates: number;
    taskInstances: number;
    rewardTemplates: number;
    rewardPurchases: number;
    replenishmentRecords: number;
    users: number;
    pointsHistory: number;
    achievements: number;
  };
}

/**
 * 获取当前应用版本
 */
function getAppVersion(): string {
  // 从环境变量或配置中读取，暂时硬编码
  return '0.1.0';
}

/**
 * 格式化日期为文件名格式
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(): string {
  const date = formatDateForFilename(new Date());
  return `hello-tauri-backup-${date}.json`;
}

/**
 * 导出所有数据
 */
export async function exportAllData(): Promise<ExportData> {
  const db = getDB();

  const [
    taskTemplates,
    taskInstances,
    rewardTemplates,
    rewardPurchases,
    replenishmentRecords,
    users,
    pointsHistory,
    achievements,
  ] = await Promise.all([
    db.taskTemplates.toArray(),
    db.taskInstances.toArray(),
    db.rewardTemplates.toArray(),
    db.rewardPurchases.toArray(),
    db.replenishmentRecords.toArray(),
    db.users.toArray(),
    db.pointsHistory.toArray(),
    db.achievements.toArray(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: getAppVersion(),
    data: {
      taskTemplates,
      taskInstances,
      rewardTemplates,
      rewardPurchases,
      replenishmentRecords,
      users,
      pointsHistory,
      achievements,
    },
  };
}

/**
 * 验证导入数据格式
 */
export function validateImportData(data: unknown): ImportPreview {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: '无效的备份文件格式' };
  }

  const exportData = data as Partial<ExportData>;

  // 检查必要字段
  if (!exportData.version) {
    return { isValid: false, error: '备份文件缺少版本信息' };
  }

  if (!exportData.data || typeof exportData.data !== 'object') {
    return { isValid: false, error: '备份文件缺少数据内容' };
  }

  const { data: dbData } = exportData;

  // 检查数据数组是否存在
  const requiredArrays = [
    'taskTemplates',
    'taskInstances',
    'rewardTemplates',
    'users',
    'pointsHistory',
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray((dbData as Record<string, unknown>)[key])) {
      return { isValid: false, error: `备份文件缺少 ${key} 数据` };
    }
  }

  // 兼容 v1 备份（无 replenishmentRecords 字段）
  const hasReplenishmentRecords = Array.isArray((dbData as Record<string, unknown>).replenishmentRecords);
  // 兼容 1.0 备份（无 achievements 字段）
  const hasAchievements = Array.isArray((dbData as Record<string, unknown>).achievements);
  // 兼容旧备份（只有 rewardInstances、无 rewardPurchases）
  const hasRewardPurchases = Array.isArray((dbData as Record<string, unknown>).rewardPurchases);

  // 计算统计信息
  const stats = {
    taskTemplates: (dbData.taskTemplates as unknown[]).length,
    taskInstances: (dbData.taskInstances as unknown[]).length,
    rewardTemplates: (dbData.rewardTemplates as unknown[]).length,
    rewardPurchases: hasRewardPurchases ? (dbData.rewardPurchases as unknown[]).length : 0,
    replenishmentRecords: hasReplenishmentRecords ? (dbData.replenishmentRecords as unknown[]).length : 0,
    users: (dbData.users as unknown[]).length,
    pointsHistory: (dbData.pointsHistory as unknown[]).length,
    achievements: hasAchievements ? (dbData.achievements as unknown[]).length : 0,
  };

  return {
    isValid: true,
    version: exportData.version,
    exportedAt: exportData.exportedAt,
    stats,
  };
}

/**
 * 全量覆盖导入
 */
async function importWithOverwrite(data: ExportData['data']): Promise<ImportResult> {
  const db = getDB();

  // 兼容 v1 备份（无 replenishmentRecords 字段）
  const hasReplenishmentRecords = Array.isArray(data.replenishmentRecords);
  // 兼容 1.0 备份（无 achievements 字段）
  const hasAchievements = Array.isArray(data.achievements);
  // 兼容旧备份（只有 rewardInstances、无 rewardPurchases）
  const rewardPurchases = Array.isArray(data.rewardPurchases) ? data.rewardPurchases : [];

  try {
    // 开始事务，清空并写入新数据
    await db.transaction(
      'rw',
      [
        db.taskTemplates,
        db.taskInstances,
        db.rewardTemplates,
        db.rewardPurchases,
        db.users,
        db.pointsHistory,
        db.replenishmentRecords,
        db.achievements,
      ],
      async () => {
        // 清空现有数据
        await Promise.all([
          db.taskTemplates.clear(),
          db.taskInstances.clear(),
          db.rewardTemplates.clear(),
          db.rewardPurchases.clear(),
          db.users.clear(),
          db.pointsHistory.clear(),
          db.replenishmentRecords.clear(),
          db.achievements.clear(),
        ]);

        // 写入新数据（保留原始 id，使用 bulkPut 确保 ID 一致）
        await Promise.all([
          db.taskTemplates.bulkPut(data.taskTemplates as TaskTemplate[]),
          db.taskInstances.bulkPut(data.taskInstances as TaskInstance[]),
          // 旧备份没有 moneyCost / countInConsumption，导入时换算并兜底（计入统计）
          db.rewardTemplates.bulkPut(
            (data.rewardTemplates as RewardTemplate[]).map((template) => ({
              ...template,
              moneyCost: resolveMoneyCost(template),
              countInConsumption: isCountedInConsumption(template.countInConsumption),
            }))
          ),
          db.rewardPurchases.bulkPut(rewardPurchases as RewardPurchase[]),
          // 只导入第一个用户，并设置 id 为 1
          db.users.bulkAdd(
            data.users.slice(0, 1).map(({ id, ...rest }) => ({ ...rest, id: 1 } as User))
          ),
          db.pointsHistory.bulkPut(data.pointsHistory as PointsHistory[]),
          ...(hasReplenishmentRecords
            ? [db.replenishmentRecords.bulkPut(data.replenishmentRecords as ReplenishmentRecord[])]
            : []),
          ...(hasAchievements
            ? [db.achievements.bulkPut(data.achievements as Achievement[])]
            : []),
        ]);
      }
    );

    return {
      success: true,
      message: '数据导入成功（全量覆盖）',
      userId: 1,
      stats: {
        taskTemplates: data.taskTemplates.length,
        taskInstances: data.taskInstances.length,
        rewardTemplates: data.rewardTemplates.length,
        rewardPurchases: rewardPurchases.length,
        replenishmentRecords: hasReplenishmentRecords ? data.replenishmentRecords.length : 0,
        users: data.users.length,
        pointsHistory: data.pointsHistory.length,
        achievements: hasAchievements ? data.achievements.length : 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 导入数据（仅支持全量覆盖）
 */
export async function importData(data: ExportData): Promise<ImportResult> {
  return importWithOverwrite(data.data);
}
