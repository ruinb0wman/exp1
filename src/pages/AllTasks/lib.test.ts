import { describe, expect, it } from "vitest";
import { levelBadgeClass } from "./lib";

describe("levelBadgeClass", () => {
  it("1/2/3 级各有自己的配色", () => {
    const classes = [1, 2, 3].map(levelBadgeClass);
    expect(new Set(classes).size).toBe(3);
    for (const cls of classes) {
      expect(cls).not.toBe("");
    }
  });

  it("4 级及以上走中性色", () => {
    expect(levelBadgeClass(4)).toBe(levelBadgeClass(99));
    expect(levelBadgeClass(4)).not.toBe(levelBadgeClass(3));
  });
});
