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
  formatLocalDate,
} from '@/libs/task';

interface GenerateResult {
  generatedCount: number;
  generatedInstances: Omit<TaskInstance, 'id' | 'createAt'>[];
}

interface UseTaskInstanceGeneratorOptions {
  /** 用户ID */
  userId: number | undefined;
  /** 生成完成后回调 */
  onGenerated?: (result: GenerateResult) => void;
  /** 生成失败回调 */
  onError?: (error: Error) => void;
}

/**
 * Task 实例生成器 Hook
 * 
 * 封装了检查是否需要生成实例以及生成实例的完整逻辑
 * 用于 Home 页面和 Stats 页面等需要生成或预览实例的地方
 */
export function useTaskInstanceGenerator(options: UseTaskInstanceGeneratorOptions) {
  const { userId, onGenerated, onError } = options;
  
  const [isGenerating, setIsGenerating] = useState(false);
  const hasGeneratedRef = useRef(false);

  /**
   * 获取指定日期需要生成实例的模板列表（预览用）
   * @param date 目标日期，默认为今天
   * @returns 需要生成实例的模板列表
   */
  const getTemplatesForDate = useCallback(async (
    date: Date = new Date()
  ): Promise<TaskTemplate[]> => {
    if (!userId) return [];

    const templates = await getEnabledTaskTemplates(userId);
    const existingInstances = await getAllTaskInstances(userId);
    
    return filterTemplatesNeedingInstancesOnDate(templates, existingInstances, date);
  }, [userId]);

  /**
   * 检查指定日期是否需要生成实例
   * @param date 目标日期，默认为今天
   * @returns 是否需要生成实例
   */
  const shouldGenerateOnDate = useCallback(async (
    date: Date = new Date()
  ): Promise<boolean> => {
    const templates = await getTemplatesForDate(date);
    return templates.length > 0;
  }, [getTemplatesForDate]);

  /**
   * 生成指定日期的任务实例并保存到数据库
   * @param date 目标日期，默认为今天
   * @param options 生成选项
   * @returns 生成结果
   */
  const generateForDate = useCallback(async (
    date: Date = new Date(),
    options: { skipIfAlreadyGenerated?: boolean } = {}
  ): Promise<GenerateResult> => {
    const { skipIfAlreadyGenerated = true } = options;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // 如果已经生成过且需要跳过，直接返回
    if (skipIfAlreadyGenerated && hasGeneratedRef.current) {
      return { generatedCount: 0, generatedInstances: [] };
    }

    setIsGenerating(true);
    
    // 立即标记已生成，防止 React StrictMode 导致的重复执行
    if (skipIfAlreadyGenerated) {
      hasGeneratedRef.current = true;
    }

    try {
      // 获取需要生成实例的模板
      const templatesNeedingInstances = await getTemplatesForDate(date);

      // 生成并保存新的任务实例
      let generatedInstances: Omit<TaskInstance, 'id' | 'createAt'>[] = [];
      if (templatesNeedingInstances.length > 0) {
        generatedInstances = generateTaskInstances(templatesNeedingInstances, date);
        await createTaskInstances(generatedInstances);
      }

      const result: GenerateResult = {
        generatedCount: generatedInstances.length,
        generatedInstances,
      };

      onGenerated?.(result);
      return result;
    } catch (error) {
      // 出错时重置标记，允许下次重试
      if (skipIfAlreadyGenerated) {
        hasGeneratedRef.current = false;
      }
      
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [userId, getTemplatesForDate, onGenerated, onError]);

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

    // 获取所有启用的模板
    const templates = await getEnabledTaskTemplates(userId);
    const allInstances = await getAllTaskInstances(userId);

    // 获取该日期已有的实例
    const dateStr = formatLocalDate(date);
    const existingInstancesOnDate = allInstances.filter(inst => {
      if (!inst.startAt) return false;
      const instDateStr = formatLocalDate(new Date(inst.startAt));
      return instDateStr === dateStr;
    });

    // 构建 template -> instance 的映射
    const templateInstanceMap = new Map<number, TaskInstance>();
    existingInstancesOnDate.forEach(inst => {
      templateInstanceMap.set(inst.templateId, inst);
    });

    // 获取应该在该日期生成实例的模板
    const templatesNeedingInstances = filterTemplatesNeedingInstancesOnDate(
      templates,
      allInstances,
      date
    );

    const result: Array<{ template: TaskTemplate; instance?: TaskInstance; isPreview: boolean }> = [];

    // 添加已有实例的模板
    for (const [templateId, instance] of templateInstanceMap) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        result.push({ template, instance, isPreview: false });
      }
    }

    // 添加需要生成但还没有实例的模板（预览模式）
    for (const template of templatesNeedingInstances) {
      if (!templateInstanceMap.has(template.id!)) {
        result.push({ template, isPreview: true });
      }
    }

    return result;
  }, [userId]);

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
