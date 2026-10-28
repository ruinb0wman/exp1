import { describe, it, expect, beforeEach } from "vitest";
import { getDB } from "@/db";
import type { TaskInstance, TaskStatus, TaskTemplate } from "@/db/types";
import { addUserDays, getUserCurrentDate } from "@/libs/time";
import { getPendingEarlierTaskInstances } from "./query";

const db = getDB();
const TODAY = getUserCurrentDate("00:00");
const YESTERDAY = addUserDays(TODAY, -1);
const TWO_DAYS_AGO = addUserDays(TODAY, -2);

function makeTemplate(id: string, expireDays?: number): TaskTemplate {
  return {
    id,
    userId: 1,
    title: `Template ${id}`,
    repeatMode: "daily",
    repeatInterval: 1,
    endCondition: "manual",
    enabled: true,
    level: 1,
    subtasks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    completeExpireDays: expireDays,
  } as unknown as TaskTemplate;
}

function makeInstance(
  id: string,
  template: TaskTemplate,
  instanceDate: string,
  status: TaskStatus = "pending",
): TaskInstance {
  return {
    id,
    userId: 1,
    templateId: template.id,
    template,
    status,
    subtasks: [],
    instanceDate,
    createdAt: "2026-01-01T00:00:00.000Z",
    completedStages: [],
    stagePointsEarned: 0,
    completionPointsEarned: 0,
    completedSubtasks: [],
    isFullyCompleted: false,
  } as unknown as TaskInstance;
}

describe("getPendingEarlierTaskInstances", () => {
  beforeEach(async () => {
    await db.taskInstances.clear();
    await db.taskTemplates.clear();
  });

  it("只返回非今日、pending、且仍在补做窗口内的实例", async () => {
    const inWindow = makeTemplate("tpl-in-window", 5);
    const expired = makeTemplate("tpl-expired", 1);
    const noExpire = makeTemplate("tpl-no-expire", undefined);

    await db.taskInstances.bulkAdd([
      // 昨天 pending，窗口 5 天 → 应出现
      makeInstance("yesterday-in-window", inWindow, YESTERDAY),
      // 昨天 pending，窗口 1 天（当天结束即过期）→ 不出现
      makeInstance("yesterday-expired", expired, YESTERDAY),
      // 今天 pending → 不出现（今日列表负责）
      makeInstance("today", inWindow, TODAY),
      // 昨天 pending，但模板没有补做窗口 → 不出现（永不过期，会无限堆积）
      makeInstance("yesterday-no-expire", noExpire, YESTERDAY),
      // 昨天已完成 → 不出现
      makeInstance("yesterday-completed", inWindow, YESTERDAY, "completed"),
      // 无日期 pending → 不出现（无日期专区负责）
      makeInstance("no-date", inWindow, ""),
      // 前天 pending，窗口 5 天 → 应出现
      makeInstance("two-days-ago-in-window", inWindow, TWO_DAYS_AGO),
    ]);

    const result = await getPendingEarlierTaskInstances(1, "00:00");

    expect(result.map(({ instance }) => instance.id).sort()).toEqual([
      "two-days-ago-in-window",
      "yesterday-in-window",
    ]);
  });
});
