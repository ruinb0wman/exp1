# dayEndTime（一天结束时间）设计文档

## 概述

`dayEndTime` 是用户配置的"一天结束时间"，用于处理**跨天使用**场景。

### 解决的问题

用户可能在凌晨时分仍在操作 App（如熬夜到凌晨 2 点）。默认以 `00:00` 为换日点会导致：
- 凌晨 1 点的任务被算作"新的一天"，但实际上用户仍觉得是"昨天"
- 奖励/统计的数据归属与用户感知不一致

通过将一天的结束点调整为可配置时间（如 `02:00`），让凌晨 1 点的操作仍然归属"前一天"。

## 核心算法

### 基本判定逻辑

所有 `dayEndTime` 相关的日期计算共享同一判定逻辑：

```
当前本地时间 < dayEndTime → 日期回退一天
当前本地时间 >= dayEndTime → 使用当天日期
```

### 核心函数

#### `toUserDateString(date, dayEndTime)` — `src/libs/task.ts:15`

将任意时间转换为"用户日期"（YYYY-MM-DD），考虑 dayEndTime 偏移：

```typescript
export function toUserDateString(date: Date | string, dayEndTime: string): string {
  const d = new Date(date.getTime());
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  // 当前时间小于 dayEndTime，日期回退一天
  if (d.getHours() < endHour || (d.getHours() === endHour && d.getMinutes() < endMinute)) {
    d.setDate(d.getDate() - 1);
  }
  return formatLocalDate(d);
}
```

这是整个系统中 dayEndTime 的核心转化函数，所有日期归属判定最终都依赖它。

#### `getUserCurrentDate(dayEndTime)` — `src/libs/time.ts:66`

获取当前时刻的"用户日期"，基于 `new Date()` 的当前时间判断：

```typescript
export function getUserCurrentDate(dayEndTime: string = "00:00"): string {
  const now = new Date();
  // 当前时间小于 dayEndTime，算昨天
  if (now.getHours() < endHour || ...) {
    return formatLocalDate(yesterday);
  }
  return formatLocalDate(now);
}
```

#### `getUserStartOfDay(localDate, dayEndTime)` — `src/libs/time.ts:106`

获取某天的开始时刻（本地 ISO 格式）。将 `dayEndTime` 时刻作为一天的开始：

```typescript
// 返回：2026-05-11T01:00:00.000Z（当 dayEndTime=01:00 时）
```

#### `getUserEndOfDay(localDate, dayEndTime)` — `src/libs/time.ts:128`

获取某天的结束时刻（本地 ISO 格式）。到达 `dayEndTime` 时刻前的一毫秒为结束：

```typescript
// 返回：2026-05-12T00:59:59.999（当 dayEndTime=01:00 时，表示到明天 00:59:59.999 为止）
```

#### `isExpiredByInstanceDate(instanceDate, expireDays, dayEndTime)` — `src/libs/time.ts:226`

动态计算实例是否过期，结合 dayEndTime 判断过期时间：

```typescript
const expireLocalDate = new Date(year, month - 1, day + expireDays);
expireLocalDate.setHours(endHour, endMinute, 0, 0);
return now.getTime() > expireLocalDate.getTime();
```

## 数据模型与存储

### 字段定义 — `src/db/types/user.ts:20`

```typescript
export interface User {
  id: number;
  // ...
  dayEndTime?: string; // "HH:mm" 格式，默认 "00:00"
}
```

### 默认值 — `src/db/services/userService.ts:12`

```typescript
dayEndTime: "00:00",
```

### 更新接口 — `src/db/services/userService.ts:118`

```typescript
export function updateUserDayEndTime(userId: number, newDayEndTime: string) {
  return db.users.update(userId, { dayEndTime: newDayEndTime });
}
```

## 配置入口

用户通过 **设置页面** 调整 dayEndTime：

**`src/pages/Settings.tsx`**

- 显示当前值：`<span className="text-primary font-medium">{dayEndTime}</span>`
- 滑块选择时间，值绑定：`value={dayEndTime}`
- 响应式依赖：`useEffect` 监听 `user?.dayEndTime`
- 通过 `userService.updateUserDayEndTime()` 持久化

## 使用位置清单

### 核心库函数

| 文件 | 函数/导出 | 用途 |
|------|-----------|------|
| `src/libs/task.ts:15` | `toUserDateString(date, dayEndTime)` | 将任意时间转为用户日期 |
| `src/libs/task.ts:137` | `shouldGenerateInstanceOnDate(template, instances, date, dayEndTime)` | 判断某日期是否需生成实例 |
| `src/libs/task.ts:260` | `generateTaskInstance(template, date, dayEndTime)` | 生成任务实例（instanceDate 字段） |
| `src/libs/task.ts:215` | `filterTemplatesNeedingInstancesOnDate(templates, instances, date, dayEndTime)` | 过滤需生成实例的模板列表 |
| `src/libs/time.ts:66` | `getUserCurrentDate(dayEndTime)` | 获取当前用户日期 |
| `src/libs/time.ts:106` | `getUserStartOfDay(localDate, dayEndTime)` | 获取某天开始时刻 |
| `src/libs/time.ts:128` | `getUserEndOfDay(localDate, dayEndTime)` | 获取某天结束时刻 |
| `src/libs/time.ts:199` | `calculateExpiredAtByInstanceDate(instanceDate, expireDays, dayEndTime)` | 计算实例过期时间 |
| `src/libs/time.ts:226` | `isExpiredByInstanceDate(instanceDate, expireDays, dayEndTime)` | 判断实例是否过期 |

### 数据库服务层

| 文件 | 函数 | 用途 |
|------|------|------|
| `src/db/services/userService.ts:12` | 默认值 | 新用户创建时设置 `dayEndTime: "00:00"` |
| `src/db/services/userService.ts:118` | `updateUserDayEndTime()` | 更新用户的 dayEndTime |
| `src/db/services/taskService/query.ts:27` | `getTodayTaskInstances(userId, dayEndTime)` | 获取今日任务（按用户日期查询） |
| `src/db/services/taskService/progress.ts:311` | `checkAndUpdateExpiredTasks(userId, dayEndTime)` | 批量检查并更新过期实例 |
| `src/db/services/rewardService.ts:690` | `getUserCurrentDate(dayEndTime)` | 奖励计算中的日期归属 |

### 数据库中间件

| 文件 | 函数 | 用途 |
|------|------|------|
| `src/db/middleware/taskTemplateMiddleware.ts:12` | `getUserDayEndTime(db, userId)` | 工具函数：从 DB 读取用户的 dayEndTime |
| `src/db/middleware/taskTemplateMiddleware.ts:24,130` | `checkAndGenerateForTemplate()` / `backfillMissingInstancesForTemplate()` | 生成/回填实例时传入 dayEndTime 确保日期正确 |

### 状态管理（Zustand Store）

| 文件 | 用途 |
|------|------|
| `src/store/taskStore.ts:44` | `fetchTasks()` 中通过 `useUserStore.getState().user?.dayEndTime` 获取并传入查询函数 |

### Hooks

| 文件 | 用途 |
|------|------|
| `src/hooks/usePageInitializer.ts:32` | 页面初始化三步流程（生成今日 → 回填历史 → 过期标记），第三步传入 dayEndTime |
| `src/hooks/useExpiredTaskChecker.ts:23` | 定期检查过期任务，从 `useUserStore` 获取 dayEndTime |
| `src/hooks/useTaskInstanceGenerator.ts:38,77,127` | 自动生成实例，多处传入 dayEndTime 确保日期正确 |
| `src/hooks/useTasks.ts:175` | 按日期获取任务列表，支持 dayEndTime 参数传递 |

### 组件层

| 文件 | 用途 |
|------|------|
| `src/components/TaskContributionGraph.tsx:45` | 贡献图网格，获取 dayEndTime 用于 `shouldGenerateInstanceOnDate` 判定 |
| `src/components/TaskDetailPopup.tsx` | 任务详情弹窗，渲染 ContributionGraph 时透传 template |
| `src/components/TaskInstanceCard/index.tsx` | 任务实例卡片，使用 `isExpiredByInstanceDate` 判断过期状态 |
| `src/pages/Settings.tsx:48,80` | 设置页面的 dayEndTime 配置 UI |
| `src/pages/Store/index.tsx:41` | 奖励商店页面，获取 dayEndTime 确定当前用户日期 |

### 测试

| 文件 | 覆盖内容 |
|------|----------|
| `src/libs/task.test.ts` | `toUserDateString` 的边界测试、`generateTaskInstance` 的 dayEndTime 透传、`hasInstanceOnDate` 的 dayEndTime 偏移匹配 |

## 常见陷阱与注意事项

### 1. 午夜迭代的 dayEndTime 偏移问题（已修复）

**场景**：在回填循环或网格日期迭代中，Date 对象的时间保持在 `00:00`（午夜）。当 `dayEndTime=01:00` 时，`toUserDateString(00:00, "01:00")` 会将日期回退一天，导致：
- 回填时 `hasInstanceOnDate()` 误匹配前一天的已有实例 → 跳过本应生成的实例
- 网格显示将本应有任务的日期标记为 "No task" 而非 "Skipped"

**修复策略**：
- 回填循环（`taskTemplateMiddleware.ts:180`）：将时间归一化到 `endHour:endMinute:01`（dayEndTime 后 1 秒）
- 贡献图网格（`TaskContributionGraph.tsx:89`）：将时间归一化到 `12:00:00`（中午，确保大于任何合理的 dayEndTime）

### 2. 调用 `toUserDateString` 时的时间选取

所有调用 `toUserDateString` 或任何 dayEndTime 相关函数时，如果 Date 对象的时间可能落在午夜附近，需考虑是否做时间归一化。通常建议：
- **当前时间**：直接用 `new Date()`（当前时刻 > dayEndTime 通常成立）
- **历史日期遍历**：归一化到 `12:00:00` 或 `dayEndTime + 1s`
- **UTC 时间构造**：明确时区转换意图，避免混用 UTC 和本地时间

### 3. dayEndTime 与 UTC 时间的关系

`toUserDateString` 使用的是**本地时间**（`getHours()` / `getMinutes()`），而非 UTC 时间。这意味着 dayEndTime 在不同时区的行为是一致的——它始终以用户的本地时钟为参照。

## 数据流图

```
用户设置 ──→ Settings.tsx ──→ userService.updateUserDayEndTime()
                                   │
                                   ▼
                              DB (User.dayEndTime)
                                   │
                     ┌─────────────┼─────────────┐
                     │             │             │
                     ▼             ▼             ▼
              useUserStore    middleware      services
              (Zustand)      (Dexie hook)   (task/reward)
                     │             │             │
                     ▼             ▼             ▼
              hooks / 组件     生成/回填     查询/过期判断
```
