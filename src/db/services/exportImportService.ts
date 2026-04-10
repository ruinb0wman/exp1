import { getDB } from '../index';
import type { TaskTemplate, TaskInstance } from '../types/task';
import type { RewardTemplate, RewardInstance } from '../types/reward';
import type { User, PointsHistory } from '../types/user';

// 备份文件格式版本
const BACKUP_VERSION = '1.0';

// 导出数据接口
export interface ExportData {
  version: string;
  exportedAt: string;
  appVersion: string;
  data: {
    taskTemplates: TaskTemplate[];
    taskInstances: TaskInstance[];
    rewardTemplates: RewardTemplate[];
    rewardInstances: RewardInstance[];
    users: User[];
    pointsHistory: PointsHistory[];
  };
}

// 导入策略（仅支持全量覆盖）
export type ImportStrategy = 'overwrite';

// 导入结果
export interface ImportResult {
  success: boolean;
  message: string;
  userId?: number; // 导入的用户ID，用于刷新积分
  stats?: {
    taskTemplates: number;
    taskInstances: number;
    rewardTemplates: number;
    rewardInstances: number;
    users: number;
    pointsHistory: number;
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
    rewardInstances: number;
    users: number;
    pointsHistory: number;
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
    rewardInstances,
    users,
    pointsHistory,
  ] = await Promise.all([
    db.taskTemplates.toArray(),
    db.taskInstances.toArray(),
    db.rewardTemplates.toArray(),
    db.rewardInstances.toArray(),
    db.users.toArray(),
    db.pointsHistory.toArray(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: getAppVersion(),
    data: {
      taskTemplates,
      taskInstances,
      rewardTemplates,
      rewardInstances,
      users,
      pointsHistory,
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
    'rewardInstances',
    'users',
    'pointsHistory',
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray((dbData as Record<string, unknown>)[key])) {
      return { isValid: false, error: `备份文件缺少 ${key} 数据` };
    }
  }

  // 计算统计信息
  const stats = {
    taskTemplates: (dbData.taskTemplates as unknown[]).length,
    taskInstances: (dbData.taskInstances as unknown[]).length,
    rewardTemplates: (dbData.rewardTemplates as unknown[]).length,
    rewardInstances: (dbData.rewardInstances as unknown[]).length,
    users: (dbData.users as unknown[]).length,
    pointsHistory: (dbData.pointsHistory as unknown[]).length,
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

  try {
    // 开始事务，清空并写入新数据
    await db.transaction(
      'rw',
      [
        db.taskTemplates,
        db.taskInstances,
        db.rewardTemplates,
        db.rewardInstances,
        db.users,
        db.pointsHistory,
      ],
      async () => {
        // 清空现有数据
        await Promise.all([
          db.taskTemplates.clear(),
          db.taskInstances.clear(),
          db.rewardTemplates.clear(),
          db.rewardInstances.clear(),
          db.users.clear(),
          db.pointsHistory.clear(),
        ]);

        // 写入新数据（保留原始 id，使用 bulkPut 确保 ID 一致）
        await Promise.all([
          db.taskTemplates.bulkPut(data.taskTemplates as TaskTemplate[]),
          db.taskInstances.bulkPut(data.taskInstances as TaskInstance[]),
          db.rewardTemplates.bulkPut(data.rewardTemplates as RewardTemplate[]),
          db.rewardInstances.bulkPut(data.rewardInstances as RewardInstance[]),
          // 只导入第一个用户，并设置 id 为 1
          db.users.bulkAdd(
            data.users.slice(0, 1).map(({ id, ...rest }) => ({ ...rest, id: 1 } as User))
          ),
          db.pointsHistory.bulkPut(data.pointsHistory as PointsHistory[]),
        ]);
      }
    );

    return {
      success: true,
      message: '数据导入成功（全量覆盖）',
      userId: 1, // 覆盖导入后用户ID为1
      stats: {
        taskTemplates: data.taskTemplates.length,
        taskInstances: data.taskInstances.length,
        rewardTemplates: data.rewardTemplates.length,
        rewardInstances: data.rewardInstances.length,
        users: data.users.length,
        pointsHistory: data.pointsHistory.length,
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
