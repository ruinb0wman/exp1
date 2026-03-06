export * from "./task"
export * from "./reward"
export * from "./user"

import Dexie, { Table } from 'dexie';
import { TaskTemplate, TaskInstance } from "./task";
import { RewardTemplate, RewardInstance } from "./reward";
import { User, PointsHistory } from "./user";

export interface DB extends Dexie {
  taskTemplates: Table<TaskTemplate, number>;
  taskInstances: Table<TaskInstance, number>;
  rewardTemplates: Table<RewardTemplate, number>;
  rewardInstances: Table<RewardInstance, number>;
  users: Table<User, number>;
  pointsHistory: Table<PointsHistory, number>;
}
