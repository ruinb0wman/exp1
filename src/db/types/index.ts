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
  taskTemplates: Table<TaskTemplate, string>;
  taskInstances: Table<TaskInstance, string>;
  rewardTemplates: Table<RewardTemplate, string>;
  rewardInstances: Table<RewardInstance, string>;
  users: Table<User, number>;
  pointsHistory: Table<PointsHistory, string>;
  pomoSessions: Table<PomoSession, number>;
  pomoSettings: Table<PomoSettingsRecord, number>;
}
