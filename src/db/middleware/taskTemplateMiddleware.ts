import type { TaskTemplate, TaskInstance } from '@/db/types';
import type { DB } from '@/db/types';
import { 
  shouldGenerateInstanceOnDate, 
  generateTaskInstance,
  toUserDateString,
} from '@/libs/task';
import { getIsSyncing } from '@/services/sync/syncState';

// 用于防止重复处理的 Set
const processedTemplateIds = new Set<string>();

/**
 * 检查指定模板在今天是否需要生成实例，如果需要则生成
 * @param db 数据库实例
 * @param template 任务模板
 * @param dayEndTime 一天结束时间
 * @returns 是否生成了新实例
 */
export async function checkAndGenerateForTemplate(
  db: DB,
  template: TaskTemplate,
  dayEndTime: string = "00:00"
): Promise<boolean> {
  // 只处理启用的模板
  if (!template.enabled) {
    return false;
  }

  const today = new Date();

  // 对于一次性任务（repeatMode === 'none'），需要查询该模板的所有历史实例
  // 对于周期性任务，只查询今天的实例
  let existingInstances: TaskInstance[];

  if (template.repeatMode === 'none') {
    // 一次性任务：查询该模板的所有实例（不限制日期）
    existingInstances = await db.taskInstances
      .where('templateId')
      .equals(template.id!)
      .toArray();
  } else {
    // 周期性任务：只查询今天的实例
    existingInstances = await db.taskInstances
      .where('templateId')
      .equals(template.id!)
      .and((inst) => {
        if (!inst.startAt) return false;
        // 使用"用户日期"比较是否是今天
        const instUserDate = toUserDateString(inst.startAt, dayEndTime);
        const todayUserDate = toUserDateString(today, dayEndTime);
        return instUserDate === todayUserDate;
      })
      .toArray();
  }

  // 检查是否需要生成实例
  if (!shouldGenerateInstanceOnDate(template, existingInstances, today, dayEndTime)) {
    return false;
  }

  // 对于一次性任务，使用事务确保原子性（防止并发问题）
  if (template.repeatMode === 'none') {
    try {
      await db.transaction('rw', db.taskInstances, async () => {
        // 在事务中再次查询，确保原子性
        const instancesInTx = await db.taskInstances
          .where('templateId')
          .equals(template.id!)
          .toArray();

        if (instancesInTx.length > 0) {
          return;
        }

        // 生成新实例
        const instanceData = generateTaskInstance(template, dayEndTime, today);

        // 在事务中添加实例
        const now = new Date().toISOString();
        await db.taskInstances.add({
          ...instanceData,
          createdAt: now,
          updatedAt: now,
        } as TaskInstance);
      });
      return true;
    } catch (error) {
      // 如果事务失败（可能是并发冲突），返回 false
      return false;
    }
  }

  // 周期性任务：直接生成实例
  const instanceData = generateTaskInstance(template, dayEndTime, today);

  // 添加实例
  const now = new Date().toISOString();
  await db.taskInstances.add({
    ...instanceData,
    createdAt: now,
    updatedAt: now,
  } as TaskInstance);

  return true;
}

/**
 * 为所有启用的模板检查并生成今天的实例
 * @param db 数据库实例
 * @param userId 用户ID
 * @param dayEndTime 一天结束时间
 * @returns 生成的实例数量
 */
export async function checkAllTemplatesAndGenerate(
  db: DB,
  userId: number,
  dayEndTime: string = "00:00"
): Promise<number> {
  // 获取所有启用的模板
  const templates = await db.taskTemplates
    .where('userId')
    .equals(userId)
    .and((t) => t.enabled)
    .toArray();

  let generatedCount = 0;

  // 逐个检查并生成
  for (const template of templates) {
    const generated = await checkAndGenerateForTemplate(db, template, dayEndTime);
    if (generated) {
      generatedCount++;
    }
  }

  return generatedCount;
}

/**
 * 创建 TaskTemplate 中间件
 * 在创建和更新模板时自动检查并生成今天的实例
 */
export function createTaskTemplateMiddleware(dayEndTime: string = "00:00") {
  return {
    /**
     * 注册 hooks 到数据库实例
     */
    register(db: DB) {
      // 创建模板时的 hook
      db.taskTemplates.hook('creating', function (_primKey, obj, trans) {
        // 同步期间跳过自动生成实例
        if (getIsSyncing()) return;
        
        const template = obj as TaskTemplate;

        // 只处理启用的模板
        if (!template.enabled) {
          return;
        }

        // 使用 onsuccess 回调，在创建成功后获取生成的 id
        this.onsuccess = (generatedId) => {
          const templateId = generatedId as string;

          // 防重检查：如果已经处理过这个模板，直接返回
          if (processedTemplateIds.has(templateId)) {
            return;
          }

          // 标记为已处理
          processedTemplateIds.add(templateId);

          // 设置生成的 id
          template.id = templateId as string;

          // 在事务完成后检查并生成实例
          trans.on('complete', async () => {
            try {
              await checkAndGenerateForTemplate(db, template, dayEndTime);
            } catch (error) {
              console.error('Failed to generate instance after creating template:', error);
              throw error;
            }
          });
        };
      });

      // 更新模板时的 hook
      db.taskTemplates.hook('updating', function (mods, _primKey, obj, trans) {
        // 同步期间跳过自动生成实例
        if (getIsSyncing()) return;
        
        // 合并更新后的字段得到完整模板对象
        const updatedTemplate = { ...obj, ...mods } as TaskTemplate;
        
        // 只处理启用的模板
        if (!updatedTemplate.enabled) {
          return;
        }

        // 在事务完成后检查并生成实例
        trans.on('complete', async () => {
          try {
            await checkAndGenerateForTemplate(db, updatedTemplate, dayEndTime);
          } catch (error) {
            console.error('Failed to generate instance after updating template:', error);
            throw error;
          }
        });
      });
    },
  };
}