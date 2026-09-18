/** 小数模式下保留的位数 */
export const DECIMAL_PLACES = 2;

export function roundTo(value: number, places: number = DECIMAL_PLACES): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** 数字 → 输入框文本；非有限值（NaN/Infinity）回退空串 */
export function valueToText(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

/** 该文本是否可接受（拒绝非法字符；放行 ""、"-"、"1." 这类中间态） */
export function isTextAllowed(
  text: string,
  allowDecimal: boolean,
  allowNegative: boolean,
): boolean {
  if (text === "") return true;
  const pattern = allowDecimal
    ? allowNegative
      ? /^-\d*\.?\d*$/
      : /^\d*\.?\d*$/
    : allowNegative
      ? /^-\d*$/
      : /^\d*$/;
  return pattern.test(text);
}

/** 文本 → 数字；"" / "-" / "." / "-." 这类中间态返回 null（此时不写回父组件） */
export function textToNumber(text: string, allowDecimal: boolean): number | null {
  if (text === "" || text === "-" || text === "." || text === "-.") return null;
  const num = allowDecimal ? parseFloat(text) : parseInt(text, 10);
  return Number.isFinite(num) ? num : null;
}

/** 夹到 [min, max]；小数模式再按 2 位归整 */
export function applyBounds(
  value: number,
  min: number,
  max: number,
  allowDecimal: boolean,
): number {
  const clamped = Math.min(max, Math.max(min, value));
  return allowDecimal ? roundTo(clamped, DECIMAL_PLACES) : clamped;
}

/**
 * 失焦兜底：能解析就用解析值，空/中间态用 0。
 * clamp(0, min, max) 天然等于「0 < min 时取 min」，因此无需额外分支。
 */
export function resolveBlurValue(
  text: string,
  min: number,
  max: number,
  allowDecimal: boolean,
): number {
  const parsed = textToNumber(text, allowDecimal);
  return applyBounds(parsed ?? 0, min, max, allowDecimal);
}
