/**
 * 奖品积分/金额换算工具
 *
 * 商品按积分定价（pointsCost），积分货币比例（pointsPerYuan）表示每 ¥1 折合多少积分：
 *   金额(元) = 积分 / pointsPerYuan
 * 例如 吃饭 pointsPerYuan = 1（1 积分 = ¥1），香烟 pointsPerYuan = 2（2 积分 = ¥1）。
 */

/** 金额保留小数位 */
const MONEY_DECIMALS = 2;

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
 */
export function formatRatio(pointsPerYuan: number): string {
  return `1:${Number(normalizeRatio(pointsPerYuan).toFixed(2))}`;
}
