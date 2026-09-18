# 任务模板自定义顺序：首页实例与 Stats 预览都跟随

日期：2026-09-18
范围：`src/db/types/task.ts`（加字段）、`src/libs/task.ts`（排序纯函数）、`src/db/migrations/index.ts`（v8 回填）、`src/db/services/taskService/{template,query}.ts`、`src/db/services/exportImportService.ts`、`src/hooks/useTaskInstanceGenerator.ts`、`src/hooks/useTasks.ts`、`src/pages/AllTasks/{index.tsx,lib.ts,components/TaskList.tsx}`、`src/components/TaskTemplateCard.tsx`、`src/pages/EditTask.tsx`、`src/locales/{zh,en}.json` + 单测
不涉及：无 Rust / tauri 改动，**不新增依赖**。

---

## 1. 目标

1. `TaskTemplate` 有用户可调的显示顺序（新字段 `sortOrder`）。
2. 「全部任务」页面可以用 **↑/↓ 箭头按钮**调整顺序（已确认：不用拖动库，Android 触屏更可靠）。
3. 首页今日实例列表、首页「No Date」列表、番茄钟任务选择器都遵循该顺序，且**未完成在前、已完成/已跳过在后**（组内仍按模板顺序）。
4. Stats 页（日历页）选定日期后的列表——包括未生成实例的 **Preview** 项——遵循同一顺序。
5. 旧数据（无该字段）升级后自动按 `createdAt` 顺序回填；导入旧备份同样兜底。

---

## 2. 现状（已读代码）

### 2.1 目前根本没有顺序字段，顺序是「随机的」

`src/db/types/task.ts` 的 `TaskTemplate` 只有 `createdAt` / `updatedAt?`，没有任何排序字段（全仓 grep `order`/`sortOrder` 在 db 层为 0 命中）。

### 2.2 首页顺序 = 实例表主键顺序

`src/store/taskStore.ts:43-47` → `getTodayTaskInstances`（`src/db/services/taskService/query.ts:25-46`）：

```ts
const instances = await db.taskInstances
  .where('instanceDate')
  .equals(todayStr)
  .and(...)
  .toArray();
return instances.map((instance) => ({ instance, template: instance.template! }));
```

没有 `sort`。而实例 id 是哈希派生的（`src/libs/id.ts:22` `hashTaskInstance` → FNV-1a 十六进制串），所以在索引命中后基本是**哈希序**，与用户预期的顺序无关。

### 2.3 Stats 预览顺序 = 两段拼接，且两段各自无序

`src/hooks/useTaskInstanceGenerator.ts:119-172` 的 `getDisplayTasksForDate`：

```ts
for (const [templateId, instance] of templateInstanceMap) {   // 已有实例：allInstances 顺序
  result.push({ template, instance, isPreview: false });
}
for (const template of templatesNeedingInstances) {           // 预览项：模板表顺序
  if (!templateInstanceMap.has(template.id!)) {
    result.push({ template, isPreview: true });
  }
}
```

所以「实例在前、预览在后」是固定拼接，两者内部都没有业务顺序。

### 2.4 可复用的现状

- `getAllTaskTemplates` / `getEnabledTaskTemplates`（`template.ts:19-36`）直接 `toArray()`，也没有 `sort` → 只要在这两个函数里排序，AllTasks 页面、Stats 预览、实例生成顺序一起受益。
- 实例里存的是**模板快照** `template: { ...template }`（`src/libs/task.ts:312`），且模板被编辑时**不会**同步到旧实例。因此**不能**用快照里的 `sortOrder` 排序（用户改完顺序，今天已生成的实例不会跟着变），排序必须查**实时模板表**。
- Stats 的 Preview 徽标在 `src/pages/Stats.tsx:207-211`（`{!isSelectedToday && selectedDate && <span>Preview</span>}`），列表来自 `getDisplayTasksForDate`，所以改这一个函数即可覆盖需求 4。
- `TaskTemplateCard` 只被 `src/pages/AllTasks/components/TaskList.tsx` 使用，加按钮不会影响别处。
- 导出/导入是整对象搬运（`exportAllData` 直接 `toArray()`），新字段会自动进备份；但**旧备份没有该字段**，导入后需要兜底。

---

## 3. 改法

### 3.1 类型：`TaskTemplate.sortOrder: number`

`src/db/types/task.ts`，加在 `enabled` 之后、`createdAt` 之前：

```ts
  enabled: boolean;
  /** 用户自定义显示顺序（同 userId 内升序，由「全部任务」页的上下箭头维护） */
  sortOrder: number;
  subtasks: string[];
```

设为**必填**：v8 迁移回填 + 创建时赋值 + 导入时兜底，三处都覆盖后，仓库内不应再出现缺失该字段的 `TaskTemplate`。

### 3.2 纯函数：`src/libs/task.ts`

三件事都在纯函数里做，方便单测：

```ts
/** 模板顺序比较器：sortOrder 升序 → createdAt → id（保证全序稳定） */
export function compareTemplateOrder(a: TaskTemplate, b: TaskTemplate): number;

/** 排序副本（不改原数组） */
export function sortTaskTemplates<T extends TaskTemplate>(templates: T[]): T[];

/**
 * 计算每个用户模板应有的 sortOrder（按现有 sortOrder 缺失→最后、再 createdAt、再 id 排序后重编号 0..n-1）
 * 用于 v8 迁移、旧备份导入、以及「首次重排」时的归一化
 */
export function computeSortOrderUpdates(
  templates: TaskTemplate[]
): Array<{ id: string; sortOrder: number }>;

/**
 * 列表排序：pending 在前，然后按模板顺序
 * @param orderByTemplateId 实时模板顺序（查 taskTemplates 表得到），缺失时回退 template.sortOrder
 */
export function sortDisplayTasks<T extends { instance: TaskInstance; template: TaskTemplate }>(
  items: T[],
  orderByTemplateId?: Map<string, number>
): T[];
```

`sortDisplayTasks` 的状态权重：`pending = 0`，`completed` / `skipped` = `1`（同权重，组内仍按模板顺序）。这是你选的「未完成在前，已完成在后」。

### 3.3 迁移 v8：回填 `sortOrder`

`src/db/migrations/index.ts` 末尾追加（保持 DB 名 `exp-v7` 不变，改名＝换新库＝丢数据）：

```ts
// v8：模板自定义顺序 —— 按 createdAt 顺序回填 sortOrder
db.version(8).upgrade(async (trans) => {
  const d = trans.db as DB;
  const updates = computeSortOrderUpdates(await d.taskTemplates.toArray());
  if (updates.length > 0) {
    await d.taskTemplates.bulkUpdate(
      updates.map(({ id, sortOrder }) => ({ key: id, changes: { sortOrder } }))
    );
  }
});
```

`computeSortOrderUpdates` 对「已经是 0..n-1 且顺序一致」的数据返回空数组，所以重复执行是幂等的。

### 3.4 服务层

**`src/db/services/taskService/template.ts`**

- `createTaskTemplate` 入参类型加 `'sortOrder'`：`Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>`；在事务里取该用户现有 `max(sortOrder)` 后赋 `max + 1`（**追加到末尾**）。
- `getAllTaskTemplates` / `getEnabledTaskTemplates` / `getTaskTemplatesByRepeatMode` 的返回值统一过 `sortTaskTemplates(...)`。
- 新增：

```ts
/** 按数组下标重写该用户的模板顺序（一次 bulkUpdate） */
export async function reorderTaskTemplates(orderedIds: string[]): Promise<void>;
```

实现为 `db.transaction('rw', db.taskTemplates, ...)` + 一次 `bulkUpdate([{key, changes: {sortOrder: index}}])`。

**`src/db/services/taskService/query.ts`**

- `getTodayTaskInstances` / `getNoDateTaskInstances`：先 `db.taskTemplates.where('userId').equals(userId).toArray()` 建 `Map<templateId, sortOrder>`，再 `return sortDisplayTasks(pairs, orderMap)`。`template` 字段仍然返回**实例里的快照**（保持既有语义：历史快照不被当前模板覆盖），只把实时顺序用于排序。
- `getTaskInstancesByDate`（`instance.ts`，目前无调用方，只有 `useTasks.ts` 里一个未使用的 hook）不动，在计划末尾记为已知不一致点。

### 3.5 Stats 预览：`useTaskInstanceGenerator.getDisplayTasksForDate`

把「先实例后预览」的两段拼接改成「按模板顺序遍历，命中实例就用实例，否则出预览」：

```ts
const ordered = sortTaskTemplates(templates);              // getEnabledTaskTemplates 已有序，这里再显式保证
const result = ordered.map((template) => {
  const instance = templateInstanceMap.get(template.id!);
  return instance
    ? { template, instance, isPreview: false }
    : { template, isPreview: true };
});
return sortDisplayTasks(result, buildOrderMap(ordered));   // pending 在前，再按模板顺序
```

行为差异只有一处：**「已有实例」与「预览」不再分段**，而是混排在同一模板顺序里（这正是需求 4 的要点）。被停用模板的实例仍然不会出现（现状如此，保持不变）。

另外 `getTemplatesForDate` 走的是同一个 `getEnabledTaskTemplates`，所以新实例的**生成顺序**也会跟随模板顺序（附带的顺序改善）。

### 3.6 UI：AllTasks 页的 ↑/↓ 按钮

**`src/pages/AllTasks/lib.ts`** 新增纯函数（可单测）：

```ts
/**
 * 计算交换顺序后的完整 id 列表
 * @param orderedIds  当前全量顺序（含被筛选隐藏的模板）
 * @param visibleIds  当前筛选后可见的模板
 * @param movingId    被移动的模板
 * @param direction   -1 上移 / 1 下移
 * @returns 交换后的完整顺序；没有可交换的可见邻居时返回 null
 */
export function moveTemplateOrder(
  orderedIds: string[],
  visibleIds: string[],
  movingId: string,
  direction: -1 | 1
): string[] | null;
```

语义：在 `visibleIds` 中找 `movingId` 的可见邻居，交换两者在 `orderedIds` 中的位置。这样在「Daily」筛选视图里点 ↑，只会跳过被隐藏的模板，**隐藏项的相互顺序不变**。

**`src/pages/AllTasks/index.tsx`**

```ts
const { reorder } = useTaskTemplateActions();           // 新增

const handleMove = async (id: string, direction: -1 | 1) => {
  const next = moveTemplateOrder(
    templates.map(t => t.id!),                            // 全量（已排序）
    filteredTemplates.map(t => t.id!),                    // 可见
    id,
    direction
  );
  if (!next) return;
  await reorder(next);                                    // 落库
  await refresh();                                        // 重新拉取
};
```

把 `onMoveUp/onMoveDown/canMoveUp/canMoveDown` 透传到 `AllTasks/components/TaskList` → `TaskTemplateCard`。`canMove*` 由 `filteredTemplates` 里的位置决定（首个的 ↑ 置灰、末个的 ↓ 置灰）。

**`src/pages/AllTasks/components/TaskList.tsx`**：`templates.map` 时按下标算出 `canMoveUp/CanMoveDown` 并传下去。

**`src/components/TaskTemplateCard.tsx`**：新增**可选** props（不传就不渲染，别的调用方不受影响）：

```ts
  onMoveUp?: (e: React.MouseEvent) => void;
  onMoveDown?: (e: React.MouseEvent) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
```

在 Enable/Delete 按钮**之前**插入一组 `ChevronUp` / `ChevronDown`（`lucide-react` 已有，`ChevronRight` 正在用），`disabled` 时 `opacity-40`，`title`/`aria-label` 走 i18n。

**`src/hooks/useTasks.ts`**：`useTaskTemplateActions` 增加

```ts
const reorder = useCallback(async (orderedIds: string[]) => { await reorderTaskTemplates(orderedIds); }, []);
```

并同步 `create` 的入参类型（去掉 `sortOrder`）。

### 3.7 `EditTask.tsx` 的类型跟随

`src/pages/EditTask.tsx:222` 的 `taskData` 类型改为

```ts
const taskData: Omit<TaskTemplate, "id" | "createdAt" | "updatedAt" | "sortOrder"> = { ... };
```

`update(templateId, taskData)` 仍然合法（它接的是 `Partial<...>`），且**编辑任务不会覆盖已有 sortOrder**——这是必须的：如果 `taskData` 里带 `sortOrder`，保存表单就会把顺序写坏。

### 3.8 导入兜底 + 备份版本

`src/db/services/exportImportService.ts`：

- `BACKUP_VERSION` `'1.1'` → `'1.2'`（新增字段，导入预览里显示的版本号要能区分）。
- `importWithOverwrite` 的 `db.taskTemplates.bulkPut(...)` 之后（**同一事务内**）追加归一化：

```ts
await db.taskTemplates.bulkPut(data.taskTemplates as TaskTemplate[]);
const orderUpdates = computeSortOrderUpdates(await db.taskTemplates.toArray());
if (orderUpdates.length > 0) {
  await db.taskTemplates.bulkUpdate(
    orderUpdates.map(({ id, sortOrder }) => ({ key: id, changes: { sortOrder } }))
  );
}
```

旧备份（无 `sortOrder`）导入后按 `createdAt` 顺序获得 0..n-1；新备份（`sortOrder` 已正确）重编号后相对顺序不变。

### 3.9 i18n

`src/locales/zh.json` / `en.json` 的 `allTasks` 下各加两条（`locales.test.ts` 只校验它列出的 header key，不加也能过，但两文件必须同时加，否则语言切换会漏 key 字面量）：

```json
"moveUp": "上移",   /  "Move up"
"moveDown": "下移"  /  "Move down"
```

---

## 4. 实施步骤（每步可独立验证）

| # | 步骤 | 触及文件 | 验证 |
|---|---|---|---|
| 1 | 加 `sortOrder: number` 字段与排序纯函数 | `src/db/types/task.ts`、`src/libs/task.ts` | `bunx tsc --noEmit`：报错点正好是待修的几处构造点（见 #7） |
| 2 | v8 迁移回填 + 迁移单测 | `src/db/migrations/index.ts`、`src/db/migrations/index.test.ts` | `bunx vitest run src/db/migrations` |
| 3 | 模板服务：创建赋值 / 查询排序 / `reorderTaskTemplates` | `src/db/services/taskService/template.ts` + 新建 `template.test.ts` | `bunx vitest run src/db/services/taskService/template.test.ts` |
| 4 | 实例查询接入实时顺序 + pending 优先 | `src/db/services/taskService/query.ts` | 上一步测试 + tsc |
| 5 | Stats 预览按模板顺序混排 | `src/hooks/useTaskInstanceGenerator.ts` | tsc + 手动（Stats 选非今天日期看 Preview 顺序） |
| 6 | AllTasks UI（lib 纯函数 + hook + 卡片按钮 + i18n） | `src/pages/AllTasks/lib.ts`(+`lib.test.ts`)、`index.tsx`、`components/TaskList.tsx`、`src/components/TaskTemplateCard.tsx`、`src/hooks/useTasks.ts`、`src/locales/*.json` | `bunx vitest run src/pages/AllTasks/lib.test.ts` + `bunx vitest run src/locales` |
| 7 | 修 `EditTask.tsx` 的 `taskData` 类型；补齐 3 个测试工厂的 `sortOrder` | `src/pages/EditTask.tsx`、`src/libs/task.test.ts`、`src/db/services/reportService.test.ts`、`src/libs/report/aggregate.test.ts` | `bunx tsc --noEmit` 归零 |
| 8 | 导入兜底 + 备份版本 1.2 | `src/db/services/exportImportService.ts`、`exportImportService.test.ts` | `bunx vitest run src/db/services/exportImportService.test.ts`（断言 `'1.1'` → `'1.2'`，新增旧备份归一化用例） |
| 9 | 全量回归 | — | `bunx vitest`、`bunx tsc --noEmit`、`bun run build` |
| 10 | 真机/浏览器手测 | — | `bun run dev`：AllTasks 上移两项 → 首页顺序同步变化；Stats 选明天 → Preview 顺序一致；完成后该项落到列表底部 |

新增/修改的测试清单：

- `src/libs/task.test.ts`：`createTemplate` 工厂补 `sortOrder: 0`；新增 `describe` 覆盖 `sortTaskTemplates`（sortOrder 优先、缺失回退 createdAt、id 兜底）、`sortDisplayTasks`（pending 在前 + 组内顺序）、`computeSortOrderUpdates`（幂等、跨用户互不影响）。
- `src/pages/AllTasks/lib.test.ts`（新）：`moveTemplateOrder` 的边界（首项上移返回 null、末项下移返回 null、筛选视图下跳过隐藏项、`visibleIds` 全量时等价于相邻交换）。
- `src/db/services/taskService/template.test.ts`（新）：`createTaskTemplate` 追加到末尾（`max+1`）；`reorderTaskTemplates` 后 `getAllTaskTemplates` 顺序即为传入顺序；跨用户不被对方的顺序影响。
- `src/db/migrations/index.test.ts`：新增一例——用 v7 结构写入 3 条无 `sortOrder` 的模板（`createdAt` 乱序），`getDB()` 升级后按 `createdAt` 得到 0/1/2。
- `src/db/services/exportImportService.test.ts`：版本断言改 `'1.2'`；新增「旧备份（模板无 sortOrder）导入后批量获得 sortOrder」。

---

## 5. 风险与未定项

1. **DB 版本升级的副作用（主要风险）**：v8 的 `bulkUpdate` 会触发 `taskTemplateMiddleware` 注册的 `taskTemplates.hook('updating')`，其 `trans.on('complete')` 会对**每个**模板跑一次 `checkAndGenerateForTemplate`（`src/db/middleware/taskTemplateMiddleware.ts:296-308`）。生成逻辑幂等（今天已有实例就早退），且 v4 迁移已有同类先例；但升级瞬间会有一批 DB 读。若真机升级后出现异常，退路是：v8 不动数据，改在 `getAllTaskTemplates`/`getEnabledTaskTemplates` 里对缺失者做一次懒归一化。**手测第 10 步必须覆盖「升级后今日任务仍在」**。
2. **DB 名必须保持 `exp-v7`**：改 `new Dexie('exp-v8')` 等于新建空库，用户数据全丢。
3. **`taskInstances.template.sortOrder` 快照会过期**：这是刻意接受的——排序一律以实时 `taskTemplates.sortOrder` 为准，因此不需要在重排时批量回写 N 条实例（也就不需要碰实例表）。
4. **重排会触发 N 次中间件检查**：每次点箭头是一次 `bulkUpdate`，代价与模板数成正比（个人应用量级可忽略）。若真机上感觉卡，退路是只交换两条（两条 `update`）而不全量重编号。
5. **`updatedAt` 是否真的被写**：`db/index.ts:57` 与中间件都注册了 `taskTemplates` 的 `updating` 钩子，Dexie 对同名钩子的多次注册语义（覆盖 vs 链式）我没有实证。这不影响 `sortOrder` 落库（钩子不修改 mods），但如果发现重排后 `updatedAt` 不变，属既有行为，不在本次范围内修。
6. **组内顺序未定项**：`completed` 与 `skipped` 我按同一权重处理（都排到 pending 之后，两者之间仍按模板顺序）。若你希望「已完成」和「已跳过」再分组，只需改 `sortDisplayTasks` 里的权重常量。
7. **`getTaskInstancesByDate` 未参与排序**：它返回裸 `TaskInstance[]`，而顺序需要模板表，当前无调用方（`useTasks.ts:178` 的 `useTasksByDate` 是死代码）。本次不动它，留作已知不一致点。
8. **`reportService` / `aggregate.ts:372` 的报告排序**不跟随模板顺序（那里是按完成数排名的榜单），符合原意；如果想让报告里的「任务概览」也按用户顺序排，是另一个需求。
9. **无 UI 自动化覆盖**：项目没有 `@testing-library/react`（`package.json` 只有 vitest + jsdom），箭头按钮的点击行为只能靠 `moveTemplateOrder` 纯函数单测 + 真机手测来保证。

---

## 6. 完成后记（2026-09-18）

已按上述方案实现并验证：

- `bunx tsc --noEmit` / `bunx vitest run`（22 文件、253 测试）/ `bun run build` 全绿。
- 新增测试：`src/libs/task.test.ts` 的顺序三件套、`src/pages/AllTasks/lib.test.ts`、
  `src/db/services/taskService/template.test.ts`、`src/db/migrations/index.v8.test.ts`
  （v8 迁移单独一个文件：`index.test.ts` 已经先打开过 `getDB()` 单例，同文件内模拟不了 v7→v8）。
- 真浏览器（bow + 运行中的 vite dev server）实测通过：
  1. 「全部任务」页点 ↓ 后 DB 与 UI 同时变为 `BBB:0, CCC:1, AAA:2`；首项 ↑ / 末项 ↓ 正确置灰。
  2. 直接改 DB 里的 `sortOrder`（实例快照仍是旧值），首页立刻按新顺序重排 → 证实排序取的是实时模板表而非快照。
  3. 把一项标为 completed，首页与 Stats 都把它排到未完成之后。
  4. Stats 选 9/19：真实实例（AAA）与两条预览项混排为 `BBB, CCC, AAA`，
     即旧实现「实例在前、预览在后」的分段已消失。
- 与计划的一处偏离：`getDisplayTasksForDate` 里没有再叠一层 `sortTaskTemplates`——
  `getEnabledTaskTemplates` 已经保证有序，加一句注释说明该前提即可，避免重复排序。
