import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { NumberInput } from "./NumberInput";

// React 18+ 在测试环境里使用 act 需要这个开关
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps {
	initial: number;
	min?: number;
	max?: number;
	allowDecimal?: boolean;
}

/** 受控外壳：模拟真实调用点（父组件持有 value） */
function Harness({ initial, min = 0, max = Infinity, allowDecimal = false }: HarnessProps) {
	const [value, setValue] = useState(initial);
	return (
		<>
			<NumberInput
				value={value}
				onChange={setValue}
				min={min}
				max={max}
				allowDecimal={allowDecimal}
			/>
			<span data-testid="committed">{value}</span>
		</>
	);
}

let container: HTMLDivElement;
let root: Root;

function render(props: HarnessProps) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root.render(<Harness {...props} />);
	});
}

function input(): HTMLInputElement {
	return container.querySelector("input") as HTMLInputElement;
}

/** 父组件当前持有的值（真正写回 state 的那个） */
function committed(): string {
	return container.querySelector("[data-testid='committed']")?.textContent ?? "";
}

/** 模拟键入：用原生 setter 绕过 React 的 value tracker，再派发 input 事件 */
function type(text: string) {
	const el = input();
	const setter = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	)?.set;
	act(() => {
		setter?.call(el, text);
		el.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

function focus() {
	act(() => {
		input().dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
	});
}

function blur() {
	act(() => {
		input().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
	});
}

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe("NumberInput 聚焦时可删空", () => {
	it("聚焦后全删不会立刻被夹回 min，且能重新输入", () => {
		render({ initial: 10, min: 1 });
		focus();
		type("");
		expect(input().value).toBe("");
		expect(committed()).toBe("10"); // 未失焦前不写回父组件

		type("34");
		expect(input().value).toBe("34");
		expect(committed()).toBe("34");
	});

	it("从 10 改成 3 不需要绕开最后一位", () => {
		render({ initial: 10, min: 1 });
		focus();
		type("");
		type("3");
		blur();
		expect(input().value).toBe("3");
		expect(committed()).toBe("3");
	});
});

describe("NumberInput 失焦兜底", () => {
	it("内容为空且 min = 0 → 0", () => {
		render({ initial: 10, min: 0 });
		focus();
		type("");
		blur();
		expect(input().value).toBe("0");
		expect(committed()).toBe("0");
	});

	it("内容为空且 0 < min → min", () => {
		render({ initial: 10, min: 1 });
		focus();
		type("");
		blur();
		expect(input().value).toBe("1");
		expect(committed()).toBe("1");
	});

	it("min = 5 时兜底 5", () => {
		render({ initial: 8, min: 5 });
		focus();
		type("");
		blur();
		expect(committed()).toBe("5");
	});
});

describe("NumberInput 输入期与归一", () => {
	it("超出 max 的文本保留，失焦后夹取", () => {
		render({ initial: 1, min: 1, max: 10 });
		focus();
		type("15");
		expect(input().value).toBe("15");
		expect(committed()).toBe("10");

		blur();
		expect(input().value).toBe("10");
		expect(committed()).toBe("10");
	});

	it("非法字符被忽略，保留原文本", () => {
		render({ initial: 12 });
		focus();
		type("12a");
		expect(input().value).toBe("12");
		expect(committed()).toBe("12");
	});

	it("allowDecimal：可输入小数，单独的小数点失焦后兜底", () => {
		render({ initial: 0, allowDecimal: true });
		focus();
		type("1.5");
		expect(committed()).toBe("1.5");

		type("."); // 中间态：不写回
		expect(input().value).toBe(".");
		expect(committed()).toBe("1.5");

		blur();
		expect(input().value).toBe("0");
		expect(committed()).toBe("0");
	});

	it("allowDecimal：1.999 归整为 2", () => {
		render({ initial: 0, allowDecimal: true });
		focus();
		type("1.999");
		blur();
		expect(input().value).toBe("2");
		expect(committed()).toBe("2");
	});

	it("+/- 按钮到达边界时禁用，清空后失焦再步进为先兜底再步进", () => {
		render({ initial: 5, min: 0, max: 5 });
		const buttons = container.querySelectorAll("button");
		expect((buttons[1] as HTMLButtonElement).disabled).toBe(true); // 加号在 max 处禁用

		focus();
		type("");
		blur(); // 兜底为 0
		act(() => {
			(buttons[1] as HTMLButtonElement).click(); // 0 + 1
		});
		expect(committed()).toBe("1");
		expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
	});
});
