export * from "./task"
export * from "./reward"
export * from "./user"
export * from "./pomo"

import Dexie, { Table } from 'dexie';
import { TaskTemplate, TaskInstance } from "./task";
import { RewardTemplate, RewardInstance } from "./reward";
import { User, PointsHistory } from "./user";
import { PomoSession, PomoSettingsRecord } from "./pomo";

export interface DB extends Dexie {
  taskTemplates: Table<TaskTemplate, number>;
  taskInstances: Table<TaskInstance, number>;
  rewardTemplates: Table<RewardTemplate, number>;
  rewardInstances: Table<RewardInstance, number>;
  users: Table<User, number>;
  pointsHistory: Table<PointsHistory, number>;
  pomoSessions: Table<PomoSession, number>;
  pomoSettings: Table<PomoSettingsRecord, number>;
}
