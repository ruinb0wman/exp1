# 任务等级（level）：删掉手动排序，改为按等级逐级执行

日期：2026-09-18
范围：`src/db/types/task.ts`、`src/libs/task.ts`、`src/db/migrations/index.ts`（新增 v9）、
`src/db/services/taskService/{template,query}.ts`、`src/db/services/exportImportService.ts`、
`src/hooks/{useTasks,useTaskInstanceGenerator}.ts`、`src/pages/AllTasks/*`、
`src/components/{TaskTemplateCard,TaskInstanceCard,TaskDetailPopup}`、`src/pages/EditTask.tsx`、
`src/locales/{zh,en}.json` + 单测
不涉及：无 Rust / tauri 改动，**不新增依赖**，**不改 DB 名（必须保持 `exp-v7`）**。

---

## 0. 目标与已确认的决策

1. `TaskTemplate` 新增**执行等级** `level: number`：1 最先做，等级低的排前面。
2. 删掉现有的手动排序功能（↑/↓ 箭头 + `sortOrder` 字段 + `reorderTaskTemplates`）。
3. 「只在列表里排序，不锁」：高等级任务照常可点、可完成。
4. 列表呈现：平铺 + `L1/L2/L3` 徽标。

用户已确认的四项选择：

| 决策点 | 选择 |
|---|---|
| 等级范围 | 任意正整数，**默认 1**（复用 `NumberInput`，min=1，整数） |
| 旧排序字段 | **彻底删除**，v9 迁移清掉；同等级内按 `createdAt` |
| 逐级执行 | **只排序，不锁** |
| 呈现方式 | 平铺列表 + `L{level}` 徽标（不分组） |

两个我替你定了的默认值（如需改动请说）：

- **旧数据全部回填 `level = 1`**。因为 v8 的 `sortOrder` 本来就是按 `createdAt` 回填的，全设 1 后
  列表顺序与现在**完全一致**；升级后需要你手动把「健身 → 2、看书/工作 → 3」。
- **`sortDisplayTasks` 仍保留「未完成在前」**（现状行为）：首页完成后的等级 1 任务会排在未完成的
  等级 3 任务之后；等级只在同状态组内决定顺序。

---

## 1. 现状（已读代码，逐条对应要改的地方）

- 类型：`src/db/types/task.ts:55-56`
  ```ts
  /** 用户自定义显示顺序（同 userId 内升序，由「全部任务」页的上下箭头维护） */
  sortOrder: number;
  ```
- 排序纯函数：`src/libs/task.ts:399-501` —— `resolveSortOrder` / `compareTemplateOrder` /
  `sortTaskTemplates` / `computeSortOrderUpdates` / `buildTemplateOrderMap` / `sortDisplayTasks`。
- 服务层：`template.ts:5-32` 创建时算 `max(sortOrder)+1`；`template.ts:73-86` `reorderTaskTemplates`；
  `query.ts:47,71` 与 `useTaskInstanceGenerator.ts:172` 里 `buildTemplateOrderMap(...)`。
- UI：`pages/AllTasks/index.tsx:38-57` `handleMove`；`pages/AllTasks/lib.ts:50-84` `moveTemplateOrder`；
  `components/TaskTemplateCard.tsx:85-108` 两个 `ChevronUp/Down` 按钮；`AllTasks/components/TaskList.tsx`
  透传 `onMove/canMove*`；hook 的 `reorder`（`useTasks.ts:142-155`）。
- 迁移：`migrations/index.ts:135-145` v8（**历史版本，不动**，但它 import 的 `computeSortOrderUpdates`
  要从 `libs/task.ts` 删掉 → 需把该函数的搬迁处理掉，见 §2.3）。
- 备份：`exportImportService.ts:29` `BACKUP_VERSION = '1.2'`；`:283-289` 导入旧备份时补 `sortOrder`。
- 首页实例卡片的 `template` 是**快照**（`libs/task.ts:312` `template: { ...template }`），
  `query.ts` 只把实时顺序用于**排序**，不改快照。⇒ 徽标会显示过期等级（见 §2.6 的处理）。

---

## 2. 改法

### 2.1 类型：`src/db/types/task.ts`

删 `sortOrder: number`，换成：

```ts
  enabled: boolean;
  /** 执行等级：1 最先执行，等级低的排在前面（同等级内按 createdAt） */
  level: number;
  subtasks: string[];
```

设为**必填**：迁移回填 + 表单赋值 + 导入兜底三处都覆盖后，仓库内不应再出现缺失该字段的 `TaskTemplate`。
不建 Dexie 索引（从不按 level 查询，只在内存里排序）。

### 2.2 纯函数：`src/libs/task.ts`（文件末尾「模板显示顺序」整段重写）

删除：`resolveSortOrder`、`computeSortOrderUpdates`、`buildTemplateOrderMap`。
改写（保留 `compareTemplateOrder` / `sortTaskTemplates` 的函数名，减少调用点改动）：

```ts
/** 缺失/非法 level 时排到最后（旧数据、手工构造对象） */
const MISSING_LEVEL = Number.MAX_SAFE_INTEGER;

function resolveLevel(template: TaskTemplate): number {
  return typeof template.level === 'number' && Number.isFinite(template.level) && template.level > 0
    ? template.level
    : MISSING_LEVEL;
}

/** 模板比较器：level 升序 → createdAt → id（后两级兜底保证稳定全序） */
export function compareTemplateOrder(a: TaskTemplate, b: TaskTemplate): number { /* level 版 */ }

export function sortTaskTemplates<T extends TaskTemplate>(templates: T[]): T[]  // 签名不变

/** 实时模板等级表：templateId → level（实例快照的 level 会过期，排序以实时表为准） */
export function buildTemplateLevelMap(templates: TaskTemplate[]): Map<string, number>

/**
 * 任务列表顺序：未完成在前，其次按等级升序（再按 createdAt/id）。
 * @param levelByTemplateId 实时模板等级表，缺失时回退快照上的 level
 */
export function sortDisplayTasks<T extends { instance?: TaskInstance; template: TaskTemplate }>(
  items: T[],
  levelByTemplateId?: Map<string, number>
): T[]
```

`STATUS_WEIGHT`（pending=0 / completed=1 / skipped=1）保持不变。

### 2.3 迁移 v9：`src/db/migrations/index.ts`

v8 的升级块**保持原样**（已发布的版本链不动），但它依赖的 `computeSortOrderUpdates` 要从 libs 删除
⇒ 把该函数**内联为本文件的私有 legacy helper**（和文件里已有的 `LegacyRatioField`/`readLegacyRatio`
同一套路），只在 v8 里用：

```ts
/** v9 之前模板上的显示顺序字段（已废弃，仅 v8 迁移使用） */
type LegacySortOrderTemplate = TaskTemplate & { sortOrder?: number };
function computeLegacySortOrderUpdates(templates: LegacySortOrderTemplate[]) { /* 原实现 */ }
```

在文件末尾追加：

```ts
// v9：执行等级 —— 旧模板统一 level=1（保持原 createdAt 相对顺序不变），并清掉废弃的 sortOrder 列
db.version(9).upgrade(async (trans) => {
  const d = trans.db as DB;
  const templates = await d.taskTemplates.toArray();
  const updates = templates.map((t) => ({
    key: t.id,
    changes: {
      level: Number.isFinite((t as { level?: number }).level) && (t as { level?: number }).level! > 0
        ? (t as { level?: number }).level
        : 1,
      // Dexie：显式 undefined 会删除该字段
      sortOrder: undefined,
    },
  }));
  if (updates.length > 0) await d.taskTemplates.bulkUpdate(updates);
});
```

### 2.4 服务层

**`src/db/services/taskService/template.ts`**

- `createTaskTemplate` 入参类型去掉 `'sortOrder'`，**不再需要事务/取 max**（直接 add，`level` 由表单给）：
  ```ts
  export async function createTaskTemplate(
    template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string>
  ```
- 删掉 `reorderTaskTemplates`（及 `taskService/index.ts` 的 `export * from './template'` 自动失效）。
- `getAllTaskTemplates` / `getEnabledTaskTemplates` / `getTaskTemplatesByRepeatMode` 里的
  `sortTaskTemplates(...)` **不动** —— 函数名没变，行为自动变成「按 level」。

**`src/db/services/taskService/query.ts`**（首页今日 / No Date 两个查询）

- `buildTemplateOrderMap` → `buildTemplateLevelMap`。
- **同时把实时 level 覆盖进返回的 template 快照**，否则「改了等级 → 列表重排了，但卡片上的 L 徽标还是旧值」：
  ```ts
  // 实例里的 template 是快照（历史语义，保持不变）；level 只影响排序与徽标，
  // 必须取实时模板值，否则改了等级当天徽标不跟随。
  return sortDisplayTasks(pairs, levelMap).map(({ instance, template }) => ({
    instance,
    template: { ...template, level: levelMap.get(template.id) ?? template.level },
  }));
  ```

### 2.5 hooks

- `src/hooks/useTasks.ts`：删 `reorderTaskTemplates` import 与 `reorder`（连同 `useTaskTemplateActions`
  返回值里的 `reorder`）；`create` 的入参类型去掉 `'sortOrder'`（`level` 现在是必填字段，随 `taskData` 进来）。
- `src/hooks/useTaskInstanceGenerator.ts:138,172`：注释与 `buildTemplateOrderMap` 改名（该函数返回的
  template 本来就取自实时模板表，无需合并）。

### 2.6 UI

**`src/pages/AllTasks/index.tsx`**：删 `reorder` / `handleMove` / `moveTemplateOrder` import 与 `onMove` 传参。

**`src/pages/AllTasks/lib.ts`**：删 `moveTemplateOrder`；新增徽标配色（供列表与首页卡片共用，
沿用 `repeatModeColorMap` 放在这里的既有先例）：

```ts
/** 等级徽标配色：等级越低越「绿」，4 级及以上走中性色 */
export function levelBadgeClass(level: number): string {
  switch (level) {
    case 1: return "bg-green-500/20 text-green-400";
    case 2: return "bg-blue-500/20 text-blue-400";
    case 3: return "bg-purple-500/20 text-purple-400";
    default: return "bg-text-muted/20 text-text-muted";
  }
}
```

**`src/pages/AllTasks/components/TaskList.tsx`**：去掉 `onMove` prop 与 `canMoveUp/canMoveDown` 计算。

**`src/components/TaskTemplateCard.tsx`**：删 `onMoveUp/onMoveDown/canMoveUp/canMoveDown` props、
两个按钮与 `ChevronUp/ChevronDown` import；在 `repeatModeMap` 徽标旁加等级徽标（文案就用语言中性的
`L{level}`，与旁边英文的 `Daily/Weekly` 徽标风格一致，不需要 i18n key）：

```tsx
<span className={`text-xs px-2 py-0.5 rounded-full ${levelBadgeClass(level)}`}>L{level}</span>
```

**`src/components/TaskInstanceCard/index.tsx`**：同理加一个 `L{level}` 徽标
（`import { levelBadgeClass } from "@/pages/AllTasks/lib"`，该文件已经在引 `repeatModeMap`）。
依赖 §2.4 的实时 level 覆盖，改等级后当天徽标会立刻跟随。

**`src/components/TaskDetailPopup.tsx`**：在「重复」行下方加一行等级（图标 `Layers`，
标签 `t('home.detail.level')`，值 `L{template.level}`）。可选但成本极低。

**`src/pages/EditTask.tsx`**

- 新增状态：`const [level, setLevel] = useState(1);`
- 加载：`setLevel(existingTemplate.level && existingTemplate.level > 0 ? existingTemplate.level : 1);`
- `taskData` 类型改为 `Omit<TaskTemplate, "id" | "createdAt" | "updatedAt">`，并加 `level,`
  （**不再有 sortOrder**，所以不存在「保存表单把顺序写坏」的老问题）。
- UI：放进「Main Task Details Card」的 Enabled 下方：

```tsx
<div className="flex items-center gap-4 min-h-14 justify-between pt-2 border-t border-surface-light">
  <div>
    <p className="text-text-primary text-base font-normal leading-normal">{t("editTask.level")}</p>
    <p className="text-text-muted text-xs mt-0.5">{t("editTask.levelHint")}</p>
  </div>
  <NumberInput value={level} onChange={setLevel} min={1} size="md" inputWidth="w-12" />
</div>
```

### 2.7 i18n：`src/locales/zh.json` / `en.json`（两文件必须同步改）

- `allTasks`：**删** `moveUp` / `moveDown`。
- `allTasks`：加 `"level": "等级"` / `"Level"`（备用，编辑页与详情页用得上）。
- `editTask`：加 `"level": "执行等级"` / `"Level"`、`"levelHint": "数字越小越先做"` /
  `"Lower runs first"`。
- `home.detail`：加 `"level": "等级"` / `"Level"`。

（`locales.test.ts` 只校验它列出的 header key，不加也能过；但 zh/en 必须同时加，否则切语言漏 key 字面量。）

### 2.8 备份：`src/db/services/exportImportService.ts`

- `BACKUP_VERSION` `'1.2'` → `'1.3'`（字段变更，导入预览的版本号要能区分）。
- 把「按 createdAt 补 sortOrder」换成「补齐 level」：

```ts
// 旧备份里的模板没有 level：统一补 1（保持导入后的相对顺序 = createdAt）
const levelUpdates = (await db.taskTemplates.toArray())
  .filter((t) => !Number.isFinite((t as { level?: number }).level))
  .map((t) => ({ key: t.id, changes: { level: 1 } }));
if (levelUpdates.length > 0) {
  await db.taskTemplates.bulkUpdate(levelUpdates);
}
```

新备份里 `level` 已就位（导出是整对象搬运），会跳过这段，不额外触发中间件。

---

## 3. 实施步骤（每步可独立验证）

| # | 步骤 | 触及文件 | 验证 |
|---|---|---|---|
| 1 | 类型换字段 + 排序纯函数重写 | `src/db/types/task.ts`、`src/libs/task.ts` | `bunx tsc --noEmit` 报错点正好是待修的构造点（§4） |
| 2 | 迁移 v9 + legacy helper 内联 | `src/db/migrations/index.ts` | 新 `index.v9.test.ts` 通过 |
| 3 | 模板服务：删 reorder、创建不再算 max | `src/db/services/taskService/template.ts` | `bunx vitest run src/db/services/taskService/template.test.ts` |
| 4 | 实例查询改用实时 level 表（并覆盖快照 level） | `src/db/services/taskService/query.ts` | tsc + 上一步测试 |
| 5 | hooks 收尾 | `src/hooks/useTasks.ts`、`src/hooks/useTaskInstanceGenerator.ts` | `bunx tsc --noEmit` |
| 6 | UI：删箭头、加徽标、编辑页加等级 | AllTasks 3 个文件 + `TaskTemplateCard` + `TaskInstanceCard` + `TaskDetailPopup` + `EditTask` | `bunx vitest run src/pages/AllTasks` + tsc |
| 7 | i18n 增删 + 两颗语言同步 | `src/locales/{zh,en}.json` | `bunx vitest run src/locales` |
| 8 | 备份版本与导入兜底 | `exportImportService.ts`(+test) | `bunx vitest run src/db/services/exportImportService.test.ts` |
| 9 | 修测试工厂里的 `sortOrder` 字段 | `libs/task.test.ts`、`reportService.test.ts`、`libs/report/aggregate.test.ts` | `bunx tsc --noEmit` 归零 |
| 10 | 全量回归 | — | `bunx tsc --noEmit`、`bunx vitest`、`bun run build` |
| 11 | 手测 | — | 见下 |

手测清单（真机或 `bun run dev` + bow）：

1. 「全部任务」页：把 A 改 3 级、B 改 2 级、C 留 1 级 → 列表变 `C(B?)` 顺序 = 1→2→3，卡片徽标正确，箭头按钮已消失。
2. 首页今日列表：改等级后（不重启、不清实例）顺序与徽标**同时**变化 → 证明实时表生效。
3. 完成一项 1 级任务 → 该任务落到未完成项之后（保持「未完成在前」）。
4. 在编辑页把等级调到 5 → 徽标显示 `L5`，配色走中性色。
5. 从升级前的库切入（真机原地升级）：今日任务不丢、可交互，各模板 `level = 1`，DB 里不再有 `sortOrder` 键。

---

## 4. 需要跟着改的测试与夹具

- `src/libs/task.test.ts`：`createTemplate` 工厂 `sortOrder: 0` → `level: 1`；把
  `describe("模板显示顺序")` 整段重写为 level 语义（level 升序 / 缺失排最后 / 同 level 按 createdAt 再 id /
  `sortDisplayTasks` 未完成在前 + 组内按 level / `buildTemplateLevelMap`）；删 `computeSortOrderUpdates` 用例。
- `src/pages/AllTasks/lib.test.ts`：删 `moveTemplateOrder` 全部用例，改为 `levelBadgeClass` 的小测试
  （保留文件，避免空文件）。
- `src/db/services/taskService/template.test.ts`：工厂补 `level`；删 `reorderTaskTemplates` 三例；
  新增「createTaskTemplate 保留传入的 level」。
- `src/db/migrations/index.v8.test.ts`：**删除**（v9 会清掉它断言的那个字段，v8 的产物在真实升级路径里
  已不可观测）。
- `src/db/migrations/index.v8.middleware.test.ts` → 改名 `index.v9.middleware.test.ts`：核心断言
  （已存在的今日实例不丢、中间件补生成、幂等）保持，只把两行 `sortOrder` 断言换成 `level === 1`；
  文件头注释改为说明「升级期间的中间件行为」。
- **新增** `src/db/migrations/index.v9.test.ts`：以 v7 结构（无 level、有/无 sortOrder）建库 → 触发真实升级 →
  断言每个模板 `level === 1`、`sortOrder` 键已不存在、多用户不影响、重开一次结果不变。
- `src/db/services/exportImportService.test.ts`：`expect(exported.version).toBe('1.2')` → `'1.3'`；
  「旧备份补 sortOrder」用例改为「旧备份补 level = 1」（模板工厂去掉 sortOrder 注释）。
- 夹具补字段：`src/db/services/reportService.test.ts:34`、`src/libs/report/aggregate.test.ts:39`
  （`sortOrder: 0` → `level: 1`）。其余 `as unknown as TaskTemplate` 的构造点（`instance.test.ts`、
  `achievementService.test.ts`、`libs/achievement/metrics.test.ts`）不受类型影响，可不改。

---

## 5. 风险与未定项

1. **v9 的 `bulkUpdate` 会触发 `taskTemplateMiddleware`**（同 v8 已知副作用）：每个模板在
   `trans.on('complete')` 里跑一次 `checkAndGenerateForTemplate`，升级瞬间有一批 DB 读。
   生成逻辑幂等（今天已有实例即早退），且 v8 已有先例；`index.v9.middleware.test.ts` 专门覆盖。
   真机原地升级时留意「点开图标 → 首页可交互」的耗时（这条在 scratchpad 里本来就挂着）。
2. **DB 名必须保持 `exp-v7`**：改成 `exp-v8`/`exp-v9` 等于新建空库、用户数据全丢。
3. **`changes: { level, sortOrder: undefined }` 能否穿透 `updating` 钩子**（`db/index.ts:57` 的
   `{updatedAt}` 与中间件的钩子）：v8 的 `{sortOrder}` 已被证明能落库，v9 走同一路径；由 v9 测试的
   「`sortOrder` 键不存在 + `level === 1`」两条断言兜住。若真出现钩子覆盖，退路是 v9 只写 `level`，
   `sortOrder` 留在库里不再读写（不影响任何行为）。
4. **`skipped` 与 `completed` 同权重**（现状保留）：两者都在 pending 之后，组内再按 level 排。
5. **同等级内没有手动微调能力**（本次刻意删掉）：若要给同等级排序，只能改「创建时间」以外无解，
   后续想加就把 `level` 改成小数（1.5）或引入组内 `order` —— 属于新需求。
6. **`getTaskInstancesByDate`（`instance.ts`，当前无调用方）不参与排序**，保持既有不一致点。
7. **报告页（`reportService` / `libs/report/aggregate.ts`）里的榜单排序**不跟随 level（那是按完成数排名），
   符合原意；若要让报告也按等级排，是另一个需求。
8. **无 UI 自动化**：项目没有 `@testing-library/react`，徽标与按钮的呈现只能靠 tsc + 真机手测；
   排序/迁移/导入三条逻辑由单测兜住。

---

## 6. 完成后记（2026-09-18）

已按上述方案实现并验证：

- `bunx tsc --noEmit` 干净 · `bunx vitest run` **23 文件 / 246 用例全绿** · `bun run build` 成功。
- 净变化 −160 行（26 个文件），`sortOrder` 只剩两处**故意保留**的引用：v8 迁移的历史逻辑、
  `index.v9.test.ts` 里「旧库带 sortOrder」的构造与断言。

**与计划的两处偏离**

1. **多修了一个真实竞态**：v9 的 `bulkUpdate` 会让 v8/v9 两轮升级各触发一次
   `checkAndGenerateForTemplate`，同一模板被并发检查两次 → 两边都判定「今天还没有实例」→
   `add` 同一个哈希 id → 后写入者抛 `ConstraintError`，且因在 `trans.on('complete')` 里
   重新抛出而变成 unhandled rejection（`index.v9.middleware.test.ts` 真的抓到了它）。
   修法：`checkAndGenerateForTemplate` 的非 `none` 分支把 `taskInstances.add` 包进 try/catch，
   唯一键冲突视为「已被另一轮生成」返回 `false`（`none` 分支早有等价保护）。
   注意：**真实用户从 v8 升到 v9 只有一轮**，不会触发；这条路径只在 v7→v9 的测试里出现。
2. v8 的升级块**保留原样**（只是把 `computeSortOrderUpdates` 内联成本文件的私有 legacy helper），
   没有把它删掉合并进 v9——已发布的版本链不动，代价只是 v7 老库升级时多一轮 bulkUpdate。

**真浏览器实测（bow + 运行中的 vite dev server，库已被 v9 升到 90=version*10）**

1. 按「工作(3) → 遛狗(1) → 健身(2)」的**创建顺序**建三条任务，列表与首页都排成
   `遛狗 L1 / 健身 L2 / 工作 L3` → 排序确实只看 level，不看创建顺序。
2. 「全部任务」页：卡片带 `L1/L2/L3` 徽标，**上移/下移按钮 0 个**（`svg.lucide-chevron-up/down` 计数为 0）。
3. 编辑页打开「工作」：等级输入框回填 **3**（读取路径正确）；改成 1 保存后
   DB 里模板 level=1，而**实例快照仍是 3** —— 首页立刻变成 `工作 L1 / 遛狗 L1 / 健身 L2`，
   且「工作」卡片徽标显示 **L1** → 证实 §2.4 的实时 level 覆盖生效（否则这里会显示旧等级）。
4. 完成「工作」（L1）→ 它落到未完成项之后（`遛狗 / 健身 / 工作`），即「未完成在前」保持不变。
5. 详情 popup 显示 `等级 L2`。

验证用的三条任务与实例已从 dev 库清掉；清理时误删了 dev 库里原有的一条 10 分记录，已按原分值补回
（`type: admin_adjustment`，描述里写明了原因），首页仍显示 10 exp。

**仍未做（留给你）**：真机原地升级（v8 → v9）的耗时与「今日任务不丢」需在手机上确认；
升级后所有旧任务都是 1 级，要手动把「健身 → 2、看书/工作 → 3」。
