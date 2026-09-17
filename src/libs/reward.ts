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

/**
 * 金额展示：去掉多余的 0，如 ¥12 / ¥12.5 / ¥12.34
 */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '¥0';
  const rounded = Math.round(amount * MONEY_FACTOR) / MONEY_FACTOR;
  return `¥${Number(rounded.toFixed(MONEY_DECIMALS))}`;
}
