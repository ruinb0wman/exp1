import { describe, expect, it } from "vitest";
import { moveTemplateOrder } from "./lib";

const ordered = ["a", "b", "c", "d"];

describe("moveTemplateOrder", () => {
  it("全量视图下与相邻项交换", () => {
    expect(moveTemplateOrder(ordered, ordered, "b", -1)).toEqual(["b", "a", "c", "d"]);
    expect(moveTemplateOrder(ordered, ordered, "b", 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("首项上移 / 末项下移返回 null", () => {
    expect(moveTemplateOrder(ordered, ordered, "a", -1)).toBeNull();
    expect(moveTemplateOrder(ordered, ordered, "d", 1)).toBeNull();
  });

  it("筛选视图下跳过被隐藏的模板（隐藏项相互顺序不变）", () => {
    // 只可见 a 和 d：d 上移 → 与 a 交换，b/c 保持相对位置
    expect(moveTemplateOrder(ordered, ["a", "d"], "d", -1)).toEqual(["d", "b", "c", "a"]);
    // a 下移 → 与 d 交换
    expect(moveTemplateOrder(ordered, ["a", "d"], "a", 1)).toEqual(["d", "b", "c", "a"]);
  });

  it("筛选视图下没有可见邻居时返回 null", () => {
    expect(moveTemplateOrder(ordered, ["a", "c"], "a", -1)).toBeNull();
    expect(moveTemplateOrder(ordered, ["a", "c"], "c", 1)).toBeNull();
  });

  it("id 不在全量列表 / 不在可见列表时返回 null", () => {
    expect(moveTemplateOrder(ordered, ordered, "zz", -1)).toBeNull();
    expect(moveTemplateOrder(ordered, ["a"], "b", -1)).toBeNull();
  });

  it("不改动入参数组", () => {
    const source = [...ordered];
    moveTemplateOrder(source, source, "b", 1);
    expect(source).toEqual(ordered);
  });

  it("交换后的完整顺序不含重复、不丢项", () => {
    const next = moveTemplateOrder(ordered, ["b", "d"], "d", -1);
    expect(next).not.toBeNull();
    expect([...next!].sort()).toEqual([...ordered].sort());
  });
});
