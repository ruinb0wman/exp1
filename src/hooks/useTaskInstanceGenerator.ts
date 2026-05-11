import { useState, useRef, useCallback } from 'react';
import type { TaskTemplate, TaskInstance } from '@/db/types';
import {
  getEnabledTaskTemplates,
  getAllTaskInstances,
  createTaskInstances,
} from '@/db/services';
import {
  filterTemplatesNeedingInstancesOnDate,
  generateTaskInstances,
  toUserDateString,
} from '@/libs/task';
import { useUserStore } from '@/store';

interface GenerateResult {
  generatedCount: number;
  generatedInstances: Omit<TaskInstance, 'id' | 'createdAt'>[];
}

interface UseTaskInstanceGeneratorOptions {
  userId: number | undefined;
  onGenerated?: (result: GenerateResult) => void;
  onError?: (error: Error) => void;
}

export function useTaskInstanceGenerator(options: UseTaskInstanceGeneratorOptions) {
  const { userId, onGenerated, onError } = options;
  const user = useUserStore(s => s.user);

  const [isGenerating, setIsGenerating] = useState(false);
  const hasGeneratedRef = useRef(false);

  const getTemplatesForDate = useCallback(async (
    date: Date = new Date()
  ): Promise<TaskTemplate[]> => {
    if (!userId) return [];

    const dayEndTime = user?.dayEndTime ?? "00:00";
    const templates = await getEnabledTaskTemplates(userId);
    const existingInstances = await getAllTaskInstances(userId);

    return filterTemplatesNeedingInstancesOnDate(templates, existingInstances, date, dayEndTime);
  }, [userId, user?.dayEndTime]);

  const shouldGenerateOnDate = useCallback(async (
    date: Date = new Date()
  ): Promise<boolean> => {
    const templates = await getTemplatesForDate(date);
    return templates.length > 0;
  }, [getTemplatesForDate]);

  const generateForDate = useCallback(async (
    date: Date = new Date(),
    options: { skipIfAlreadyGenerated?: boolean } = {}
  ): Promise<GenerateResult> => {
    const { skipIfAlreadyGenerated = true } = options;

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (skipIfAlreadyGenerated && hasGeneratedRef.current) {
      return { generatedCount: 0, generatedInstances: [] };
    }

    setIsGenerating(true);

    if (skipIfAlreadyGenerated) {
      hasGeneratedRef.current = true;
    }

    try {
      const templatesNeedingInstances = await getTemplatesForDate(date);

      let generatedInstances: Omit<TaskInstance, 'id' | 'createdAt'>[] = [];
      if (templatesNeedingInstances.length > 0) {
        const dayEndTime = user?.dayEndTime ?? "00:00";
        generatedInstances = generateTaskInstances(templatesNeedingInstances, date, dayEndTime);
        await createTaskInstances(generatedInstances);
      }

      const result: GenerateResult = {
        generatedCount: generatedInstances.length,
        generatedInstances,
      };

      onGenerated?.(result);
      return result;
    } catch (error) {
      if (skipIfAlreadyGenerated) {
        hasGeneratedRef.current = false;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [userId, user?.dayEndTime, getTemplatesForDate, onGenerated, onError]);

  /**
   * 生成今天的任务实例
   * 等同于 generateForDate(new Date())
   */
  const generateToday = useCallback(async (
    options: { skipIfAlreadyGenerated?: boolean } = {}
  ): Promise<GenerateResult> => {
    return generateForDate(new Date(), options);
  }, [generateForDate]);

  /**
   * 获取指定日期应该显示的实例/预览列表
   * 用于日历等需要显示某天任务列表的场景
   * @param date 目标日期
   * @returns 该日期应该显示的任务列表（包含已有实例和需要生成的预览）
   */
  const getDisplayTasksForDate = useCallback(async (
    date: Date
  ): Promise<Array<{ 
    template: TaskTemplate; 
    instance?: TaskInstance;
    isPreview: boolean;
  }>> => {
    if (!userId) return [];

    const dayEndTime = user?.dayEndTime ?? "00:00";

    const templates = await getEnabledTaskTemplates(userId);
    const allInstances = await getAllTaskInstances(userId);

    const userDateStr = toUserDateString(date, dayEndTime);

    const existingInstancesOnDate = allInstances.filter(inst => {
      if (!inst.instanceDate) return false;
      return inst.instanceDate === userDateStr;
    });

    const templateInstanceMap = new Map<string, TaskInstance>();
    existingInstancesOnDate.forEach(inst => {
      templateInstanceMap.set(inst.template.id!, inst);
    });

    const templatesNeedingInstances = filterTemplatesNeedingInstancesOnDate(
      templates,
      allInstances,
      date,
      dayEndTime
    );

    const result: Array<{ template: TaskTemplate; instance?: TaskInstance; isPreview: boolean }> = [];

    for (const [templateId, instance] of templateInstanceMap) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        result.push({ template, instance, isPreview: false });
      }
    }

    for (const template of templatesNeedingInstances) {
      if (!templateInstanceMap.has(template.id!)) {
        result.push({ template, isPreview: true });
      }
    }

    return result;
  }, [userId, user?.dayEndTime]);

  /**
   * 重置生成标记，允许再次生成
   */
  const resetGenerationFlag = useCallback(() => {
    hasGeneratedRef.current = false;
  }, []);

  return {
    /** 是否正在生成 */
    isGenerating,
    /** 是否已经生成过 */
    hasGenerated: hasGeneratedRef.current,
    /** 生成今天的实例 */
    generateToday,
    /** 生成指定日期的实例 */
    generateForDate,
    /** 获取指定日期需要生成的模板列表 */
    getTemplatesForDate,
    /** 检查指定日期是否需要生成 */
    shouldGenerateOnDate,
    /** 获取指定日期应该显示的任务列表（包含预览） */
    getDisplayTasksForDate,
    /** 重置生成标记 */
    resetGenerationFlag,
  };
}

export type { GenerateResult };
