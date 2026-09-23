/**
 * 奖品计价工具
 *
 * 一个奖品有两个彼此独立的维度：
 *   pointsCost —— 单件所需积分（0 = 不花积分，如每日免费额度）
 *   moneyCost  —— 单件折合金额（元，0 = 不记金额）
 *
 * 一条消费记录的金额 = moneyCost × 数量（2 位小数）。两者不做任何换算：
 * 「0 积分但有金额」的奖品（吃饭 25 份/天 = ¥25）在这个模型下才有解。
 *
 * 「计入消费统计」开关（countInConsumption === false）关闭后不写金额、该奖品之后的
 * 购买也不计入消费统计。
 */

import type { RewardTemplate } from '@/db/types';

/** 金额保留小数位 */
const MONEY_DECIMALS = 2;

const MONEY_FACTOR = 10 ** MONEY_DECIMALS;

/**
 * 该奖品 / 该笔购买是否折合金额并计入消费统计
 *
 * 缺省（旧数据没有这个字段）视为计入。
 * 全仓库「是否计入」的判断只走这一个函数，不要另开真值来源。
 */
export function isCountedInConsumption(countInConsumption?: boolean): boolean {
  return countInConsumption !== false;
}

/** 单件金额是否合法：有限且非负（0 表示不记金额） */
export function isValidMoneyCost(moneyCost: number): boolean {
  return Number.isFinite(moneyCost) && moneyCost >= 0;
}

/**
 * 金额取整到 2 位小数（写入消费记录前统一走这里）
 */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * MONEY_FACTOR) / MONEY_FACTOR;
}

/** 兑换备注最大长度（与兑换弹层 textarea 的 maxLength 保持一致） */
export const MAX_PURCHASE_NOTE_LENGTH = 200;

/**
 * 归一化兑换备注：去首尾空白、超长截断
 *
 * 空串 / 纯空白 / 非字符串一律返回 undefined（= 未填），调用方据此决定是否写字段。
 * 内部换行保留（消费明细按多行展示），需要单行时由调用方自行压平。
 */
export function normalizePurchaseNote(note?: string): string | undefined {
  if (typeof note !== 'string') return undefined;
  const trimmed = note.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_PURCHASE_NOTE_LENGTH);
}

/**
 * 金额展示：去掉多余的 0，如 ¥12 / ¥12.5 / ¥12.34
 */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '¥0';
  const rounded = Math.round(amount * MONEY_FACTOR) / MONEY_FACTOR;
  return `¥${Number(rounded.toFixed(MONEY_DECIMALS))}`;
}

/** 非法/缺失 pointsCost（坏备份、手工构造对象）时排到最后 */
const MISSING_POINTS_COST = Number.MAX_SAFE_INTEGER;

function resolvePointsCost(template: RewardTemplate): number {
  const cost = template.pointsCost;
  return Number.isFinite(cost) ? cost : MISSING_POINTS_COST;
}

/**
 * 商品比较器：pointsCost 升序 → createdAt → id
 *
 * 0 积分的免费额度排在最前；后两级兜底保证同价商品也有稳定的全序
 * （与任务模板的 compareTemplateOrder 同一取舍）。
 */
export function compareRewardOrder(a: RewardTemplate, b: RewardTemplate): number {
  const byCost = resolvePointsCost(a) - resolvePointsCost(b);
  if (byCost !== 0) return byCost;

  const byCreatedAt = (a.createdAt || '').localeCompare(b.createdAt || '');
  if (byCreatedAt !== 0) return byCreatedAt;

  return String(a.id).localeCompare(String(b.id));
}

/** 按积分升序排序（返回副本，不改原数组） */
export function sortRewardTemplates<T extends RewardTemplate>(templates: T[]): T[] {
  return [...templates].sort(compareRewardOrder);
}
