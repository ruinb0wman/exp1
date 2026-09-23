# 商店商品按积分升序排列（0 积分在前）

日期：2026-09-22
范围：`src/libs/reward.ts`（排序纯函数）、`src/db/services/rewardService.ts`（列表查询接入排序）、
`src/libs/reward.test.ts` / `src/db/services/rewardService.test.ts`（测试）
不涉及：无 UI 组件、无 i18n、无 DB 字段/迁移、无 Rust / tauri、**不新增依赖**

---

## 1. 目标与前提

1. 商店页（`/store`）的商品列表**按 `pointsCost` 升序**展示：0 积分（免费额度）在最前，10 积分其后，
   依此类推。
2. 同积分商品之间按**创建时间早→晚**排（已确认），再以 `id` 兜底，保证全序稳定可预测。
3. 只改默认顺序，**不加排序切换按钮**（已确认）。

假设：这里的「商品」＝奖励商店里的 `RewardTemplate`（UI 里叫 reward / 商品）。

---

## 2. 现状（已读代码）

### 2.1 商店查询没有任何排序，顺序实际是「主键乱序」

`src/db/services/rewardService.ts:428-455`：

```ts
export async function getStoreRewardTemplates(
  userId: number
): Promise<Array<{ template: RewardTemplate; availableCount: number }>> {
  const db = getDB();

  const templates = await db.rewardTemplates
    .where('userId')
    .equals(userId)
    .and(t => t.enabled)
    .toArray();

  const result: Array<{ template: RewardTemplate; availableCount: number }> = [];

  for (const template of templates) {
    // 对不自动补货的奖品，库存为无限；否则使用 currentStock
    const availableCount = template.replenishmentMode === 'none'
      ? Infinity
      : (template.currentStock ?? 0);
    result.push({ template, availableCount });
  }

  return result;
}
```

没有 `sort`。`rewardTemplates` 的主键是 UUID（`src/db/index.ts` 的 `rewardTemplates.hook('creating')`
`item.id = generateUUID()`），`where('userId')` 命中索引后按主键顺序返回 —— 也就是**随机 UUID 序**，
与积分价无关。所以「0 积分在前」现在完全不成立。

### 2.2 消费链路

`useStoreRewards`（`src/hooks/useRewards.ts:146-182`）直接 `setRewards(data)`，不重排；
`Store/index.tsx:68` 的 `filterRewardsBySearch` 只做关键词过滤（`src/pages/Store/lib.ts:12-21`），
空关键词时**原样返回**。所以排序放在服务层，UI 层一行都不用改。

### 2.3 仓库里已有同型先例（应当照抄其结构）

任务模板的「等级升序」是同一类需求，做法是**纯函数放 `src/libs/`，在服务层的所有列表查询里统一接入**：
`src/libs/task.ts:419-431` 的 `compareTemplateOrder`（level 升序 → `createdAt` → `id`，非法的 level 用
`MISSING_LEVEL = Number.MAX_SAFE_INTEGER` 排到最后）+ `sortTaskTemplates`（返回副本），
在 `src/db/services/taskService/template.ts` 的每个查询里 `return sortTaskTemplates(...)`。

### 2.4 哪些地方**不改**

- 消费统计的商品占比/排名（`getRewardPurchaseStats` 的 `byTemplate`）刻意按**金额倒序**，与本需求无关，
  不动。
- 补货记录、积分流水、消费明细的顺序不动。

---

## 3. 改法

### 3.1 纯函数：`src/libs/reward.ts`

文件末尾追加（与 `isCountedInConsumption` / `roundMoney` 同风格，中文注释）：

```ts
/** 非法/缺失 pointsCost（坏备份、手工构造对象）时排到最后 */
const MISSING_POINTS_COST = Number.MAX_SAFE_INTEGER;

function resolvePointsCost(template: RewardTemplate): number {
  const cost = template.pointsCost;
  return Number.isFinite(cost) ? cost : MISSING_POINTS_COST;
}

/**
 * 商品比较器：pointsCost 升序 → createdAt → id
 * （0 积分的免费额度排在最前；后两级兜底保证同价商品也有稳定全序）
 */
export function compareRewardOrder(a: RewardTemplate, b: RewardTemplate): number;

/** 按积分升序排序（返回副本，不改原数组） */
export function sortRewardTemplates<T extends RewardTemplate>(templates: T[]): T[];
```

实现与 `compareTemplateOrder` 逐字对应：

```ts
export function compareRewardOrder(a: RewardTemplate, b: RewardTemplate): number {
  const byCost = resolvePointsCost(a) - resolvePointsCost(b);
  if (byCost !== 0) return byCost;

  const byCreatedAt = (a.createdAt || '').localeCompare(b.createdAt || '');
  if (byCreatedAt !== 0) return byCreatedAt;

  return String(a.id).localeCompare(String(b.id));
}

export function sortRewardTemplates<T extends RewardTemplate>(templates: T[]): T[] {
  return [...templates].sort(compareRewardOrder);
}
```

需要新增 `import type { RewardTemplate } from '@/db/types';`（`src/libs/task.ts` 同样是 `import type` 引
`@/db/types`，纯函数层不引 Dexie）。

### 3.2 服务层：`src/db/services/rewardService.ts`

四处列表查询统一 `return sortRewardTemplates(...)`（对齐 taskService 的「列表查询一律有序」不变量）：

| 函数 | 现状 | 改法 |
|---|---|---|
| `getStoreRewardTemplates`（必须） | `for (const template of templates)` | `for (const template of sortRewardTemplates(templates))` |
| `getAllRewardTemplates`（一致性） | `return db.rewardTemplates.where('userId').equals(userId).toArray();` | 先 `await` 再 `sortRewardTemplates(...)`；无 `userId` 分支同理 |
| `getEnabledRewardTemplates`（一致性） | `filter(t => t.enabled)` 后直接返回 | 两分支都过排序 |
| `getRewardTemplatesByReplenishmentMode`（一致性） | 同上 | 两分支都过排序 |

后三个函数当前**无调用方**（全仓 grep 只有定义），一并排序只为消除「有的查询有序、有的无序」的坑，
实际行为变化为零。`getStoreRewardTemplates` 用最简单的形式：只把循环源换成排序后的副本，
`result` 的构造与 `availableCount` 语义完全不动。

### 3.3 UI / 其它层

**不改**。`getStoreRewardTemplates` 的返回顺序 → `useStoreRewards` → `filterRewardsBySearch`
（关键词过滤保持相对顺序）→ `RewardsGrid` 的 `map`，链路天然保留顺序。

---

## 4. 实施步骤

| # | 步骤 | 触及文件 | 验证 |
|---|---|---|---|
| 1 | 记录基线用例数（改动前跑一次全量） | — | `bunx vitest run` 的 `Tests N passed` 记进实施记录 |
| 2 | 加 `compareRewardOrder` / `sortRewardTemplates` + 单测 | `src/libs/reward.ts`、`src/libs/reward.test.ts` | `bunx vitest run src/libs/reward.test.ts` |
| 3 | 四处列表查询接入排序 | `src/db/services/rewardService.ts` | `bunx vitest run src/db/services/rewardService.test.ts` + `bunx tsc --noEmit` |
| 4 | 新增商店查询顺序的集成用例 | `src/db/services/rewardService.test.ts` | 同上 |
| 5 | 全量回归 | — | `bunx vitest run`、`bunx tsc --noEmit`、`bun run build` |
| 6 | 真机/浏览器手测 | — | `bun run dev` → `/store`：建「免费额度 0 分 / 咖啡 10 分 / 大餐 100 分」三个商品，列表应为 0→10→100；再新加一个同价商品，应排在同价组的**最后**；搜索关键词后相对顺序不变 |

测试清单（沿用现有风格，中文用例名）：

- `src/libs/reward.test.ts`（在同一文件加 `describe`，不新建文件）：
  - `0 积分排在最前`：`[10, 0, 100]` → `[0, 10, 100]`（要点，正是用户举的例子）；
  - `同价按 createdAt 早→晚`：两条同为 10 分，`createdAt` 后建的排后面；
  - `createdAt 相同按 id 兜底`：两条同价同 `createdAt`，顺序由 `id` 决定且与入参顺序**无关**
    （正反两次排序结果一致）；
  - `非有限 pointsCost 排到最后`（`Number.NaN` / `undefined` 兜底）；
  - `返回副本不改原数组`（`sortRewardTemplates` 后原数组顺序不变）；
  - 断言一律用 `map(t => t.pointsCost)` / `map(t => t.title)`，不比较对象引用。
- `src/db/services/rewardService.test.ts`（新增一个 `describe('rewardService - 商店列表顺序')`，
  复用文件顶部已有的 `template()` 工厂与 `db.rewardTemplates.clear()` 的 `beforeEach`）：
  - 用 `createRewardTemplate` 依次建 100 / 0 / 10 分的商品（后建的还是最后建的），
    `getStoreRewardTemplates(USER_ID)` 返回的 `pointsCost` 序列为 `[0, 10, 100]`；
  - 停用其中一个后它从结果中消失，其余顺序不变；
  - **不要**在服务层测试里断言同价商品的次级顺序：`createRewardTemplate` 的 `createdAt` 由 hook 取
    `new Date().toISOString()`，同毫秒创建时只能靠随机 UUID 兜底，会变成 flaky 用例 —— 次级顺序的
    覆盖放在上面的纯函数单测里（那里 `createdAt`/`id` 是显式给的）。

---

## 5. 风险与未定项

1. **0 积分商品会排到售罄商品之前**：排序只看 `pointsCost`，不看 `availableCount`。已确认本轮不做
   「售罄置底」；如果以后要加，规则应写成「先按是否有额度分组、组内按积分升序」，且只影响商店展示。
2. **负 `pointsCost`**：`purchaseReward` 已显式拒绝负数（`rewardService.ts:197` 注释「只拒绝负数与非法值」），
   正常数据不会出现；万一手工构造/坏备份带负数，它会排在 0 之前。选择「不额外 clamp」以避免发明语义，
   此处仅记录。非有限值（`NaN` / `undefined`）则明确排到最后。
3. **`createdAt` 缺失**（坏备份）：按空串处理 → 排在同价组最前，与 `compareTemplateOrder` 的既有取舍一致。
4. **排序只在读取时发生**，不改 DB、不写 `updatedAt`、不触发 `rewardTemplates` 的 `updating` 钩子 ——
   因此没有迁移风险，也不存在「升级瞬间批量写库」的问题（与任务模板 `sortOrder` 那次不同）。
5. **真机手测盲区**：项目没有 `@testing-library/react`（只有 vitest + jsdom），所以「页面上确实按新顺序
   渲染」这一点只能靠 `bun run dev` 手测（步骤 6）+ 服务层集成用例两端夹住。
6. **`getRewardTemplatesByReplenishmentMode` 的排序不参与任何 UI**：三个附加查询当前无调用方，
   排序属防御性一致性；若评审认为属于范围外，可只保留 `getStoreRewardTemplates` 一处。

---

## 6. 完成后记（2026-09-22）

已按计划实现并验证：

- 基线 `bunx vitest run`：**23 文件 / 255 例** → 改动后 **23 文件 / 265 例**（新增 10 例）。
- `bunx tsc --noEmit` 干净；`bun run build` 成功（chunk 体积告警为既有状况）。
- `src/libs/reward.ts`：新增 `compareRewardOrder` / `sortRewardTemplates`（`pointsCost` 升序 →
  `createdAt` → `id`，非有限 `pointsCost` 用 `MISSING_POINTS_COST` 排到最后）。类型 import 放在
  文件头注释之后（保持原有文件级注释位置）。
- `src/db/services/rewardService.ts`：`getStoreRewardTemplates`（只把循环源换成
  `sortRewardTemplates(templates)`，`availableCount` 语义未动）+ `getAllRewardTemplates` /
  `getEnabledRewardTemplates` / `getRewardTemplatesByReplenishmentMode` 三处一并接入。
- 测试：`src/libs/reward.test.ts` 加 `createReward` 工厂与 7 例（0 在前、同价按 `createdAt`、
  同价同时间按 `id` 且与入参顺序无关、缺失 `createdAt`、非有限 `pointsCost` 置底、返回副本、
  比较器可单独用）；`src/db/services/rewardService.test.ts` 新增 `describe('rewardService - 商店列表顺序')`
  3 例（降序写入后返回 `[0, 10, 100]` 且不跨用户、停用后消失且相对顺序不变、排序不影响
  `availableCount` 的 `Infinity`/`3`）。
- **浏览器实测（bow + `bun run dev`）通过**：库里原有 1 个用户、0 个商品；用 `db.rewardTemplates.bulkAdd`
  塞入 4 条固定 `createdAt` 的测试商品（免费额度 0 / 咖啡旧 10 `09-01` / 咖啡新 10 `09-05` / 大餐 100）
  → `/store` 渲染顺序正是 `免费额度, 咖啡旧, 咖啡新, 大餐`；搜索「咖啡」后仍为 `咖啡旧, 咖啡新`（过滤
  不改相对顺序）。测完按 `id` 前缀 `zz-test-` 删干净（回到 0 商品），dev server 已停。
- 未提交：改动留在工作区（4 个文件 + 本计划目录），未做 commit。

### 6.1 复验（2026-09-22，最终代码状态一次跑完）

- `bunx tsc --noEmit` 干净；`bunx vitest run` **23 文件 / 265 例**全绿；`bun run build` 成功。
- 浏览器复验（`bun run dev` + bow）：库里原有 1 用户、0 商品；**按用户真实操作次序**插 4 条
  （咖啡 10 分 `09-01` → 免费额度 0 分 `09-02` → 大餐 100 分 `09-03` → 咖啡2 10 分 `09-04`），
  此时 Dexie `where('userId').toArray()` 的**原始顺序是乱序** `10:咖啡, 10:咖啡2, 100:大餐, 0:免费额度`
  （即改动前的实际展现顺序），而页面渲染为
  **`免费额度(0) → 咖啡(10) → 咖啡2(后建同价, 10) → 大餐(100)`**，搜索「咖啡」后仍为 `咖啡, 咖啡2`。
  测完按 `zz-verify-` 前缀删净（回到 0 商品），dev server 已停（`ss` 确认 1420 无监听）。
