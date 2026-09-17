/**
 * 奖品积分/金额换算工具
 *
 * 商品按积分定价（pointsCost），积分货币比例（pointsPerYuan）表示每 ¥1 折合多少积分：
 *   金额(元) = 积分 / pointsPerYuan
 * 例如 吃饭 pointsPerYuan = 1（1 积分 = ¥1），香烟 pointsPerYuan = 2（2 积分 = ¥1）。
 *
 * 比例可以关闭（countInConsumption === false）：关闭后不折合金额，该奖品之后的购买
 * 也不计入消费统计。
 */

/** 金额保留小数位 */
const MONEY_DECIMALS = 2;

/**
 * 该奖品 / 该笔购买是否折合金额并计入消费统计
 *
 * 缺省（v7 之前写入的旧数据没有这个字段）视为计入。
 * 全仓库「是否计入」的判断只走这一个函数，不要另开真值来源。
 */
export function isCountedInConsumption(countInConsumption?: boolean): boolean {
  return countInConsumption !== false;
}

/** 比例是否合法：有限正数 */
export function isValidRatio(pointsPerYuan: number): boolean {
  return Number.isFinite(pointsPerYuan) && pointsPerYuan > 0;
}

/**
 * 取用于换算的可用比例，非法值兜底为 1，避免除零
 */
export function normalizeRatio(pointsPerYuan: number | undefined): number {
  return isValidRatio(pointsPerYuan as number) ? (pointsPerYuan as number) : 1;
}

/**
 * 积分 → 金额（元），保留 2 位小数
 */
export function pointsToMoney(points: number, pointsPerYuan: number): number {
  const ratio = normalizeRatio(pointsPerYuan);
  if (!Number.isFinite(points)) return 0;
  const factor = 10 ** MONEY_DECIMALS;
  return Math.round((points / ratio) * factor) / factor;
}

/**
 * 金额展示：去掉多余的 0，如 ¥12 / ¥12.5 / ¥12.34
 */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '¥0';
  const rounded = Math.round(amount * 10 ** MONEY_DECIMALS) / 10 ** MONEY_DECIMALS;
  return `¥${Number(rounded.toFixed(MONEY_DECIMALS))}`;
}

/**
 * 比例展示，如 1:2（1 积分 = ¥0.5）时返回 "1:2"
 * 注意：调用前需自行确认该奖品「计入消费统计」（isCountedInConsumption）
 */
export function formatRatio(pointsPerYuan: number): string {
  return `1:${Number(normalizeRatio(pointsPerYuan).toFixed(2))}`;
}
