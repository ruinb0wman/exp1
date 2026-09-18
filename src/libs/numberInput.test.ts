import { describe, expect, it } from "vitest";
import {
	applyBounds,
	isTextAllowed,
	resolveBlurValue,
	roundTo,
	textToNumber,
	valueToText,
} from "./numberInput";

describe("isTextAllowed", () => {
	it("数字模式下拒绝小数点、字母与符合并号", () => {
		expect(isTextAllowed("12", false, false)).toBe(true);
		expect(isTextAllowed("1.2", false, false)).toBe(false);
		expect(isTextAllowed("12a", false, false)).toBe(false);
		expect(isTextAllowed("1e3", false, false)).toBe(false);
	});

	it("小数模式放行小数点与中间态", () => {
		expect(isTextAllowed("1.25", true, false)).toBe(true);
		expect(isTextAllowed(".", true, false)).toBe(true);
		expect(isTextAllowed("1.", true, false)).toBe(true);
		expect(isTextAllowed("1.2.3", true, false)).toBe(false);
	});

	it("负数仅在该字段允许时放行", () => {
		expect(isTextAllowed("-5", false, true)).toBe(true);
		expect(isTextAllowed("-", false, true)).toBe(true);
		expect(isTextAllowed("-5", false, false)).toBe(false);
		expect(isTextAllowed("-", false, false)).toBe(false);
	});

	it("空串始终可接受（聚焦时可删空）", () => {
		expect(isTextAllowed("", false, false)).toBe(true);
		expect(isTextAllowed("", true, true)).toBe(true);
	});
});

describe("textToNumber", () => {
	it("空串与中间态返回 null（不写回父组件）", () => {
		expect(textToNumber("", false)).toBeNull();
		expect(textToNumber("-", false)).toBeNull();
		expect(textToNumber(".", true)).toBeNull();
		expect(textToNumber("-.", true)).toBeNull();
	});

	it("可解析文本返回数字", () => {
		expect(textToNumber("12", false)).toBe(12);
		expect(textToNumber("1.", true)).toBe(1);
		expect(textToNumber("1.25", true)).toBe(1.25);
	});
});

describe("applyBounds", () => {
	it("夹到 [min, max]", () => {
		expect(applyBounds(99, 0, 10, false)).toBe(10);
		expect(applyBounds(-3, 1, 10, false)).toBe(1);
		expect(applyBounds(5, 0, 10, false)).toBe(5);
	});

	it("小数模式按 2 位归整（先夹后归整）", () => {
		expect(applyBounds(1.999, 0, Number.POSITIVE_INFINITY, true)).toBe(2);
		expect(applyBounds(1.234, 0, Number.POSITIVE_INFINITY, true)).toBe(1.23);
		expect(applyBounds(9.99, 0, 2, true)).toBe(2);
	});
});

describe("resolveBlurValue（失焦兜底）", () => {
	it("空内容：min = 0 时兜底 0", () => {
		expect(resolveBlurValue("", 0, Number.POSITIVE_INFINITY, false)).toBe(0);
		expect(resolveBlurValue("", 0, 10, false)).toBe(0);
	});

	it("空内容：0 < min 时兜底 min", () => {
		expect(resolveBlurValue("", 1, Number.POSITIVE_INFINITY, false)).toBe(1);
		expect(resolveBlurValue("", 5, Number.POSITIVE_INFINITY, false)).toBe(5);
		expect(resolveBlurValue("", 2, 3, true)).toBe(2);
	});

	it("中间态（小数模式下只剩小数点）同样兜底", () => {
		expect(resolveBlurValue(".", 0, Number.POSITIVE_INFINITY, true)).toBe(0);
		expect(resolveBlurValue("-", 1, Number.POSITIVE_INFINITY, false)).toBe(1);
	});

	it("正常值不被兜底覆盖", () => {
		expect(resolveBlurValue("2", 1, Number.POSITIVE_INFINITY, false)).toBe(2);
		expect(resolveBlurValue("1.999", 0, Number.POSITIVE_INFINITY, true)).toBe(2);
		expect(resolveBlurValue("999", 0, 10, false)).toBe(10);
	});
});

describe("valueToText", () => {
	it("数字转文本", () => {
		expect(valueToText(0)).toBe("0");
		expect(valueToText(1.5)).toBe("1.5");
		expect(valueToText(120)).toBe("120");
	});

	it("非有限值回退空串", () => {
		expect(valueToText(Number.NaN)).toBe("");
		expect(valueToText(Number.POSITIVE_INFINITY)).toBe("");
	});
});

describe("roundTo", () => {
	it("默认保留 2 位", () => {
		expect(roundTo(1.234)).toBe(1.23);
		expect(roundTo(1.239)).toBe(1.24);
		expect(roundTo(1.234, 1)).toBe(1.2);
	});
});
