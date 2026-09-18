import { beforeEach, describe, expect, it } from "vitest";
import { getDB } from "../../index";
import type { TaskTemplate } from "../../types";
import {
  createTaskTemplate,
  getAllTaskTemplates,
  reorderTaskTemplates,
} from "./template";

const db = getDB();

/**
 * 用 enabled: false 构造模板：既不触发 taskTemplateMiddleware 的
 * 「创建后生成实例」逻辑，也不影响排序断言。
 */
function newTemplate(
  userId: number,
  title: string
): Omit<TaskTemplate, "id" | "createdAt" | "updatedAt" | "sortOrder"> {
  return {
    userId,
    title,
    repeatMode: "daily",
    endCondition: "manual",
    enabled: false,
    subtasks: [],
    completeRule: { type: "simple", stages: [], completionPoints: 10 },
  };
}

describe("taskService/template - 模板显示顺序", () => {
  beforeEach(async () => {
    await db.taskTemplates.clear();
  });

  it("createTaskTemplate 把新模板追加到末尾（sortOrder = max + 1）", async () => {
    await createTaskTemplate(newTemplate(1, "a"));
    await createTaskTemplate(newTemplate(1, "b"));
    await createTaskTemplate(newTemplate(1, "c"));

    const templates = await getAllTaskTemplates(1);
    expect(templates.map((t) => t.title)).toEqual(["a", "b", "c"]);
    expect(templates.map((t) => t.sortOrder)).toEqual([0, 1, 2]);
  });

  it("getAllTaskTemplates 按 sortOrder 排序（与写入顺序无关）", async () => {
    const idA = await createTaskTemplate(newTemplate(1, "a"));
    const idB = await createTaskTemplate(newTemplate(1, "b"));
    const idC = await createTaskTemplate(newTemplate(1, "c"));

    await reorderTaskTemplates([idC, idA, idB]);

    const templates = await getAllTaskTemplates(1);
    expect(templates.map((t) => t.title)).toEqual(["c", "a", "b"]);
    expect(templates.map((t) => t.sortOrder)).toEqual([0, 1, 2]);
  });

  it("reorderTaskTemplates 按数组下标重写 sortOrder", async () => {
    const idA = await createTaskTemplate(newTemplate(1, "a"));
    const idB = await createTaskTemplate(newTemplate(1, "b"));

    await reorderTaskTemplates([idB, idA]);

    expect((await db.taskTemplates.get(idB))!.sortOrder).toBe(0);
    expect((await db.taskTemplates.get(idA))!.sortOrder).toBe(1);
  });

  it("不同用户的顺序互不影响", async () => {
    await createTaskTemplate(newTemplate(1, "u1-a"));
    const u2a = await createTaskTemplate(newTemplate(2, "u2-a"));
    const u2b = await createTaskTemplate(newTemplate(2, "u2-b"));

    await reorderTaskTemplates([u2b, u2a]);

    const user1 = await getAllTaskTemplates(1);
    const user2 = await getAllTaskTemplates(2);
    expect(user1.map((t) => t.title)).toEqual(["u1-a"]);
    expect(user1.map((t) => t.sortOrder)).toEqual([0]);
    expect(user2.map((t) => t.title)).toEqual(["u2-b", "u2-a"]);
    expect(user2.map((t) => t.sortOrder)).toEqual([0, 1]);
  });

  it("空数组是 no-op", async () => {
    const idA = await createTaskTemplate(newTemplate(1, "a"));
    await reorderTaskTemplates([]);
    expect((await db.taskTemplates.get(idA))!.sortOrder).toBe(0);
  });
});
