import { describe, it, expect, beforeEach } from "vitest";
import { getDB } from "@/db";
import type { TaskInstance, TaskTemplate } from "@/db/types";
import { deleteTaskInstanceWithPoints } from "./instance";

const db = getDB();

function createInstance(
  instanceId: string,
  overrides: Partial<TaskInstance> = {}
): TaskInstance {
  const template: TaskTemplate = {
    id: `tmpl-${instanceId}`,
    userId: 1,
    title: `Template ${instanceId}`,
    repeatMode: "daily",
    repeatInterval: 1,
    endCondition: "manual",
    enabled: true,
    subtasks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    startAt: "2026-01-01T00:00:00.000Z",
  } as unknown as TaskTemplate;

  return {
    id: instanceId,
    userId: 1,
    templateId: template.id!,
    template,
    status: "pending",
    subtasks: [],
    instanceDate: "2026-05-11",
    createdAt: "2026-05-11T00:00:00.000Z",
    completedStages: [],
    stagePointsEarned: 0,
    completionPointsEarned: 0,
    completedSubtasks: [],
    isFullyCompleted: false,
    ...overrides,
  };
}

async function seedPointsRecord(
  instanceId: string,
  type: string,
  amount: number
): Promise<void> {
  await db.pointsHistory.add({
    id: `points-${instanceId}-${type}`,
    userId: 1,
    amount,
    type,
    relatedInstanceId: instanceId,
    description: `test-${type}`,
    createdAt: "2026-05-11T12:00:00.000Z",
  } as any);
}

describe("deleteTaskInstanceWithPoints", () => {
  beforeEach(async () => {
    await db.users.clear();
    await db.taskTemplates.clear();
    await db.taskInstances.clear();
    await db.pointsHistory.clear();
  });

  it("删除实例的同时删除其关联的积分记录", async () => {
    // 实例 A：有两条积分记录
    const instanceA = createInstance("inst-a");
    await db.taskInstances.add(instanceA);
    await seedPointsRecord(instanceA.id, "task_reward", 10);
    await seedPointsRecord(instanceA.id, "task_stage", 5);

    // 实例 B：有一条积分记录（应保留）
    const instanceB = createInstance("inst-b");
    await db.taskInstances.add(instanceB);
    await seedPointsRecord(instanceB.id, "task_reward", 20);

    await deleteTaskInstanceWithPoints(instanceA.id);

    // 实例 A 及其积分记录被删除
    expect(await db.taskInstances.get(instanceA.id)).toBeUndefined();
    expect(await db.pointsHistory.where("relatedInstanceId").equals(instanceA.id).toArray())
      .toHaveLength(0);

    // 实例 B 及其积分记录不受影响
    expect(await db.taskInstances.get(instanceB.id)).toBeDefined();
    const remainingRecords = await db.pointsHistory.where("relatedInstanceId").equals(instanceB.id).toArray();
    expect(remainingRecords).toHaveLength(1);
    expect(remainingRecords[0].amount).toBe(20);
  });

  it("实例没有积分记录时仅删除实例本身", async () => {
    const instance = createInstance("inst-no-points");
    await db.taskInstances.add(instance);

    await deleteTaskInstanceWithPoints(instance.id);

    expect(await db.taskInstances.get(instance.id)).toBeUndefined();
  });

  it("实例不存在时抛出错误且不影响已有数据", async () => {
    const instanceB = createInstance("inst-b");
    await db.taskInstances.add(instanceB);
    await seedPointsRecord(instanceB.id, "task_reward", 20);

    await expect(deleteTaskInstanceWithPoints("inst-nonexistent")).rejects.toThrow(
      "Task instance not found"
    );

    // 无关数据保持不变
    expect(await db.taskInstances.get(instanceB.id)).toBeDefined();
    expect(await db.pointsHistory.where("relatedInstanceId").equals(instanceB.id).toArray())
      .toHaveLength(1);
  });
});