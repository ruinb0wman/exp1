import { beforeEach, describe, expect, it } from "vitest";
import { getDB } from "../../index";
import type { TaskTemplate } from "../../types";
import { createTaskTemplate, getAllTaskTemplates } from "./template";

const db = getDB();

/**
 * 用 enabled: false 构造模板：既不触发 taskTemplateMiddleware 的
 * 「创建后生成实例」逻辑，也不影响排序断言。
 */
function newTemplate(
  userId: number,
  title: string,
  level = 1
): Omit<TaskTemplate, "id" | "createdAt" | "updatedAt"> {
  return {
    userId,
    title,
    level,
    repeatMode: "daily",
    endCondition: "manual",
    enabled: false,
    subtasks: [],
    completeRule: { type: "simple", stages: [], completionPoints: 10 },
  };
}

describe("taskService/template - 模板执行等级", () => {
  beforeEach(async () => {
    await db.taskTemplates.clear();
  });

  it("createTaskTemplate 保留传入的 level，不覆盖也不改写", async () => {
    const idA = await createTaskTemplate(newTemplate(1, "a", 3));
    const idB = await createTaskTemplate(newTemplate(1, "b", 1));

    expect((await db.taskTemplates.get(idA))!.level).toBe(3);
    expect((await db.taskTemplates.get(idB))!.level).toBe(1);
  });

  it("getAllTaskTemplates 按 level 升序（与写入顺序无关）", async () => {
    await createTaskTemplate(newTemplate(1, "c", 3));
    await createTaskTemplate(newTemplate(1, "a", 1));
    await createTaskTemplate(newTemplate(1, "b", 2));

    const templates = await getAllTaskTemplates(1);
    expect(templates.map((t) => t.title)).toEqual(["a", "b", "c"]);
    expect(templates.map((t) => t.level)).toEqual([1, 2, 3]);
  });

  it("同等级的模板按创建先后排列", async () => {
    await createTaskTemplate(newTemplate(1, "first", 2));
    await createTaskTemplate(newTemplate(1, "second", 2));

    const templates = await getAllTaskTemplates(1);
    expect(templates.map((t) => t.title)).toEqual(["first", "second"]);
  });

  it("不同用户各自按自己的 level 排序", async () => {
    await createTaskTemplate(newTemplate(1, "u1-a", 3));
    await createTaskTemplate(newTemplate(2, "u2-a", 2));
    await createTaskTemplate(newTemplate(2, "u2-b", 1));

    const user1 = await getAllTaskTemplates(1);
    const user2 = await getAllTaskTemplates(2);
    expect(user1.map((t) => t.title)).toEqual(["u1-a"]);
    expect(user1.map((t) => t.level)).toEqual([3]);
    expect(user2.map((t) => t.title)).toEqual(["u2-b", "u2-a"]);
    expect(user2.map((t) => t.level)).toEqual([1, 2]);
  });
});
