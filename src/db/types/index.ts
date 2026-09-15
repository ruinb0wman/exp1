export * from "./task"
export * from "./reward"
export * from "./user"
export * from "./pomo"
export * from "./achievement"

import Dexie, { Table } from 'dexie';
import { TaskTemplate, TaskInstance } from "./task";
import { RewardTemplate, RewardPurchase, ReplenishmentRecord } from "./reward";
import { User, PointsHistory } from "./user";
import { PomoSession, PomoSettingsRecord } from "./pomo";
import { Achievement } from "./achievement";

export interface DB extends Dexie {
  taskTemplates: Table<TaskTemplate, string>;
  taskInstances: Table<TaskInstance, string>;
  rewardTemplates: Table<RewardTemplate, string>;
  rewardPurchases: Table<RewardPurchase, string>;
  replenishmentRecords: Table<ReplenishmentRecord, string>;
  users: Table<User, number>;
  pointsHistory: Table<PointsHistory, string>;
  pomoSessions: Table<PomoSession, number>;
  pomoSettings: Table<PomoSettingsRecord, number>;
  achievements: Table<Achievement, string>;
}
