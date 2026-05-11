# TaskInstance（任务实例）设计文档

## 概述

`TaskInstance` 是由 `TaskTemplate`（任务模板）按重复规则生成的**每日/每次执行实例**。每个实例代表"某一天应该完成的任务"，包含当次执行的全部状态和进度信息。

### 完整生命周期

```
模板创建 → 实例生成(pending) → 用户操作
  ├─ 完成 → status=completed → 结算积分
  ├─ 跳过 → status=skipped
  ├─ 进度推进 → 阶段奖励 → 全完→completed
  └─ 过期 → 自动标记 skipped
```

---

## 1. 类型定义

### TaskInstance 接口 — `src/db/types/task.ts:68`

```typescript
export interface TaskInstance {
  id: string;              // 确定性哈希: hash(templateId + instanceDate)
  userId: number;          // 所属用户
  templateId: string;      // 关联模板 ID
  template: TaskTemplate;  // 嵌套的完整模板副本（Embedded in IndexedDB）
  status: TaskStatus;      // 'pending' | 'completed' | 'skipped'
  subtasks: string[];      // 子任务列表
  instanceDate: string;    // 用户本地日期 YYYY-MM-DD
  createdAt: string;       // ISO 时间戳
  updatedAt?: string;
  completedAt?: string;

  // == 新版完成规则字段 ==
  completedStages?: CompletedStage[];   // 已完成阶段
  stagePointsEarned?: number;            // 阶段积分
  completionPointsEarned?: number;       // 全完奖励积分
  completedSubtasks?: boolean[];         // 子任务勾选状态
  isFullyCompleted?: boolean;            // 是否达成全完
  completeProgress?: number;             // time=分钟, count=次数
}
```

### 关联类型

| 类型 | 行号 | 定义 |
|------|------|------|
| `TaskStatus` | 3 | `'pending' \| 'completed' \| 'skipped'` |
| `RepeatMode` | 1 | `'none' \| 'daily' \| 'weekly' \| 'monthly'` |
| `CompleteRule` | 28 | `{ type: TaskType, stages: Stage[], completionPoints: number, subtaskConfig? }` |
| `TaskType` | 8 | `'simple' \| 'time' \| 'count' \| 'subtask'` |
| `Stage` | 14 | `{ id: string, threshold: number, points: number }` |
| `CompletedStage` | 36 | `{ stageId: string, completedAt: string, points: number }` |
| `SubtaskConfig` | 21 | `{ mode: 'all'\|'partial', requiredCount?, pointsPerSubtask }` |

### 数据库索引 — `src/db/migrations/index.ts:7`

```typescript
taskInstances: 'id, userId, templateId, instanceDate, status, createdAt, updatedAt, [instanceDate+userId+status]'
```

---

## 2. 实例生成

### 2.1 生成决策 — `shouldGenerateInstanceOnDate` — `src/libs/task.ts:137`

决定"某个模板在某个日期是否需要生成实例"。四大模式：

| 模式 | 判定逻辑 |
|------|----------|
| `none` | 已有 0 个实例时生成（仅一次） |
| `daily` | `daysDiff % interval === 0`（从 startAt 起每隔 interval 天） |
| `weekly` | `repeatDaysOfWeek` 包含当天，且 `weeksDiff % interval === 0` |
| `monthly` | `repeatDaysOfMonth` 包含当天，且 `monthsDiff % interval === 0` |

所有模式的前置条件：
- `startAt` 存在且目标日期 `>= startAt`
- 该日期尚未有实例（通过 `hasInstanceOnDate` 去重）
- 模板未被结束条件终止（`isTemplateEndedOnDate`）

### 2.2 生成函数 — `generateTaskInstance` — `src/libs/task.ts:260`

```typescript
export function generateTaskInstance(
  template: TaskTemplate,
  date?: Date,
  dayEndTime?: string
): Omit<TaskInstance, 'id'>
```

创建逻辑：
- `instanceDate`：非重复模板使用 `startAt` 日期；重复模板使用 `toUserDateString(targetDate, dayEndTime)`
- `status`：始终为 `'pending'`
- `template`：深拷贝完整的 template 嵌入实例
- `completeProgress`：simple/subtask 为 `undefined`；time/count 为 `0`
- `isFullyCompleted`：`false`
- 所有积分字段初始化为 `0`

### 2.3 ID 生成 — `hashTaskInstance` — `src/libs/id.ts:27`

```typescript
export function hashTaskInstance(templateId: string, date: string): string {
  return hashString(`${templateId}-${date}`);
}
```

使用 FNV-1a 散列，`templateId + instanceDate` 的确定性组合。确保同一模板同一天只会有一条实例，也便于跨设备同步去重。在 Dexie `creating` hook 中自动注入。

### 2.4 实时生成（Dexie 中间件） — `src/db/middleware/taskTemplateMiddleware.ts:20`

**`checkAndGenerateForTemplate`**：在模板**创建 / 更新**时自动触发：

```
模板 created/updated
  └─ shouldGenerateInstanceOnDate(template, existing, today, dayEndTime)
       └─ true → generateTaskInstance → db.taskInstances.add
       └─ false → 跳过
```

包含防重复机制：`processedTemplateIds` 集合防止并发操作，Dexie 事务确保原子性。

### 2.5 页面初始化批量生成 — `src/db/middleware/taskTemplateMiddleware.ts:92`

**`checkAllTemplatesAndGenerate`**：遍历用户所有启用的模板，逐一调用 `checkAndGenerateForTemplate`，返回生成总数。在 `usePageInitializer` 第 1 步执行。

### 2.6 Hook 封装 — `useTaskInstanceGenerator` — `src/hooks/useTaskInstanceGenerator.ts`

| 函数 | 用途 |
|------|------|
| `generateForDate(date)` | 为指定日期生成实例（含防重复） |
| `generateToday()` | 生成今日实例 |
| `shouldGenerateOnDate(date)` | 判断某日是否有模板需生成 |
| `getDisplayTasksForDate(date)` | 获取某日显示任务（已有实例 + 预览占位） |

---

## 3. 历史回填（Backfill）

### 3.1 单模板回填 — `src/db/middleware/taskTemplateMiddleware.ts:114`

**`backfillMissingInstancesForTemplate`** 从 `startAt` 逐日迭代到当前日期，补建缺失实例：

```
日期范围: startAt → now (或 endCondition=date 的结束日期)
循环逐日:
  └─ 该日期已有实例? → 跳过
  └─ shouldGenerateInstanceOnDate? → 生成 → 加入待插入列表
  └─ endCondition=times 且已达上限? → 停止
批量写入: db.taskInstances.bulkAdd(instancesToAdd, { allKeys: true })
```

注意事项：
- 迭代时间已归一化到 `dayEndTime + 1s`，避免 dayEndTime 偏移导致日期回退
- 新生成的实例以 `'pending'` 状态写入
- 回填后由过期检查步骤统一标记过期实例

### 3.2 批量回填 — `src/db/middleware/taskTemplateMiddleware.ts:228`

**`backfillMissingInstancesForAllTemplates`**：遍历用户所有启用的非 none 模板，对每个执行单模板回填。返回总回填数。

### 3.3 触发时机

页面初始化三步流程（`usePageInitializer.ts:43`）的第 2 步：

```
步骤1: checkAllTemplatesAndGenerate   → 生成今日实例
步骤2: backfillMissingInstancesForAllTemplates → 回填历史缺失实例
步骤3: checkAndUpdateExpiredTasks     → 标记过期
```

---

## 4. 过期机制

### 4.1 过期判定 — `isExpiredByInstanceDate` — `src/libs/time.ts:226`

```typescript
export function isExpiredByInstanceDate(
  instanceDate: string,
  expireDays: number,
  dayEndTime: string
): boolean {
  const expireLocalDate = new Date(year, month - 1, day + expireDays);
  expireLocalDate.setHours(endHour, endMinute, 0, 0);
  return now.getTime() > expireLocalDate.getTime();
}
```

计算方式：`instanceDate + expireDays 天` 的 `dayEndTime` 时刻为过期时间。示例：
- instanceDate=`2026-05-05`, expireDays=1, dayEndTime=`01:00`
- 过期时间 = `2026-05-06 01:00:00`
- 当前时间超过该时刻 → 过期

### 4.2 批量过期更新 — `checkAndUpdateExpiredTasks` — `src/db/services/taskService/progress.ts:309`

```typescript
流程:
1. 查询用户所有 status='pending' 的实例
2. 过滤: template.completeExpireDays > 0 && isExpiredByInstanceDate()
3. 更新: status='skipped', completedAt=now
4. 返回过期实例 ID 列表
```

过期后积分**不做扣除**（因为未完成阶段/子任务，也就未获得积分）。

### 4.3 Hook 封装 — `useExpiredTaskChecker` — `src/hooks/useExpiredTaskChecker.ts`

- `checkExpiredTasks()` — 执行过期检查，`hasCheckedRef` 防重复
- `resetCheckFlag()` — 重置检查标志

### 4.4 触发时机

| 时机 | 调用者 | 位置 |
|------|--------|------|
| 应用启动 | `useAppBootstrap` | `src/hooks/useAppBootstrap.ts:23` |
| 页面挂载 | `usePageInitializer` 第 3 步 | `src/hooks/usePageInitializer.ts:48` |

---

## 5. 任务完成与进度

### 5.1 完成类型总览

按 `CompleteRule.type` 区分四种完成方式：

| 类型 | 完成方式 | 积分结算方式 |
|------|----------|-------------|
| `simple` | 一键完成 | 中间件自动 |
| `time` | 番茄钟推进 / 手动调整进度 | `updateTaskProgress` |
| `count` | 每次 +1 递增 | `updateTaskProgress` |
| `subtask` | 逐项勾选子任务 | `completeSubtask` |

### 5.2 简单类型 — `completeTaskInstance` — `src/db/services/taskService/instance.ts:108`

```typescript
status → 'completed'
completedAt → now
```

积分由 `pointsHistoryMiddleware.ts` 中间件在 `updating` hook 中自动结算。

### 5.3 跳过 — `skipTaskInstance` — `src/db/services/taskService/instance.ts:126`

```typescript
status → 'skipped'
// completedAt 不设置
```

**不可从 `'completed'` 跳过**（抛出错误）。

### 5.4 进度更新 — `updateTaskProgress` — `src/db/services/taskService/progress.ts:7`

用于 `time` / `count` 类型。事务中包含完整的**回退→前进**逻辑：

```
更新流程:
  1. 计算 newProgress（增或减）
  2. 回退场景:
     - newProgress 低于某 stage 阈值 → 扣除该阶段积分
     - isFullyCompleted 不满足 → 扣除全完奖励
  3. 前进场景:
     - 达成新 stage 阈值 → 奖励阶段积分
     - 所有 stage 完成 → 标记 isFullyCompleted, 奖励全完积分
  4. 写入: status, completedAt, completeProgress, stagePointsEarned, ...
```

### 5.5 番茄钟集成 — `addPomoToTaskProgress` — `src/db/services/taskService/progress.ts:148`

```typescript
// 番茄钟完成 → seconds → minutes → updateTaskProgress
addPomoToTaskProgress(instanceId, durationMinutes)
```

### 5.6 子任务完成 — `completeSubtask` — `src/db/services/taskService/progress.ts:175`

```
勾选/取消勾选子任务:
  勾选:
    - 积分已到上限? → 抛错
    - 奖励 pointsPerSubtask[i]
    - completedCount ≥ requiredCount → 奖励全完积分
  取消勾选:
    - 扣除子任务积分
    - isFullyCompleted 不满足 → 扣除全完奖励
```

### 5.7 重置 — `resetTaskInstance` — `src/db/services/taskService/instance.ts:143`

完整回退（事务中包含 `rw: taskInstances, pointsHistory, users`）：

```
1. 扣除所有已获得积分（除积分→负记录）
2. 所有进度字段归零
3. status → 'pending'
4. completedAt → undefined
```

### 5.8 积分系统

| 操作 | 金额 | 记录类型 |
|------|------|----------|
| 阶段达成 | +stage.points | `task_stage` |
| 全完奖励 | +completionPoints | `task_completion` |
| 进度回退 | -扣除积分 | `task_deduction` |

积分流：

```
createPointsRecord / deductPoints
  └─ PointsHistory 表插入记录
  └─ User.totalPoints += amount
```

在同一个 `rw` 事务中保证一致性。

### 5.9 积分中间件 — `src/db/middleware/pointsHistoryMiddleware.ts:18`

仅处理 `simple` 类型（或 rule 为空的旧数据）：

```
updating hook:
  └─ status 从非 completed → completed: 奖励 completionPoints
  └─ status 从 completed → 非 completed: 扣除 completionPoints
```

`time` / `count` / `subtask` 类型的积分由 `updateTaskProgress` / `completeSubtask` 直接管理，中间件不介入。

### 5.10 辅助函数 — `src/libs/task.ts`

| 函数 | 位置 | 用途 |
|------|------|------|
| `getTaskProgressPercent(instance)` | 322 | 计算 0-100% 进度 |
| `getNextStage(instance)` | 352 | 获取下一个未完成阶段 |
| `getTotalPointsEarned(instance)` | 369 | `stagePoints + completionPoints` |
| `calculateMaxPoints(rule)` | 92 | 预估最大可得积分 |

---

## 6. 查询服务

### 文件：`src/db/services/taskService/query.ts`

| 函数 | 用途 |
|------|------|
| `getTaskInstanceWithTemplate(instanceId)` | 单实例 + 模板详情查询 |
| `getTodayTaskInstances(userId, dayEndTime)` | 今日任务（按 `getUserCurrentDate(dayEndTime)` 匹配 `instanceDate`） |
| `getNoDateTaskInstances(userId)` | 无日期的旧版任务 |
| `getTaskStatistics(userId)` | `{ total, completed, pending, skipped }` 统计 |
| `getTaskInstancesWithFilter(userId, filter, offset, limit)` | 分页查询（all/pending/completed/skipped） |

### 文件：`src/db/services/taskService/instance.ts`

| 函数 | 用途 |
|------|------|
| `createTaskInstance(instance)` | 创建单实例 |
| `createTaskInstances(instances)` | 批量创建 |
| `getAllTaskInstances(userId?)` | 全部实例 |
| `getTaskInstanceById(id)` | 主键查询 |
| `getTaskInstancesByTemplateId(templateId)` | 按模板查 |
| `getTaskInstancesByStatus(status, userId?)` | 按状态查 |
| `getTaskInstancesByDateRange(start, end, userId?)` | 日期范围查询 |
| `getTaskInstancesByDate(date, userId?)` | 精确日期查询 |
| `deleteTaskInstance(id)` / `deleteTaskInstances(ids)` | 删除 |
| `deleteTaskInstancesByTemplateId(templateId)` | 级联删除 |

---

## 7. 状态管理（Zustand Store）

### 文件：`src/store/taskStore.ts`

使用 Dexie `liveQuery` 实现响应式数据订阅：

```
taskStore
  ├─ todayTasks:     liveQuery → getTodayTaskInstances(userId, dayEndTime)
  └─ noDateTasks:    liveQuery → getNoDateTaskInstances(userId)
```

特点：
- 任何 IndexedDB 修改自动触发 UI 刷新
- 订阅生命周期：`useAppBootstrap` 中初始化，`useEffect` cleanup 中取消

---

## 8. 组件使用

### `TaskInstanceCard` — `src/components/TaskInstanceCard/index.tsx`

核心渲染元素：
- **状态图标**：pending=Circle, completed=CheckCircle2, skipped=XCircle, 预览=Eye
- **进度条**：time/count 类型显示彩色进度条（由 `getTaskProgressPercent` 计算）
- **阶段提示**：`getNextStage` 计算下一阶段目标
- **过期提示**：`isExpiredByInstanceDate` + `getExpireTimeTextByInstanceDate` 显示剩余时间
- **预览模式**：未来日期的占位显示（`isPreview` 标志位）
- **积分显示**：`+N exp`（由 `getTotalPointsEarned` 计算）

### `TaskDetailPopup` — `src/components/TaskDetailPopup.tsx`

详情弹窗（425 行），包含：
- **状态标**：完成=绿色, 过期=红色, 进行中=主题色
- **积分**：`+已获得/最大可得`
- **进度条 + 阶段解锁提示**
- **完成规则操作按钮**：
  - `simple`：一键「完成」/「撤销」
  - `time`：带进度到番茄钟页面
  - `count`：「+1」递增按钮
  - `subtask`：可勾选子任务列表
- **过期横幅警告**：剩余时间不足时显示
- **TaskContributionGraph**：重复任务展示 180 天贡献网格

### `TaskContributionGraph` — `src/components/TaskContributionGraph.tsx`

GitHub 风格贡献图（208 行）：
- 显示最近 180 天（6 行 × 30 列）
- 每格四种状态颜色：completed=绿, skipped=黄, pending=灰亮, none=灰暗
- 使用 `shouldGenerateInstanceOnDate` 判断缺失日期是否本应有实例

---

## 9. 完整生命周期流程图

```
┌─────────────────────────────────────────────────────────────────────┐
│                      应用启动                                       │
│  useAppBootstrap                                                    │
│    ├─ useExpiredTaskChecker.checkExpiredTasks()                     │
│    ├─ taskStore.subscribeToTodayTasks()  ← liveQuery 响应式订阅    │
│    └─ taskStore.subscribeToNoDateTasks()                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    页面挂载 (Home)                                   │
│  usePageInitializer.initialize()                                     │
│    ├─ 步骤1: checkAllTemplatesAndGenerate         生成今日实例      │
│    ├─ 步骤2: backfillMissingInstancesForAllTemplates  回填历史      │
│    └─ 步骤3: checkAndUpdateExpiredTasks          过期标记 skipped  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    模板创建/更新       用户操作         时间推移
  (Dexie middleware)    (UI交互)        (自动触发)
  checkAndGenerate    complete/skip/   expiredTaskChecker
  ──────────────      reset/progress   ───────────────
  生成新实例          status 变更       pending→skipped
                      积分结算
                           │
                           ▼
               liveQuery 检测 IndexedDB 变化
                           │
                           ▼
                     UI 自动刷新
                (todayTasks / noDateTasks)
```

---

## 附录：涉及文件清单

| 分类 | 文件路径 |
|------|----------|
| **类型定义** | `src/db/types/task.ts` |
| **数据库结构** | `src/db/types/index.ts`、`src/db/migrations/index.ts` |
| **ID 生成** | `src/libs/id.ts` |
| **核心函数** | `src/libs/task.ts`、`src/libs/time.ts` |
| **中间件** | `src/db/middleware/taskTemplateMiddleware.ts`、`src/db/middleware/pointsHistoryMiddleware.ts` |
| **CRUD** | `src/db/services/taskService/instance.ts` |
| **查询** | `src/db/services/taskService/query.ts` |
| **进度与过期** | `src/db/services/taskService/progress.ts` |
| **积分** | `src/db/services/taskService/points.ts` |
| **Store** | `src/store/taskStore.ts` |
| **Hooks** | `src/hooks/useTaskInstanceGenerator.ts`、`src/hooks/useExpiredTaskChecker.ts`、`src/hooks/usePageInitializer.ts`、`src/hooks/useAppBootstrap.ts`、`src/hooks/useTasks.ts` |
| **组件** | `src/components/TaskInstanceCard/index.tsx`、`src/components/TaskDetailPopup.tsx`、`src/components/TaskContributionGraph.tsx` |
| **页面** | `src/pages/Home/index.tsx`、`src/pages/Home/lib.tsx` |
| **测试** | `src/libs/task.test.ts` |
