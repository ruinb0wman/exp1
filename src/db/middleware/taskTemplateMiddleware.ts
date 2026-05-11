import type { TaskTemplate, TaskInstance } from '@/db/types';
import type { DB } from '@/db/types';
import { 
  shouldGenerateInstanceOnDate, 
  generateTaskInstance,
  toUserDateString,
  formatLocalDate,
} from '@/libs/task';

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
  dayEndTime?: string
): Promise<boolean> {
  // dayEndTime 未指定或为默认值时，从用户设置中获取
  if (!dayEndTime || dayEndTime === "00:00") {
    const user = await db.users.get(template.userId);
    dayEndTime = user?.dayEndTime || "00:00";
  }

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
        if (!inst.instanceDate) return false;
        // 使用"用户日期"比较是否是今天
        const instUserDate = inst.instanceDate;
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
        const instanceData = generateTaskInstance(template, today);

        // 在事务中添加实例
        const now = new Date().toISOString();
        await db.taskInstances.add({
          ...instanceData,
          createdAt: now,
        } as TaskInstance);
      });
      return true;
    } catch (error) {
      // 如果事务失败（可能是并发冲突），返回 false
      return false;
    }
  }

  // 周期性任务：直接生成实例
  const instanceData = generateTaskInstance(template, today);

  // 添加实例
  const now = new Date().toISOString();
  await db.taskInstances.add({
    ...instanceData,
    createdAt: now,
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
 * 为指定模板补建缺失的历史实例（从 startAt 到今天）
 * 解决未打开应用导致过去日期缺少实例的问题
 */
export async function backfillMissingInstancesForTemplate(
  db: DB,
  template: TaskTemplate,
  dayEndTime?: string
): Promise<number> {
  console.log(`[backfill] 📋 处理模板: "${template.title}" (id=${template.id}, repeatMode=${template.repeatMode}, startAt=${template.startAt})`);

  if (!template.enabled || template.repeatMode === 'none') {
    console.log(`[backfill] ⏭ 跳过: enabled=${template.enabled}, repeatMode=${template.repeatMode}`);
    return 0;
  }

  if (!template.startAt) {
    console.log(`[backfill] ⏭ 跳过 "${template.title}": 无 startAt`);
    return 0;
  }

  if (!dayEndTime || dayEndTime === "00:00") {
    const user = await db.users.get(template.userId);
    dayEndTime = user?.dayEndTime || "00:00";
  }
  console.log(`[backfill] dayEndTime=${dayEndTime}`);

  const allInstances = await db.taskInstances
    .where('templateId')
    .equals(template.id!)
    .toArray();
  console.log(`[backfill] 已有实例数: ${allInstances.length}`);

  if (template.endCondition === 'times' && template.endValue) {
    const maxTimes = parseInt(template.endValue, 10);
    console.log(`[backfill] endCondition=times, maxTimes=${maxTimes}, 当前=${allInstances.length}`);
    if (allInstances.length >= maxTimes) {
      console.log(`[backfill] ⏭ 跳过 "${template.title}": 已达最大次数 ${maxTimes}`);
      return 0;
    }
  }

  const existingDates = new Set<string>();
  for (const inst of allInstances) {
    if (inst.instanceDate) {
      existingDates.add(inst.instanceDate);
    }
  }
  console.log(`[backfill] 已有日期: [${[...existingDates].join(", ")}]`);

  const now = new Date();
  const todayStr = formatLocalDate(now);
  console.log(`[backfill] todayStr=${todayStr}`);

  let endDate: Date;
  if (template.endCondition === 'date' && template.endValue) {
    endDate = new Date(template.endValue);
    const endDateStr = formatLocalDate(endDate);
    console.log(`[backfill] endCondition=date, endValue=${template.endValue}, endDateStr=${endDateStr}`);
    if (endDateStr < todayStr) {
      endDate = new Date(endDateStr);
    } else {
      endDate = now;
    }
  } else {
    endDate = now;
  }

  const instancesToAdd: Omit<TaskInstance, 'id'>[] = [];
  const currentDate = new Date(template.startAt);
  const end = new Date(endDate);
  console.log(`[backfill] 日期范围: ${formatLocalDate(currentDate)} ~ ${formatLocalDate(end)}`);

  let totalInstanceCount = allInstances.length;

  while (currentDate <= end) {
    const dateStr = formatLocalDate(currentDate);

    if (!existingDates.has(dateStr)) {
      if (shouldGenerateInstanceOnDate(template, allInstances, currentDate, "00:00")) {
        const instanceData = generateTaskInstance(template, currentDate);
        instancesToAdd.push({
          ...instanceData,
          createdAt: new Date().toISOString(),
        } as TaskInstance);
        totalInstanceCount++;
        console.log(`[backfill] ✅ 生成实例: date=${dateStr}, 已累计=${totalInstanceCount}`);

        if (template.endCondition === 'times' && template.endValue) {
          const maxTimes = parseInt(template.endValue, 10);
          if (totalInstanceCount >= maxTimes) {
            console.log(`[backfill] ⛔ 已达最大次数 ${maxTimes}，停止`);
            break;
          }
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`[backfill] 待插入实例数: ${instancesToAdd.length}`);
  if (instancesToAdd.length > 0) {
    const datesToInsert = instancesToAdd.map(i => i.instanceDate);
    console.log(`[backfill] 📅 待插入日期: [${datesToInsert.join(", ")}]`);
    try {
      await db.taskInstances.bulkAdd(instancesToAdd as TaskInstance[], { allKeys: true });
      console.log(`[backfill] ✅ bulkAdd 成功, 已插入 ${instancesToAdd.length} 条`);
    } catch (error) {
      console.error(`[backfill] ❌ bulkAdd 失败:`, error);
    }
  } else {
    console.log(`[backfill] ℹ️ 无新实例需要创建`);
  }

  return instancesToAdd.length;
}

/**
 * 为所有启用的模板补建缺失的历史实例
 */
export async function backfillMissingInstancesForAllTemplates(
  db: DB,
  userId: number,
  dayEndTime: string = "00:00"
): Promise<number> {
  console.log(`[backfill] ====== 开始批量回填 ======`);
  console.log(`[backfill] userId=${userId}, dayEndTime=${dayEndTime}`);

  const templates = await db.taskTemplates
    .where('userId')
    .equals(userId)
    .and((t) => t.enabled)
    .toArray();
  console.log(`[backfill] 启用的模板数: ${templates.length}`);

  let totalBackfilled = 0;

  for (const template of templates) {
    const count = await backfillMissingInstancesForTemplate(db, template, dayEndTime);
    if (count > 0) {
      totalBackfilled += count;
    }
    console.log(`[backfill] 模板 "${template.title}": 回填 ${count} 条`);
  }

  console.log(`[backfill] ====== 批量回填结束, 总计: ${totalBackfilled} 条 ======`);
  return totalBackfilled;
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