# hello-tauri - AI Agent 文档

## 项目概述

这是一个**游戏化任务管理应用**（任务+积分工具），通过奖励系统激励用户培养习惯。用户可创建周期性任务、追踪完成情况、赚取积分、在虚拟商店兑换奖励，并使用番茄钟进行专注计时。

项目采用 **Tauri v2** 后端和 **React + TypeScript** 前端，支持桌面端（Windows/macOS/Linux）和移动端（Android/iOS）。

### 核心功能

- **任务管理** - 创建周期性任务，支持每日/每周/每月循环，包含子任务、结束条件和完成规则（时间制或计数制）
- **日历视图** - 可视化查看任务完成情况
- **奖励系统** - 使用积分兑换自定义奖励，支持自定义图标和颜色
- **背包系统** - 管理已兑换的奖励物品
- **番茄钟** - 可配置时长的专注计时器
- **数据统计** - 追踪任务进度和积分历史
- **数据导入/导出** - 通过 JSON 文件备份和恢复数据
- **本地数据持久化** - 使用 Dexie.js 操作 IndexedDB
- **自定义一天结束时间** - 可配置"一天"何时结束（如凌晨 02:00 而非 00:00）

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | ^19.1.0 |
| 前端语言 | TypeScript | ~5.8.3 |
| 构建工具 | Vite | ^7.0.4 |
| 样式 | Tailwind CSS | ^4.2.1 |
| 路由 | react-router | ^7.13.1 |
| 数据库 | Dexie.js (IndexedDB) | ^4.3.0 |
| 状态管理 | Zustand | ^5.0.11 |
| 图标 | lucide-react | ^0.577.0 |
| 后端框架 | Tauri | v2 |
| 后端语言 | Rust | Edition 2021 |
| 包管理器 | Bun | (lockfile: bun.lock) |

---

## 项目结构

```
hello-tauri/
├── src/                          # 前端源码 (React + TypeScript)
│   ├── App.tsx                   # 主 React 组件，含路由配置
│   ├── main.tsx                  # React 应用入口
│   ├── index.css                 # 全局样式 (Tailwind v4 @theme)
│   ├── vite-env.d.ts             # Vite 类型声明
│   │
│   ├── components/               # 可复用 UI 组件
│   │   ├── BottomNav.tsx         # 底部导航栏 (5 个标签页)
│   │   ├── Calendar.tsx          # 日历视图组件
│   │   ├── DatePicker.tsx        # 日期选择器
│   │   ├── DynamicIcon.tsx       # 动态 Lucide 图标渲染
│   │   ├── Header.tsx            # 页面头部组件
│   │   ├── HomeHeader.tsx        # 首页头部（含问候语）
│   │   ├── IconPicker.tsx        # 图标选择组件
│   │   ├── MultiSelectGrid.tsx   # 多选网格（星期/月份）
│   │   ├── PomoTimer.tsx         # 番茄钟计时器组件
│   │   ├── Popup.tsx             # 弹窗/模态框（带动画）
│   │   ├── Progress.tsx          # 进度指示器
│   │   ├── RadioGroup.tsx        # 单选按钮组
│   │   ├── TaskDetailPopup.tsx   # 任务详情弹窗
│   │   ├── TaskList.tsx          # 任务列表组件
│   │   └── TimePicker.tsx        # 时间选择器
│   │
│   ├── pages/                    # 页面组件
│   │   ├── Home/index.tsx        # 首页（今日任务）
│   │   ├── AllTasks.tsx          # 全部任务视图
│   │   ├── EditTask.tsx          # 创建/编辑任务表单
│   │   ├── Store.tsx             # 奖励商店页面
│   │   ├── EditReward.tsx        # 创建/编辑奖励表单
│   │   ├── Stats.tsx             # 统计页面
│   │   ├── Profile.tsx           # 用户个人页面
│   │   ├── Pomo.tsx              # 番茄钟页面
│   │   ├── PointsHistory.tsx     # 积分历史记录
│   │   ├── Backpack.tsx          # 背包（已兑换奖励）
│   │   ├── TaskHistory.tsx       # 历史任务实例
│   │   ├── Settings.tsx          # 应用设置
│   │   └── DataImportExport.tsx  # 数据备份/恢复
│   │
│   ├── db/                       # 数据库层 (Dexie.js)
│   │   ├── index.ts              # 数据库初始化（单例模式）
│   │   ├── types/                # TypeScript 类型定义
│   │   │   ├── index.ts          # DB 接口和导出
│   │   │   ├── task.ts           # 任务类型
│   │   │   ├── reward.ts         # 奖励类型（含图标/颜色预设）
│   │   │   ├── user.ts           # 用户和积分历史类型
│   │   │   └── pomo.ts           # 番茄钟会话和设置类型
│   │   ├── migrations/           # 数据库迁移
│   │   │   └── index.ts          # Schema v1-v7 定义
│   │   └── services/             # 数据库服务层
│   │       ├── index.ts          # 服务导出
│   │       ├── userService.ts    # 用户和积分操作
│   │       ├── taskService.ts    # 任务 CRUD 和查询
│   │       ├── rewardService.ts  # 奖励 CRUD 和操作
│   │       ├── pomoService.ts    # 番茄钟会话操作
│   │       ├── pointsHistoryService.ts # 积分历史查询
│   │       └── exportImportService.ts  # 数据导入导出
│   │
│   ├── hooks/                    # React 自定义 Hooks
│   │   ├── useTasks.ts           # 任务数据获取 Hooks
│   │   ├── useTaskInstanceGenerator.ts # 任务实例生成 Hook
│   │   ├── useExpiredTaskChecker.ts    # 过期任务检查 Hook
│   │   ├── useRewards.ts         # 奖励数据 Hooks
│   │   ├── usePointsHistory.ts   # 积分历史（含分页）
│   │   ├── useTaskHistory.ts     # 任务历史 Hooks
│   │   ├── useProfileStats.ts    # 个人统计 Hooks
│   │   └── usePomo.ts            # 番茄钟 Hooks
│   │
│   ├── libs/                     # 工具库
│   │   ├── task.ts               # 任务生成逻辑和日期工具
│   │   └── time.ts               # 时间处理（支持 dayEndTime）
│   │
│   └── store/                    # Zustand 状态管理
│       ├── index.ts              # Store 导出
│       ├── userStore.ts          # 用户状态和积分管理
│       └── pomoStore.ts          # 番茄钟状态
│
├── src-tauri/                    # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── main.rs               # Rust 二进制入口
│   │   └── lib.rs                # 库代码（Tauri 命令和插件初始化）
│   ├── Cargo.toml                # Rust 依赖
│   ├── tauri.conf.json           # Tauri 应用配置
│   ├── capabilities/
│   │   └── default.json          # Tauri 权限配置
│   ├── icons/                    # 各平台应用图标
│   └── gen/android/              # 自动生成的 Android 项目文件
│       └── app/
│           └── build.gradle.kts  # Android 构建配置
│
├── design/                       # UI/UX 设计原型
├── public/                       # 静态资源
├── index.html                    # Vite HTML 入口
├── vite.config.ts                # Vite 配置（针对 Tauri 优化）
├── tsconfig.json                 # TypeScript 配置
├── tsconfig.node.json            # Node 工具 TypeScript 配置
├── package.json                  # Node.js 依赖
└── bun.lock                      # Bun 锁文件
```

---

## 构建和开发命令

所有命令均使用 Bun 从项目根目录运行：

```bash
# 仅前端开发（Vite 开发服务器）
bun run dev

# 完整 Tauri 开发（桌面端）
bun run dev:pc
# 或
bun run tauri dev

# Android 开发（重要：需要 --host 参数指定本机 IP）
bun run dev:android
# 展开为：tauri android dev --host 192.168.1.5
# 如网络不同，请在 package.json 中调整 IP

# 生产构建（TypeScript 编译 + Vite 构建）
bun run build

# 预览生产构建
bun run preview

# Tauri CLI 命令
bun run tauri -- <command>
```

### Android 开发注意事项

默认开发服务器 IP 可能不适用于 Android。必须指定主机 IP：

```bash
# 如果预配置 IP 不工作，手动指定：
bun run tauri android dev -- --host <你的机器IP>
```

---

## 配置详情

### Vite 配置 (`vite.config.ts`)

- **端口**：固定 1420（Tauri 要求）
- **HMR 端口**：1421（用于移动开发）
- **Host**：'0.0.0.0'（允许移动端外部连接）
- **Watch**：忽略 `src-tauri/**` 防止重建循环
- **Clear Screen**：禁用以保留 Rust 错误可见性
- **路径别名**：`@/` 映射到 `src/`

### TypeScript 配置 (`tsconfig.json`)

- **Target**：ES2020
- **Module**：ESNext + Bundler 解析
- **JSX**：react-jsx 转换
- **严格模式**：启用
- **未使用的局部变量/参数**：报错（非警告）
- **路径别名**：`@/*` 映射到 `src/*`

### Tauri 配置 (`src-tauri/tauri.conf.json`)

- **App ID**：`com.ruinb0w.hello-tauri`
- **Product Name**：`hello-tauri`
- **Dev URL**：`http://localhost:1420`
- **Frontend Dist**：`../dist`（Vite 输出目录）
- **窗口默认**：800x600，标题 "hello-tauri"
- **CSP**：当前设为 `null`（开发模式）

### Android 配置 (`src-tauri/gen/android/app/build.gradle.kts`)

- **Compile SDK**：36
- **Min SDK**：24
- **Target SDK**：36
- **Namespace**：`com.ruinb0w.hello_tauri`
- **Kotlin JVM Target**：1.8

---

## 代码风格规范

### TypeScript 规范

- Target: ES2020
- Module: ESNext with Bundler resolution
- JSX: react-jsx transform
- 严格模式启用
- 未使用的局部变量和参数为**错误**（非警告）
- 使用路径别名 `@/` 从 `src/` 导入
- **代码注释使用中文** - 保持此约定以保持一致性

### Rust 规范

- Edition 2021
- 标准 Tauri 模式，使用命令处理器
- 当前 Rust 代码较少（前端为主的应用）
- 插件在 `lib.rs` 中初始化

### CSS/样式规范

应用采用**极简主义深色主题**，使用 Tailwind CSS v4：

**颜色方案（在 `src/index.css` 中用 `@theme` 定义）：**

| Token | 值 | 用途 |
|-------|------|------|
| `--color-primary` | `#f56565` | 珊瑚红/红色 - 主操作 |
| `--color-primary-light` | `#fc8181` | 浅主色 |
| `--color-primary-dark` | `#e53e3e` | 深主色 |
| `--color-background` | `#1b1b1f` | 主背景 |
| `--color-surface` | `#202127` | 卡片背景 |
| `--color-surface-light` | `#2a2a30` |  elevated 表面 |
| `--color-text-primary` | `#ffffff` | 主文字 |
| `--color-text-secondary` | `#a0a0a0` | 次文字 |
| `--color-text-muted` | `#6b6b6b` | 淡化文字 |
| `--color-border` | `#2a2a30` | 边框/分割线 |

**设计模式：**

- 图标：Lucide，线宽 1.5px
- 圆角：6px（小元素），12px（大元素/卡片）
- 安全区边距：使用 `pt-safe`、`pb-safe` 等类处理移动端刘海屏
- 滚动条：默认隐藏（`::-webkit-scrollbar` width/height: 0）

---

## 数据库架构

### IndexedDB with Dexie.js

应用使用 **Dexie.js** 封装浏览器 IndexedDB 进行本地数据持久化。

### 数据库 Schema（当前：v7）

定义在 `src/db/migrations/index.ts`：

| 表名 | 主键 | 索引 |
|------|------|------|
| `taskTemplates` | `++id` | `userId`, `repeatMode`, `enabled`, `*subtasks`, `[userId+enabled]` |
| `taskInstances` | `++id` | `userId`, `templateId`, `startAt`, `status`, `createdAt`, `[templateId+startAt]` |
| `rewardTemplates` | `++id` | `userId`, `replenishmentMode`, `enabled` |
| `rewardInstances` | `++id` | `templateId`, `userId`, `status`, `expiresAt` |
| `users` | `++id` | `name` |
| `pointsHistory` | `++id` | `userId`, `type`, `createdAt`, `[userId+createdAt]` |
| `pomoSessions` | `++id` | `userId`, `taskId`, `mode`, `status`, `startedAt` |

### 核心类型定义

**任务类型 (`src/db/types/task.ts`)：**

```typescript
type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
type EndCondition = 'times' | 'date' | 'manual';
type TaskStatus = 'pending' | 'completed' | 'skipped';
type CompleteRule = 'time' | 'count';

interface TaskTemplate {
  id?: number;
  userId: number;
  title: string;              // 标题
  description?: string;       // 描述
  rewardPoints: number;       // 完成奖励积分
  repeatMode: RepeatMode;     // 重复模式
  repeatInterval?: number;    // 重复周期
  repeatDaysOfWeek?: number[]; // 每周哪几天 (0-6)
  repeatDaysOfMonth?: number[]; // 每月哪几天 (1-31)
  endCondition: EndCondition; // 结束条件
  endValue?: string;          // 结束值（日期或次数）
  enabled: boolean;           // 是否启用
  subtasks: string[];         // 子任务列表
  isRandomSubtask: boolean;   // 是否随机选择一个子任务
  createdAt: string;          // 创建时间 (ISO)
  updatedAt: string;          // 更新时间 (ISO)
  startAt?: string;           // 任务开始日期 (YYYY-MM-DD)
  
  // 完成规则字段 (v5+)
  completeRule?: CompleteRule;     // 'time' 时间(分钟) / 'count' 次数
  completeTarget?: number;         // 目标值
  completeExpireDays?: number;     // 过期天数（0 表示不过期）
}

interface TaskInstance {
  id?: number;
  userId: number;
  templateId: number;         // TaskTemplate id
  status: TaskStatus;
  rewardPoints: number;
  subtasks: string[];
  startAt?: string;           // 任务开始时间 (ISO)
  createdAt: string;          // 创建时间 (ISO)
  completedAt?: string;       // 完成时间 (ISO)
  
  // 进度字段 (v5+)
  completeProgress?: number;  // 当前进度
  expiredAt?: string;         // 过期时间 (ISO)
}
```

**奖励类型 (`src/db/types/reward.ts`)：**

```typescript
type RewardStatus = 'available' | 'used' | 'expired';
type ReplenishmentMode = 'none' | 'daily' | 'weekly' | 'monthly';

// 27 个预设 Lucide 图标
const REWARD_ICONS = ['Gift', 'Coffee', 'Gamepad2', ...] as const;
const REWARD_ICON_COLORS = ['#f56565', '#fc8181', '#ed8936', ...] as const;

interface RewardTemplate {
  id?: number;
  userId: number;
  title: string;              // 奖励标题
  description?: string;       // 描述
  pointsCost: number;         // 所需积分
  validDuration: number;      // 有效期（秒），0 表示不过期
  enabled: boolean;           // 是否启用
  replenishmentMode: ReplenishmentMode; // 补货模式
  icon: RewardIconName;       // 图标名称
  iconColor?: RewardIconColor; // 图标颜色
  createdAt?: string;
  updatedAt?: string;
}

interface RewardInstance {
  id?: number;
  templateId: number;
  userId: number;
  status: RewardStatus;
  createdAt: string;          // 兑换时间
  expiresAt?: string;         // 过期时间
  usedAt?: string;            // 使用时间
}
```

**用户类型 (`src/db/types/user.ts`)：**

```typescript
type PointsHistoryType = 'task_reward' | 'task_undo' | 'reward_exchange' | 'admin_adjustment';

interface User {
  id: number;
  createdAt: string;
  name: string;
  dayEndTime?: string;        // "HH:mm" 格式，默认 "00:00"
}

interface PointsHistory {
  id?: number;
  userId: number;
  amount: number;             // 正数为收入，负数为支出
  type: PointsHistoryType;
  relatedEntityId?: number;   // 关联的任务/奖励实例 ID
  createdAt: string;
}
```

**番茄钟类型 (`src/db/types/pomo.ts`)：**

```typescript
type PomoMode = 'focus' | 'shortBreak' | 'longBreak';
type PomoStatus = 'running' | 'paused' | 'completed' | 'aborted';

interface PomoSession {
  id?: number;
  userId: number;
  taskId?: number;            // 关联的任务实例 ID
  mode: PomoMode;
  duration: number;           // 设定时长（秒）
  actualDuration: number;     // 实际专注时长（秒）
  status: PomoStatus;
  startedAt: string;
  endedAt?: string;
  interruptions: number;      // 中断次数
}

interface PomoSettings {
  focusDuration: number;      // 专注时长（分钟），默认 25
  shortBreakDuration: number; // 短休息（分钟），默认 5
  longBreakDuration: number;  // 长休息（分钟），默认 15
  longBreakInterval: number;  // 几个番茄后长休息，默认 4
  autoStartBreaks: boolean;   // 自动开始休息
  autoStartPomos: boolean;    // 自动开始专注
  soundEnabled: boolean;      // 音效开关
}
```

### 状态管理 (Zustand)

**User Store (`src/store/userStore.ts`)：**

- 用户初始化和刷新
- 积分管理（通过 pointsHistory 实时计算）
- 积分历史追踪
- 加载和错误状态

**Pomodoro Store (`src/store/pomoStore.ts`)：**

- 计时器状态管理
- 设置管理
- 会话追踪

### 数据库访问模式

```typescript
// 通过 getDB() 单例模式获取数据库
import { getDB } from '@/db';

const db = getDB();

// 访问表
const templates = await db.taskTemplates.toArray();

// 复杂操作使用服务层
import { getTodayTaskInstances, createTaskTemplate } from '@/db/services';
```

---

## 路由结构

定义在 `src/App.tsx`，使用 react-router v7：

**带底部导航的布局（5 个标签页）：**

- `/` - 首页（今日任务）
- `/pomo` - 番茄钟
- `/store` - 奖励商店
- `/stats` - 统计
- `/profile` - 个人中心

**简单布局（无导航）：**

- `/tasks` - 全部任务视图
- `/tasks/new` - 新建任务
- `/tasks/:id` - 编辑任务
- `/rewards/new` - 新建奖励
- `/rewards/:id` - 编辑奖励
- `/points-history` - 积分历史
- `/backpack` - 背包（已兑换奖励）
- `/task-history` - 历史任务实例
- `/settings` - 应用设置
- `/data-import-export` - 数据备份/恢复

---

## 核心业务逻辑

### 任务实例生成

任务实例根据 `TaskTemplate` 的重复规则自动生成：

1. **None**：一次性任务，只生成一个实例
2. **Daily**：每 N 天（由 `repeatInterval` 控制）
3. **Weekly**：在指定星期几（0-6），每 N 周
4. **Monthly**：在指定日期（1-31），每 N 个月

生成逻辑在 `src/libs/task.ts`：

- `shouldGenerateInstanceOnDate()` - 判断指定日期是否应生成实例
- `filterTemplatesNeedingInstancesOnDate()` - 筛选需要生成实例的模板
- `generateTaskInstance()` - 从模板创建实例数据

实例通过 `useTaskInstanceGenerator` Hook 在 `Home.tsx` 中生成。

### 任务完成规则 (v5+)

任务可设置完成规则以支持渐进式进度：

1. **简单**：直接标记完成/未完成
2. **时间制** (`completeRule: 'time'`)：追踪花费的分钟数（如阅读 30 分钟）
3. **计数制** (`completeRule: 'count'`)：追踪重复次数（如喝水 8 次）

进度可手动更新，或通过关联的番茄钟会话自动更新。

### 自定义一天结束时间

用户可配置"一天"何时结束（默认 00:00）。这影响：

- 哪些任务显示在"今日任务"
- 任务实例生成时机
- 统计计算

实现在 `src/libs/time.ts`：

- `getUserStartOfDay()` / `getUserEndOfDay()` - 计算日期边界
- `getUserCurrentDate()` - 根据 dayEndTime 获取有效的"今天"

### 时间处理设计原则

所有时间相关操作遵循**存储/计算用 UTC，显示用本地时间**原则：

| 操作 | 格式 | 方法 | 示例 |
|------|------|------|------|
| **存储** | UTC ISO 8601 | `new Date().toISOString()` | `2026-03-07T15:30:00.000Z` |
| **计算** | UTC | `Date.UTC()`, `getUTCFullYear()` 等 | `Date.UTC(2026, 2, 7)` |
| **显示** | 本地时间 | `toLocaleDateString()`, `getFullYear()` | `2026/3/7` |

**核心函数 (`src/libs/time.ts`)：**

```typescript
// 获取当前 UTC 时间戳
getUTCTimestamp(): string

// 创建 UTC 日期开始/结束
createUTCStartOfDay(year, month, day): Date
createUTCEndOfDay(year, month, day): Date

// 获取今天的 UTC 范围
getTodayUTCRange(): [string, string]

// 计算过期时间（基于 UTC）
calculateExpiredAt(startAtUTC, expireDays, dayEndTime): string

// 检查是否过期（比较 UTC 时间）
isExpired(expiredAtUTC): boolean

// 格式化 UTC 为本地日期字符串
formatLocalDate(date): string
formatLocalDateTime(date): string
```

**使用示例：**

```typescript
// 存储时间戳（服务层）
const now = new Date().toISOString();  // UTC 时间
await db.taskInstances.update(id, { completedAt: now });

// 按日期范围查询
const [startUTC, endUTC] = getTodayUTCRange();
const sessions = await db.pomoSessions
  .where('startedAt')
  .between(startUTC, endUTC)
  .toArray();

// 显示给用户
const displayDate = formatLocalDate(instance.completedAt);
```

### 积分系统

积分流向：

1. **赚取**：完成任务 → `addPoints(amount, 'task_reward', instanceId)`
2. **撤销**：重置已完成任务 → `spendPoints(amount, 'task_undo', instanceId)`
3. **花费**：兑换奖励 → `spendPoints(cost, 'reward_exchange', rewardId)`
4. **调整**：管理员调整 → `addPoints/spendPoints(amount, 'admin_adjustment')`

所有积分变动记录在 `pointsHistory` 表中。当前积分通过历史记录实时计算。

### 番茄钟计时器

专注计时器实现：

- **模式**：专注（默认 25 分钟）、短休息（5 分钟）、长休息（15 分钟）
- **自动开始选项**：休息/专注结束后自动开始下一个
- **音效**：可配置的声音通知
- **任务集成**：可关联任务实例以自动更新进度

### 数据导入/导出

应用支持通过 `exportImportService.ts` 进行 JSON 格式的数据备份/恢复：

- **导出**：将所有数据库表导出为 JSON 文件
- **导入策略**：
  - `overwrite`：清空所有现有数据并导入
  - `merge`：智能合并数据，避免重复

#### ID 保持机制（重要）

**修复时间**：2026-03-09

**问题**：早期版本使用 `bulkAdd` 并在导入时移除 `id` 字段，导致 ID 重新分配，破坏了 `taskInstances` 与 `taskTemplates` 之间的外键关联关系（`templateId` 指向不存在的 ID）。这会导致导入后部分任务实例丢失（orphaned instances）。

**解决方案**：
- 使用 `bulkPut` 替代 `bulkAdd`，保留原始 ID
- 确保 `taskTemplates` 和 `taskInstances` 的 ID 在导入后保持一致
- 相关表：taskTemplates, taskInstances, rewardTemplates, rewardInstances, pointsHistory

**代码位置**：`src/db/services/exportImportService.ts`

```typescript
// 修复前（会导致 ID 错乱）
db.taskTemplates.bulkAdd(
  data.taskTemplates.map(({ id, ...rest }) => rest as TaskTemplate)  // ❌ ID 丢失
)

// 修复后（保持 ID 一致）
db.taskTemplates.bulkPut(data.taskTemplates as TaskTemplate[])  // ✅ 保留原始 ID
```

**注意事项**：
- `bulkPut` 会插入新记录或更新已存在的记录（基于 ID）
- 用户数据仍特殊处理：只导入第一个用户，并强制设置 `id: 1`（保持单用户模式）
- 如果备份中包含 orphaned instances（引用了不存在的 templateId），导入后仍会被查询过滤掉

---

## 安全考虑

### Tauri 权限 (`src-tauri/capabilities/default.json`)

当前允许的权限：

- `core:default` - 基础 Tauri API
- `opener:default` - URL 打开功能
- `dialog:default` - 原生对话框 API
- `fs:allow-write-text-file` - 写入文件（数据导出）
- `fs:allow-read-text-file` - 读取文件（数据导入）

### 内容安全策略

当前在 `tauri.conf.json` 中设为 `null`（开发模式）。生产环境应配置适当的 CSP 限制。

---

## 测试

**当前未配置测试框架。** 建议添加：

- **前端**：Vitest（与 Vite 配合良好）
- **Rust**：内置 `cargo test`

---

## 部署

### 桌面端构建

```bash
bun run tauri build
```

输出到 `src-tauri/target/release/bundle/`

### Android 构建

```bash
bun run tauri android build
```

需要配置 Android SDK 和 NDK。

---

## 移动端优先设计

应用采用移动端优先原则设计：

- 使用安全区边距（`pt-safe`, `pb-safe`）处理刘海屏设备
- 底部导航固定在底部，带安全区填充
- 触摸友好的点击目标
- 使用 Tailwind CSS 的响应式布局
- Viewport meta: `viewport-fit=cover` 实现全屏显示

---

## 开发模式

### 自定义 Hooks 模式

数据获取遵循此模式（见 `src/hooks/useTasks.ts`）：

```typescript
export function useTodayTasks(userId: number) {
  const [tasks, setTasks] = useState<TaskWithTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTodayTaskInstances(userId);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) refresh();
  }, [refresh, userId]);

  return { tasks, isLoading, error, refresh };
}
```

### 服务层模式

数据库操作封装在服务中 (`src/db/services/`)：

```typescript
// 服务函数是异步的，使用 DB 单例
export async function createTaskTemplate(
  template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const db = getDB();
  
  const now = new Date().toISOString();
  const newTemplate: TaskTemplate = {
    ...template,
    createdAt: now,
    updatedAt: now,
  };
  
  return db.taskTemplates.add(newTemplate);
}
```

### 组件模式

**Popup/Modal 使用：**

```typescript
import { Popup } from '@/components/Popup';

<Popup
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  position="bottom" // 或 "center"
  title="弹窗标题"
  maskClosable={true}
>
  {/* 内容 */}
</Popup>
```

**安全区处理：**

```typescript
// 使用 index.css 中的安全区工具类
<div className="min-h-screen-safe pt-safe pb-safe">
  {/* 内容 */}
</div>
```

---

## 资源

- [Tauri 文档](https://tauri.app/develop/)
- [React 文档](https://react.dev)
- [Vite 文档](https://vitejs.dev)
- [Dexie.js 文档](https://dexie.org/)
- [Zustand 文档](https://docs.pmnd.rs/zustand)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- 设计原型参考 `design/` 文件夹

---

## AI Agent 注意事项

- **注释**：代码注释使用中文 - 保持此约定
- **日期处理**：应用使用 UTC 时间进行存储和计算，仅显示时转换为本地时间
- **任务实例生成**：每个模板每天最多生成一个实例
- **用户模型**：当前为单用户，用户 ID 始终为 1
- **积分**：以整数存储在历史记录中，当前积分实时计算
- **番茄钟**：状态由 Zustand store 管理，会话持久化到数据库
- **进度**：带 `completeRule` 的任务追踪进度，番茄钟可自动更新进度
- **过期检查**：应用启动时通过 `useExpiredTaskChecker` Hook 自动检查并更新过期任务
