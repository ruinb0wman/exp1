import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import NumberInput from "./NumberInput.vue";

interface HarnessProps {
	initial: number;
	min?: number;
	max?: number;
	allowDecimal?: boolean;
}

/** 受控外壳：模拟真实调用点（父组件持有 value） */
const Harness = defineComponent({
	props: {
		initial: { type: Number, required: true },
		min: { type: Number, default: 0 },
		max: { type: Number, default: Infinity },
		allowDecimal: { type: Boolean, default: false },
	},
	setup(props) {
		const value = ref(props.initial);
		return () =>
			h("div", [
				h(NumberInput, {
					modelValue: value.value,
					"onUpdate:modelValue": (next: number) => {
						value.value = next;
					},
					min: props.min,
					max: props.max,
					allowDecimal: props.allowDecimal,
				}),
				h("span", { "data-testid": "committed" }, String(value.value)),
			]);
	},
});

let wrapper: ReturnType<typeof mount> | null = null;

function render(props: HarnessProps) {
	wrapper = mount(Harness, { props });
}

function input(): HTMLInputElement {
	return wrapper!.find("input").element as HTMLInputElement;
}

/** 父组件当前持有的值（真正写回 state 的那个） */
function committed(): string {
	return wrapper!.find("[data-testid='committed']").text();
}

/** 模拟键入：改原生 value 再派发 input 事件 */
async function type(text: string) {
	const el = input();
	el.value = text;
	await wrapper!.find("input").trigger("input");
}

async function focus() {
	await wrapper!.find("input").trigger("focus");
}

async function blur() {
	await wrapper!.find("input").trigger("blur");
}

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

describe("NumberInput 聚焦时可删空", () => {
	it("聚焦后全删不会立刻被夹回 min，且能重新输入", async () => {
		render({ initial: 10, min: 1 });
		await focus();
		await type("");
		expect(input().value).toBe("");
		expect(committed()).toBe("10"); // 未失焦前不写回父组件

		await type("34");
		expect(input().value).toBe("34");
		expect(committed()).toBe("34");
	});

	it("从 10 改成 3 不需要绕开最后一位", async () => {
		render({ initial: 10, min: 1 });
		await focus();
		await type("");
		await type("3");
		await blur();
		expect(input().value).toBe("3");
		expect(committed()).toBe("3");
	});
});

describe("NumberInput 失焦兜底", () => {
	it("内容为空且 min = 0 → 0", async () => {
		render({ initial: 10, min: 0 });
		await focus();
		await type("");
		await blur();
		expect(input().value).toBe("0");
		expect(committed()).toBe("0");
	});

	it("内容为空且 0 < min → min", async () => {
		render({ initial: 10, min: 1 });
		await focus();
		await type("");
		await blur();
		expect(input().value).toBe("1");
		expect(committed()).toBe("1");
	});

	it("min = 5 时兜底 5", async () => {
		render({ initial: 8, min: 5 });
		await focus();
		await type("");
		await blur();
		expect(committed()).toBe("5");
	});
});

describe("NumberInput 输入期与归一", () => {
	it("超出 max 的文本保留，失焦后夹取", async () => {
		render({ initial: 1, min: 1, max: 10 });
		await focus();
		await type("15");
		expect(input().value).toBe("15");
		expect(committed()).toBe("10");

		await blur();
		expect(input().value).toBe("10");
		expect(committed()).toBe("10");
	});

	it("非法字符被忽略，保留原文本", async () => {
		render({ initial: 12 });
		await focus();
		await type("12a");
		expect(input().value).toBe("12");
		expect(committed()).toBe("12");
	});

	it("allowDecimal：可输入小数，单独的小数点失焦后兜底", async () => {
		render({ initial: 0, allowDecimal: true });
		await focus();
		await type("1.5");
		expect(committed()).toBe("1.5");

		await type("."); // 中间态：不写回
		expect(input().value).toBe(".");
		expect(committed()).toBe("1.5");

		await blur();
		expect(input().value).toBe("0");
		expect(committed()).toBe("0");
	});

	it("allowDecimal：1.999 归整为 2", async () => {
		render({ initial: 0, allowDecimal: true });
		await focus();
		await type("1.999");
		await blur();
		expect(input().value).toBe("2");
		expect(committed()).toBe("2");
	});

	it("+/- 按钮到达边界时禁用，清空后失焦再步进为先兜底再步进", async () => {
		render({ initial: 5, min: 0, max: 5 });
		const buttons = wrapper!.findAll("button");
		expect((buttons[1]!.element as HTMLButtonElement).disabled).toBe(true); // 加号在 max 处禁用

		await focus();
		await type("");
		await blur(); // 兜底为 0
		await buttons[1]!.trigger("click"); // 0 + 1
		expect(committed()).toBe("1");
		expect((buttons[0]!.element as HTMLButtonElement).disabled).toBe(false);
	});
});
