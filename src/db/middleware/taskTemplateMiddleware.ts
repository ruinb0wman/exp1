import type { TaskTemplate, TaskInstance } from '@/db/types';
import type { DB } from '@/db/types';
import { 
  shouldGenerateInstanceOnDate, 
  generateTaskInstance,
  toUserDateString,
  formatLocalDate,
} from '@/libs/task';

const processedTemplateIds = new Set<string>();

async function getUserDayEndTime(db: DB, userId: number): Promise<string> {
  const user = await db.users.get(userId);
  return user?.dayEndTime || "00:00";
}

/**
 * 检查指定模板在今天是否需要生成实例，如果需要则生成
 */
export async function checkAndGenerateForTemplate(
  db: DB,
  template: TaskTemplate
): Promise<boolean> {
  const dayEndTime = await getUserDayEndTime(db, template.userId);

  if (!template.enabled) {
    return false;
  }

  const today = new Date();

  let existingInstances: TaskInstance[];

  if (template.repeatMode === 'none') {
    existingInstances = await db.taskInstances
      .where('templateId')
      .equals(template.id!)
      .toArray();
  } else {
    existingInstances = await db.taskInstances
      .where('templateId')
      .equals(template.id!)
      .and((inst) => {
        if (!inst.instanceDate) return false;
        const todayUserDate = toUserDateString(today, dayEndTime);
        return inst.instanceDate === todayUserDate;
      })
      .toArray();
  }

  if (!shouldGenerateInstanceOnDate(template, existingInstances, today, dayEndTime)) {
    return false;
  }

  if (template.repeatMode === 'none') {
    try {
      await db.transaction('rw', db.taskInstances, async () => {
        const instancesInTx = await db.taskInstances
          .where('templateId')
          .equals(template.id!)
          .toArray();

        if (instancesInTx.length > 0) {
          return;
        }

        const instanceData = generateTaskInstance(template, today, dayEndTime);

        const now = new Date().toISOString();
        await db.taskInstances.add({
          ...instanceData,
          createdAt: now,
        } as TaskInstance);
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  const instanceData = generateTaskInstance(template, today, dayEndTime);

  const now = new Date().toISOString();
  await db.taskInstances.add({
    ...instanceData,
    createdAt: now,
  } as TaskInstance);

  return true;
}

export async function checkAllTemplatesAndGenerate(
  db: DB,
  userId: number
): Promise<number> {
  const templates = await db.taskTemplates
    .where('userId')
    .equals(userId)
    .and((t) => t.enabled)
    .toArray();

  let generatedCount = 0;

  for (const template of templates) {
    const generated = await checkAndGenerateForTemplate(db, template);
    if (generated) {
      generatedCount++;
    }
  }

  return generatedCount;
}

export async function backfillMissingInstancesForTemplate(
  db: DB,
  template: TaskTemplate
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

  const dayEndTime = await getUserDayEndTime(db, template.userId);
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

  // 将时间归一化到 dayEndTime 之后，避免 toUserDateString 回退日期
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  currentDate.setHours(endHour, endMinute, 1, 0);

  let totalInstanceCount = allInstances.length;

  while (currentDate <= end) {
    const dateStr = formatLocalDate(currentDate);

    if (!existingDates.has(dateStr)) {
      if (shouldGenerateInstanceOnDate(template, allInstances, currentDate, dayEndTime)) {
        const instanceData = generateTaskInstance(template, currentDate, dayEndTime);
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

export async function backfillMissingInstancesForAllTemplates(
  db: DB,
  userId: number
): Promise<number> {
  console.log(`[backfill] ====== 开始批量回填 ======`);
  console.log(`[backfill] userId=${userId}`);

  const templates = await db.taskTemplates
    .where('userId')
    .equals(userId)
    .and((t) => t.enabled)
    .toArray();
  console.log(`[backfill] 启用的模板数: ${templates.length}`);

  let totalBackfilled = 0;

  for (const template of templates) {
    const count = await backfillMissingInstancesForTemplate(db, template);
    if (count > 0) {
      totalBackfilled += count;
    }
    console.log(`[backfill] 模板 "${template.title}": 回填 ${count} 条`);
  }

  console.log(`[backfill] ====== 批量回填结束, 总计: ${totalBackfilled} 条 ======`);
  return totalBackfilled;
}

export function createTaskTemplateMiddleware() {
  return {
    register(db: DB) {
      db.taskTemplates.hook('creating', function (_primKey, obj, trans) {
        const template = obj as TaskTemplate;

        if (!template.enabled) {
          return;
        }

        this.onsuccess = (generatedId) => {
          const templateId = generatedId as string;

          if (processedTemplateIds.has(templateId)) {
            return;
          }

          processedTemplateIds.add(templateId);

          template.id = templateId as string;

          trans.on('complete', async () => {
            try {
              await checkAndGenerateForTemplate(db, template);
            } catch (error) {
              console.error('Failed to generate instance after creating template:', error);
              throw error;
            }
          });
        };
      });

      db.taskTemplates.hook('updating', function (mods, _primKey, obj, trans) {
        const updatedTemplate = { ...obj, ...mods } as TaskTemplate;
        
        if (!updatedTemplate.enabled) {
          return;
        }

        trans.on('complete', async () => {
          try {
            await checkAndGenerateForTemplate(db, updatedTemplate);
          } catch (error) {
            console.error('Failed to generate instance after updating template:', error);
            throw error;
          }
        });
      });
    },
  };
}