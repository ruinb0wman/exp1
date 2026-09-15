import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh.json";

/**
 * 统一 Header 使用的标题 / 标签键必须在 zh 与 en 中同时存在，
 * 否则切换语言时会出现 key 字面量泄漏。
 */
const HEADER_KEYS = [
  "common.back",
  "settings.title",
  "data.title",
  "profile.title",
  "store.title",
  "allTasks.title",
  "allTasks.taskHistory",
  "editTask.title",
  "editTask.createTitle",
  "editReward.title",
  "editReward.createTitle",
  "calendar.title",
  "replenishment.title",
  "consumption.title",
  "pointsHistory.title",
  "taskHistory.title",
  "achievement.title",
  "reports.page.title",
];

function resolve(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, segment) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[segment]
          : undefined,
      source
    );
}

describe("locales", () => {
  it.each(HEADER_KEYS)("%s 在 zh 与 en 中均已定义", (key) => {
    for (const [locale, source] of [
      ["zh", zh],
      ["en", en],
    ] as const) {
      const value = resolve(source, key);
      expect(typeof value, `${locale} 缺少 ${key}`).toBe("string");
      expect(value, `${locale} 的 ${key} 不应为空`).not.toBe("");
    }
  });
});
