import { describe, it, expect } from "vitest";
import type { TaskTemplate, TaskInstance } from "@/db/types";
import {
  generateTaskInstance,
  generateTaskInstances,
  shouldGenerateInstanceOnDate,
  filterTemplatesNeedingInstancesOnDate,
  toUserDateString,
} from "@/libs/task";

function createTemplate(overrides?: Partial<TaskTemplate>): TaskTemplate {
  return {
    id: "tmpl-1",
    userId: 1,
    title: "Test Task",
    repeatMode: "daily",
    repeatInterval: 1,
    repeatDaysOfWeek: undefined,
    repeatDaysOfMonth: undefined,
    endCondition: "manual",
    endValue: undefined,
    enabled: true,
    subtasks: [],
    createdAt: "2026-05-01T00:00:00.000Z",
    startAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function createInstance(overrides?: Partial<TaskInstance>): TaskInstance {
  const template = createTemplate();
  return {
    id: "inst-1",
    userId: 1,
    templateId: "tmpl-1",
    template,
    status: "pending",
    subtasks: [],
    instanceDate: "2026-05-11",
    createdAt: "2026-05-11T00:00:00.000Z",
    ...overrides,
  };
}

// ============================================================
// toUserDateString
// ============================================================
describe("toUserDateString", () => {
  it("returns same day when local time is after dayEndTime", () => {
    const date = new Date(2026, 4, 11, 12, 0);
    expect(toUserDateString(date, "00:00")).toBe("2026-05-11");
    expect(toUserDateString(date, "02:00")).toBe("2026-05-11");
    expect(toUserDateString(date, "10:00")).toBe("2026-05-11");
  });

  it("returns previous day when local time is before dayEndTime", () => {
    const date = new Date(2026, 4, 11, 1, 30);
    expect(toUserDateString(date, "00:00")).toBe("2026-05-11");
    expect(toUserDateString(date, "02:00")).toBe("2026-05-10");
  });

  it("handles boundary at exact dayEndTime hour (not less => same day)", () => {
    const date = new Date(2026, 4, 11, 2, 0);
    expect(toUserDateString(date, "02:00")).toBe("2026-05-11");
  });

  it("handles boundary one minute before dayEndTime", () => {
    const date = new Date(2026, 4, 11, 1, 59);
    expect(toUserDateString(date, "02:00")).toBe("2026-05-10");
  });

  it("works with string input (ISO UTC)", () => {
    const result = toUserDateString("2026-05-11T12:00:00.000Z", "00:00");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("defaults to 00:00 behavior for midnight boundary", () => {
    const date = new Date(2026, 4, 11, 0, 0);
    expect(toUserDateString(date, "00:00")).toBe("2026-05-11");
  });
});

// ============================================================
// generateTaskInstance
// ============================================================
describe("generateTaskInstance", () => {
  it("stores instanceDate as toUserDateString when dayEndTime is provided", () => {
    const template = createTemplate({ repeatMode: "daily" });
    const date = new Date(2026, 4, 11, 12, 0);
    const result = generateTaskInstance(template, date, "00:00");
    expect(result.instanceDate).toBe("2026-05-11");
  });

  it("adjusts instanceDate when dayEndTime shifts to previous day", () => {
    const template = createTemplate({ repeatMode: "daily" });
    const date = new Date(2026, 4, 11, 1, 30);
    const result = generateTaskInstance(template, date, "02:00");
    expect(result.instanceDate).toBe("2026-05-10");
  });

  it("uses formatLocalDate when dayEndTime is not provided", () => {
    const template = createTemplate({ repeatMode: "daily" });
    const date = new Date(2026, 4, 11, 12, 0);
    const result = generateTaskInstance(template, date);
    expect(result.instanceDate).toBe("2026-05-11");
  });

  it("uses startAt date for repeatMode=none with startAt", () => {
    const template = createTemplate({
      repeatMode: "none",
      startAt: "2026-05-15T10:00:00.000Z",
    });
    const result = generateTaskInstance(template);
    expect(result.instanceDate).toBe("2026-05-15");
  });

  it("falls back to Date.now() for repeatMode=none without startAt", () => {
    const template = createTemplate({
      repeatMode: "none",
      startAt: undefined,
    });
    const result = generateTaskInstance(template, undefined, "00:00");
    expect(result.instanceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("preserves all other instance fields unchanged", () => {
    const template = createTemplate({ repeatMode: "daily" });
    const date = new Date(2026, 4, 11, 12, 0);

    const result = generateTaskInstance(template, date, "02:00");

    expect(result.userId).toBe(template.userId);
    expect(result.templateId).toBe(template.id);
    expect(result.status).toBe("pending");
    expect(result.template).toEqual(template);
    expect(result.subtasks).toEqual([]);
    expect(result.completedStages).toEqual([]);
    expect(result.isFullyCompleted).toBe(false);
  });
});

// ============================================================
// generateTaskInstances
// ============================================================
describe("generateTaskInstances", () => {
  it("generates instances with dayEndTime passed through", () => {
    const templates = [
      createTemplate({ id: "tmpl-a", repeatMode: "daily" }),
      createTemplate({ id: "tmpl-b", repeatMode: "daily" }),
    ];
    const date = new Date(2026, 4, 11, 1, 30);
    const results = generateTaskInstances(templates, date, "02:00");

    expect(results).toHaveLength(2);
    results.forEach((inst) => {
      expect(inst.instanceDate).toBe("2026-05-10");
    });
  });

  it("generates instances without dayEndTime uses default", () => {
    const templates = [
      createTemplate({ id: "tmpl-a", repeatMode: "daily" }),
    ];
    const date = new Date(2026, 4, 11, 12, 0);
    const results = generateTaskInstances(templates, date);

    expect(results).toHaveLength(1);
    expect(results[0].instanceDate).toBe("2026-05-11");
  });
});

// ============================================================
// shouldGenerateInstanceOnDate
// ============================================================
describe("shouldGenerateInstanceOnDate", () => {
  describe("repeatMode='none'", () => {
    it("returns true when no instances exist", () => {
      const template = createTemplate({ repeatMode: "none" });
      expect(shouldGenerateInstanceOnDate(template, [])).toBe(true);
    });

    it("returns false when instances already exist", () => {
      const template = createTemplate({ repeatMode: "none" });
      const instances = [createInstance()];
      expect(shouldGenerateInstanceOnDate(template, instances)).toBe(false);
    });
  });

  describe("repeatMode='daily'", () => {
    it("generates on matching interval days (interval=1)", () => {
      const template = createTemplate({
        repeatMode: "daily",
        repeatInterval: 1,
        startAt: "2026-05-01T00:00:00.000Z",
      });
      const day1 = new Date(Date.UTC(2026, 4, 1));
      const day2 = new Date(Date.UTC(2026, 4, 2));
      const day3 = new Date(Date.UTC(2026, 4, 3));

      expect(shouldGenerateInstanceOnDate(template, [], day1)).toBe(true);
      expect(shouldGenerateInstanceOnDate(template, [], day2)).toBe(true);
      expect(shouldGenerateInstanceOnDate(template, [], day3)).toBe(true);
    });

    it("skips when instance already exists on same user date", () => {
      const template = createTemplate({
        repeatMode: "daily",
        repeatInterval: 1,
        startAt: "2026-05-01T00:00:00.000Z",
      });
      const targetDate = new Date(Date.UTC(2026, 4, 11));
      const existing = createInstance({ instanceDate: "2026-05-11" });
      expect(shouldGenerateInstanceOnDate(template, [existing], targetDate)).toBe(false);
    });

    it("skips non-matching interval days (interval=2)", () => {
      const template = createTemplate({
        repeatMode: "daily",
        repeatInterval: 2,
        startAt: "2026-05-01T00:00:00.000Z",
      });
      const day1 = new Date(Date.UTC(2026, 4, 1));
      const day2 = new Date(Date.UTC(2026, 4, 2));
      const day3 = new Date(Date.UTC(2026, 4, 3));

      expect(shouldGenerateInstanceOnDate(template, [], day1)).toBe(true);
      expect(shouldGenerateInstanceOnDate(template, [], day2)).toBe(false);
      expect(shouldGenerateInstanceOnDate(template, [], day3)).toBe(true);
    });

    it("returns false when targetDate is before startAt", () => {
      const template = createTemplate({
        repeatMode: "daily",
        startAt: "2026-05-05T00:00:00.000Z",
      });
      const before = new Date(Date.UTC(2026, 4, 3));
      expect(shouldGenerateInstanceOnDate(template, [], before)).toBe(false);
    });
  });

  describe("repeatMode='weekly'", () => {
    it("generates on specified days of the week", () => {
      const template = createTemplate({
        repeatMode: "weekly",
        repeatInterval: 1,
        repeatDaysOfWeek: [1, 3, 5],
        startAt: "2026-05-01T00:00:00.000Z",
      });

      const monday = new Date(Date.UTC(2026, 4, 11));
      const tuesday = new Date(Date.UTC(2026, 4, 12));
      const wednesday = new Date(Date.UTC(2026, 4, 13));

      expect(shouldGenerateInstanceOnDate(template, [], monday)).toBe(true);
      expect(shouldGenerateInstanceOnDate(template, [], tuesday)).toBe(false);
      expect(shouldGenerateInstanceOnDate(template, [], wednesday)).toBe(true);
    });

    it("skips when day of week is not in repeatDaysOfWeek", () => {
      const template = createTemplate({
        repeatMode: "weekly",
        repeatDaysOfWeek: [0],
        startAt: "2026-05-01T00:00:00.000Z",
      });
      const monday = new Date(Date.UTC(2026, 4, 11));
      expect(shouldGenerateInstanceOnDate(template, [], monday)).toBe(false);
    });
  });

  describe("repeatMode='monthly'", () => {
    it("generates on specified days of the month", () => {
      const template = createTemplate({
        repeatMode: "monthly",
        repeatInterval: 1,
        repeatDaysOfMonth: [1, 15],
        startAt: "2026-05-01T00:00:00.000Z",
      });
      const day1 = new Date(Date.UTC(2026, 4, 1));
      const day10 = new Date(Date.UTC(2026, 4, 10));
      const day15 = new Date(Date.UTC(2026, 4, 15));

      expect(shouldGenerateInstanceOnDate(template, [], day1)).toBe(true);
      expect(shouldGenerateInstanceOnDate(template, [], day10)).toBe(false);
      expect(shouldGenerateInstanceOnDate(template, [], day15)).toBe(true);
    });

    it("generates on interval months", () => {
      const template = createTemplate({
        repeatMode: "monthly",
        repeatInterval: 2,
        repeatDaysOfMonth: [1],
        startAt: "2026-04-01T00:00:00.000Z",
      });
      const april = new Date(Date.UTC(2026, 3, 1));
      const may = new Date(Date.UTC(2026, 4, 1));
      const june = new Date(Date.UTC(2026, 5, 1));

      expect(shouldGenerateInstanceOnDate(template, [], april)).toBe(true);
      expect(shouldGenerateInstanceOnDate(template, [], may)).toBe(false);
      expect(shouldGenerateInstanceOnDate(template, [], june)).toBe(true);
    });
  });

  describe("hasInstanceOnDate with dayEndTime", () => {
    it("matches existing instance when dayEndTime shifts date", () => {
      const template = createTemplate({
        repeatMode: "daily",
        repeatInterval: 1,
        startAt: "2026-05-01T00:00:00.000Z",
      });

      const date = new Date(2026, 4, 11, 1, 30);
      const existing = createInstance({ instanceDate: "2026-05-10" });

      const result = shouldGenerateInstanceOnDate(template, [existing], date, "02:00");
      expect(result).toBe(false);
    });

    it("does not match when dayEndTime keeps same date", () => {
      const template = createTemplate({
        repeatMode: "daily",
        repeatInterval: 1,
        startAt: "2026-05-01T00:00:00.000Z",
      });

      const date = new Date(2026, 4, 11, 1, 30);
      const existing = createInstance({ instanceDate: "2026-05-10" });

      const result = shouldGenerateInstanceOnDate(template, [existing], date, "00:00");
      expect(result).toBe(true);
    });
  });

  describe("startAt edge cases", () => {
    it("returns false when startAt is missing for periodic tasks", () => {
      const tpl = createTemplate({
        repeatMode: "daily",
        startAt: undefined,
      });
      expect(shouldGenerateInstanceOnDate(tpl, [])).toBe(false);
    });

    it("returns false for unknown repeatMode", () => {
      const tpl = createTemplate({
        repeatMode: "monthly" as any,
        startAt: "2026-05-01T00:00:00.000Z",
      });
      expect(shouldGenerateInstanceOnDate(tpl, [])).toBe(false);
    });
  });
});

// ============================================================
// filterTemplatesNeedingInstancesOnDate
// ============================================================
describe("filterTemplatesNeedingInstancesOnDate", () => {
  it("filters out disabled templates", () => {
    const enabled = createTemplate({ id: "a", enabled: true });
    const disabled = createTemplate({ id: "b", enabled: false });
    const result = filterTemplatesNeedingInstancesOnDate(
      [enabled, disabled],
      [],
      new Date(Date.UTC(2026, 4, 1)),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("filters out templates that have reached end condition (times)", () => {
    const template = createTemplate({
      id: "a",
      endCondition: "times",
      endValue: "3",
    });
    const instances = [
      createInstance({ id: "i1", templateId: "a" }),
      createInstance({ id: "i2", templateId: "a" }),
      createInstance({ id: "i3", templateId: "a" }),
    ];
    const result = filterTemplatesNeedingInstancesOnDate(
      [template],
      instances,
      new Date(Date.UTC(2026, 4, 11)),
    );
    expect(result).toHaveLength(0);
  });

  it("keeps templates that need instances", () => {
    const template = createTemplate({
      id: "a",
      repeatMode: "daily",
      startAt: "2026-05-01T00:00:00.000Z",
    });
    const result = filterTemplatesNeedingInstancesOnDate(
      [template],
      [],
      new Date(Date.UTC(2026, 4, 11)),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("filters out templates with existing instance on the target user date", () => {
    const template = createTemplate({
      id: "a",
      repeatMode: "daily",
      startAt: "2026-05-01T00:00:00.000Z",
    });
    const targetDate = new Date(Date.UTC(2026, 4, 11));
    const existing = createInstance({
      templateId: "a",
      instanceDate: "2026-05-11",
    });
    const result = filterTemplatesNeedingInstancesOnDate(
      [template],
      [existing],
      targetDate,
    );
    expect(result).toHaveLength(0);
  });

  it("warns and filters out periodic templates without startAt", () => {
    const template = createTemplate({
      id: "a",
      repeatMode: "daily",
      startAt: undefined,
    });
    const result = filterTemplatesNeedingInstancesOnDate(
      [template],
      [],
      new Date(Date.UTC(2026, 4, 11)),
    );
    expect(result).toHaveLength(0);
  });
});
