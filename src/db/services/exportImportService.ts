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

// 导入策略
export type ImportStrategy = 'overwrite' | 'merge';

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
 * 智能合并导入
 */
async function importWithMerge(data: ExportData['data']): Promise<ImportResult> {
  const db = getDB();

  try {
    let importedCount = {
      taskTemplates: 0,
      taskInstances: 0,
      rewardTemplates: 0,
      rewardInstances: 0,
      users: 0,
      pointsHistory: 0,
    };

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
        // 任务模板：按 title + userId 去重
        const existingTaskTemplates = await db.taskTemplates.toArray();
        const taskTemplateKeys = new Set(
          existingTaskTemplates.map((t) => `${t.userId}-${t.title}`)
        );
        const newTaskTemplates = data.taskTemplates.filter((t) => {
          const key = `${t.userId}-${t.title}`;
          if (taskTemplateKeys.has(key)) return false;
          taskTemplateKeys.add(key);
          return true;
        });
        if (newTaskTemplates.length > 0) {
          // 保留原始 ID 使用 bulkPut
          await db.taskTemplates.bulkPut(newTaskTemplates as TaskTemplate[]);
          importedCount.taskTemplates = newTaskTemplates.length;
        }

        // 任务实例：按 templateId + startAt 去重
        const existingInstances = await db.taskInstances.toArray();
        const instanceKeys = new Set(
          existingInstances.map((i) => `${i.templateId}-${i.startAt}`)
        );
        const newInstances = data.taskInstances.filter((i) => {
          const key = `${i.templateId}-${i.startAt}`;
          if (instanceKeys.has(key)) return false;
          instanceKeys.add(key);
          return true;
        });
        if (newInstances.length > 0) {
          // 保留原始 ID 使用 bulkPut
          await db.taskInstances.bulkPut(newInstances as TaskInstance[]);
          importedCount.taskInstances = newInstances.length;
        }

        // 奖励模板：按 title + userId 去重
        const existingRewardTemplates = await db.rewardTemplates.toArray();
        const rewardTemplateKeys = new Set(
          existingRewardTemplates.map((r) => `${r.userId}-${r.title}`)
        );
        const newRewardTemplates = data.rewardTemplates.filter((r) => {
          const key = `${r.userId}-${r.title}`;
          if (rewardTemplateKeys.has(key)) return false;
          rewardTemplateKeys.add(key);
          return true;
        });
        if (newRewardTemplates.length > 0) {
          // 保留原始 ID 使用 bulkPut
          await db.rewardTemplates.bulkPut(newRewardTemplates as RewardTemplate[]);
          importedCount.rewardTemplates = newRewardTemplates.length;
        }

        // 奖励实例：按 templateId + createdAt 去重
        const existingRewardInstances = await db.rewardInstances.toArray();
        const rewardInstanceKeys = new Set(
          existingRewardInstances.map((r) => `${r.templateId}-${r.createdAt}`)
        );
        const newRewardInstances = data.rewardInstances.filter((r) => {
          const key = `${r.templateId}-${r.createdAt}`;
          if (rewardInstanceKeys.has(key)) return false;
          rewardInstanceKeys.add(key);
          return true;
        });
        if (newRewardInstances.length > 0) {
          // 保留原始 ID 使用 bulkPut
          await db.rewardInstances.bulkPut(newRewardInstances as RewardInstance[]);
          importedCount.rewardInstances = newRewardInstances.length;
        }

        // 用户：合并策略特殊处理，保留现有用户
        // 如果没有现有用户，才导入备份中的第一个用户
        const existingUsers = await db.users.toArray();
        if (existingUsers.length === 0 && data.users.length > 0) {
          await db.users.bulkAdd(
            data.users.slice(0, 1).map(({ id, ...rest }) => ({ ...rest, id: 1 } as User))
          );
          importedCount.users = 1;
        }

        // 积分历史：按 createdAt + type + amount 去重
        const existingHistory = await db.pointsHistory.toArray();
        const historyKeys = new Set(
          existingHistory.map((h) => `${h.createdAt}-${h.type}-${h.amount}`)
        );
        const newHistory = data.pointsHistory.filter((h) => {
          const key = `${h.createdAt}-${h.type}-${h.amount}`;
          if (historyKeys.has(key)) return false;
          historyKeys.add(key);
          return true;
        });
        if (newHistory.length > 0) {
          // 保留原始 ID 使用 bulkPut
          await db.pointsHistory.bulkPut(newHistory as PointsHistory[]);
          importedCount.pointsHistory = newHistory.length;
        }
      }
    );

    const totalImported = Object.values(importedCount).reduce((a, b) => a + b, 0);

    // 获取当前用户ID（合并模式下，用户ID为1或现有用户的ID）
    const existingUsers = await db.users.toArray();
    const userId = existingUsers.length > 0 ? existingUsers[0].id : 1;

    return {
      success: true,
      message:
        totalImported > 0
          ? `成功合并 ${totalImported} 条数据`
          : '没有需要导入的新数据（所有数据已存在）',
      userId,
      stats: importedCount,
    };
  } catch (error) {
    return {
      success: false,
      message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 导入数据
 */
export async function importData(
  data: ExportData,
  strategy: ImportStrategy
): Promise<ImportResult> {
  if (strategy === 'overwrite') {
    return importWithOverwrite(data.data);
  } else {
    return importWithMerge(data.data);
  }
}
