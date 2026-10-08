# 消费页：按奖品（分类）查看兑换记录

日期：2026-10-08
范围：`src/pages/Consumption/**`（**不碰** `src/db/**`、不碰 Dexie 版本、不碰 `rewardService` 聚合口径）

---

## 0. 结论先行

- 「奖品分类」= 奖品本身，**不新增 `category` 字段**，也不需要分类管理界面。
- 缺的东西只有两件：**① 按奖品分组的可展开兑换记录列表；② 按奖品筛选的入口**。
- 数据现成：`getRewardPurchaseStats()` 已经返回窗口内全部记录（`stats.purchases`）与按奖品聚合（`stats.byTemplate`），**不需要新查询、不需要迁移、不需要改服务层**。
- 全部改动集中在一个页面目录内，纯前端 + 一个纯函数。

---

## 1. 现状与差距

| 位置 | 现在有什么 | 缺什么 |
| --- | --- | --- |
| `src/pages/Consumption/index.vue` | 周期选择（月/年/自定义）→ 汇总卡片 → `By item` → `Details` | 没有按奖品筛选/分组 |
| `components/TemplateBreakdown.vue` | `By item`：按**金额倒序**的桶（图标、笔数、件数、积分、金额、占比条） | **不可点击**，看得到汇总下钻不到记录 |
| `components/PurchaseList.vue` | `Details`：时间倒序的**平铺**列表，所有奖品混在一起 | 奖品一多就无法「看某个奖品的兑换记录」 |
| `db/services/rewardService.ts` | `getRewardPurchaseStats()` → `byTemplate`（**只含计入统计**的购买）+ `purchases`（窗口内**全部**记录，含不计入） | 够用，不用改 |
| `db/types/reward.ts` | `RewardPurchase.template` 是购买快照（title/icon/金额/是否计入），`templateId` 保留 | 够用：奖品删了/改名了也能分组显示 |

**差距一句话**：`By item` 有汇总没明细，`Details` 有明细没分组，两者之间没有联动。

---

## 2. 设计

### 2.1 分组在纯函数里做（零新查询）

`stats.purchases` 已按时间倒序且含全部记录 → 直接在 `src/pages/Consumption/lib.ts` 加一个纯函数：

```ts
/** 记录视角的按奖品分组（与 By item 的金额排名口径不同：这里按最近一次兑换时间倒序） */
export interface RewardRecordGroup {
	templateId: string;
	/** 组内最近一次购买的快照标题 / 图标（与 byTemplate 同口径：商品改名后显示最新名字） */
	title: string;
	icon: RewardIconName;
	iconColor?: RewardIconColor;
	/** 组内全部记录（含「不计入消费统计」的） */
	records: RewardPurchase[];
	/** 全部记录的笔数 / 件数 / 消耗积分 —— 记录视角要完整 */
	count: number;
	quantity: number;
	pointsSpent: number;
	/** 只算计入消费统计的金额（与 stats.moneyAmount / byTemplate 同口径，避免两个数字打架） */
	moneyAmount: number;
	/** 组内「不计入统计」的笔数，> 0 时在组头提示 */
	uncountedCount: number;
	/** 组内最近一次兑换时间（ISO），排序用 */
	lastAt: string;
}

export function groupPurchasesByReward(purchases: RewardPurchase[]): RewardRecordGroup[];
```

规则：
- key = `purchase.templateId`（顶层字段，与 `byTemplate` 现有实现一致）。
- 标题/图标取组内**第一条**快照 —— 输入已按时间倒序，所以第一条就是最近一次，与 `rewardService` 里 `byTemplate` 的注释口径完全相同。
- 排序：`lastAt` 倒序（**最近兑换过的奖品排最前**）。这是「看记录」的自然顺序，与 `By item` 的金额排名并存、互不冲突。
- 不计入统计的记录**保留在组里**（明细要能撤销），但 `moneyAmount` 只累加计入的。

### 2.2 组件结构（把单行抽出来复用）

```
components/PurchaseRow.vue        新增：单个兑换记录行（图标/标题/×N/时间/备注/扣分/金额/删除按钮 + 确认弹窗）
components/RewardRecordGroups.vue 新增：按奖品的可展开分组卡片，body 里渲染 PurchaseRow
components/PurchaseList.vue       删除：被上面两个取代（平铺列表不再需要）
```

`PurchaseRow.vue` 直接搬 `PurchaseList.vue` 里现有的行内模板与 `handleDelete`（含 `useConfirm` 文案、`deletingId` 转圈态），emit `delete: [purchaseId]`。
`RewardRecordGroups.vue` props `{ groups: RewardRecordGroup[] }`，emit `delete`；内部维护折叠状态。

### 2.3 页面接线与交互

`src/pages/Consumption/index.vue`：

```
SummaryCards
By item                     ← 每一行可点击，点它 = 选中该奖品
Records by reward           ← 新增：筛选 chip 行 + 分组列表
  [All] [☕ Coffee] [🎮 Game] …
  ▾ ☕ Coffee     3 purchases · 5 items           -320   ¥25.00
      · 2026-09-14 13:20  Coffee ×2   note…        -200  ¥10.00
      · 2026-09-12 09:05  Coffee ×3                -120  ¥15.00 (Not counted)
  ▸ 🎮 Game       1 purchase · 1 item             -50    ¥0.00
```

- **筛选 chip 行**：`All` + 本周期内出现过的奖品，复用 `src/components/FilterTabs.vue` 的 `#label` 插槽渲染 `DynamicIcon` + 标题（`options` 用 `['all', ...groupIds]`，泛型 `T extends string` 已支持）。
- **默认展开**：所有分组默认展开，点组头折叠。不做「默认全折叠」——那会让现有可见的明细凭空消失。
- **筛选到单个奖品时该组强制展开**。
- **联动**：`By item` 行点击 → `emit('select', templateId)` → 记录区只要该奖品、并 `scrollIntoView` 到对应组；`TemplateBreakdown.vue` 增加 `selectedId` prop 做高亮，行改成 `<button>`。
- **周期切换兜底**：`selectedTemplateId` 不在当前分组里时按 `All` 处理（纯 `computed` 判定，不写 `watch`，避免「切周期→重置→再切换」的抖动）。
- **删除**：`RewardRecordGroups` 上抛 → 仍走页面现有 `handleDelete`（`remove()` + `userStore.calculatePoints()` + `refresh()`），回滚逻辑一字不改。

---

## 3. 文件改动清单

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `src/pages/Consumption/lib.ts` | 改 | 新增 `RewardRecordGroup` 类型 + `groupPurchasesByReward()` |
| `src/pages/Consumption/lib.test.ts` | 改 | 新增分组用例（见 §4） |
| `src/pages/Consumption/components/PurchaseRow.vue` | 新增 | 从 `PurchaseList.vue` 抽出的单行 |
| `src/pages/Consumption/components/RewardRecordGroups.vue` | 新增 | 分组卡片 + 折叠 |
| `src/pages/Consumption/components/PurchaseList.vue` | 删除 | 被取代 |
| `src/pages/Consumption/components/TemplateBreakdown.vue` | 改 | 行可点击 + `selectedId` 高亮 |
| `src/pages/Consumption/index.vue` | 改 | 筛选 chips、选中态、接线 |
| `src/pages/Consumption/components/RewardRecordGroups.test.ts` | 新增 | 组件测试（可选但推荐，`@vue/test-utils` 已在 devDependencies） |

预估 diff：约 +250 / −120 行，全部在 `src/pages/Consumption/` 内。无 DB、无路由、无 i18n（文案一律英文）、无新依赖。

---

## 4. 测试

`src/pages/Consumption/lib.test.ts`（沿用现有中文用例风格）：

1. 同一奖品多条记录聚成一桶，`count` / `quantity` / `pointsSpent` 累加正确。
2. **混合口径**：一个奖品里既有计入又有不计入的记录 → `pointsSpent` 含两条、`moneyAmount` 只含计入的那条、`uncountedCount === 1`。
3. **改名**：同一 `templateId` 前后两次购买标题不同 → 组标题是**最近一次**的快照标题（锁死与 `byTemplate` 一致的口径）。
4. **奖品已删除**：只有快照、模板查不到 → 仍能正常分组（记录保留是现有行为）。
5. **排序**：按 `lastAt` 倒序（最近兑换在前），与金额大小无关。
6. 空数组 → `[]`，不抛错。
7. **口径自洽**：把各组「计入统计」的金额/积分求和，必须等于直接从 `purchases` 按 `isCountedInConsumption` 求和的结果（防止与 `stats.moneyAmount` 漂移）。

`src/pages/Consumption/components/RewardRecordGroups.test.ts`：
- 渲染出正确的组头数量与组内行数；
- 折叠后组内行消失、再点恢复；
- 点删除 → emit `delete` 带上正确的 `purchaseId`。

回归：`src/db/services/rewardService.test.ts` **不需要改**（服务层零改动），跑一遍确认没被牵连。

命令：

```bash
bunx vitest src/pages/Consumption
bunx vitest src/db/services/rewardService.test.ts
bun run typecheck
bun run build
```

---

## 5. 不做的事 / 边界

- **不做跨周期的「某个奖品的完整兑换历史」**：当前视图跟随周期选择器（与「消费统计」口径一致）。要跨周期需要新的服务查询和入口，另开计划。
- **不改数据结构**：`RewardTemplate` / `RewardPurchase` 类型、`RewardPurchaseSnapshot`、Dexie 版本全部不动 → 无迁移、无 `toPlain()` 相关风险。
- **不改 `byTemplate` 现有语义**：`By item` 仍只统计「计入消费统计」的购买、仍按金额倒序（现有测试锁定），新分组只是换了个维度看同一批记录。
- **不做**：分类管理界面、自定义分类、标签 —— 已确认「分类 = 奖品本身」。
- 折叠状态不持久化（页面刷新回默认展开）。

---

## 6. 执行后的验证清单

1. `bunx vitest` + `bun run typecheck` + `bun run build` 全绿。
2. 浏览器/真机 `/consumption`：
   - 切月/年/自定义，分组与周期同步变化；
   - 点 `By item` 某奖品 → 记录区只剩它并滚到该组、高亮；
   - 折叠/展开；`All` 恢复；选中奖品在切换周期后自然回退 `All` 不报错；
   - 删除一条记录 → 该行消失、组头笔数/金额、汇总卡片、积分余额同步刷新（回滚生效）；
   - 一个「不计入统计」的奖品分组：组头金额为 ¥0.00，组内有 `Not counted` 行与提示。

---

## 6. 完成后记（2026-10-08）

### 6.1 落地清单

| 文件 | 动作 |
| --- | --- |
| `src/pages/Consumption/lib.ts` | 新增 `RewardRecordGroup` + `groupPurchasesByReward()` |
| `src/pages/Consumption/lib.test.ts` | +7 条分组用例（含口径自洽断言） |
| `src/pages/Consumption/components/PurchaseRow.vue` | 新增（单行；组内不再重复奖品名，改为时间 + `×N` + 备注） |
| `src/pages/Consumption/components/RewardRecordGroups.vue` | 新增（分组卡片 + 折叠 + `data-record-group` 锚点） |
| `src/pages/Consumption/components/PurchaseList.vue` | 删除 |
| `src/pages/Consumption/components/TemplateBreakdown.vue` | 行改 `button` + `selectedId` 高亮 + `select` 事件 |
| `src/pages/Consumption/index.vue` | 筛选 chip、选中态、滚动到位、分组渲染 |
| `src/pages/Consumption/components/RewardRecordGroups.test.ts` | 新增（5 条：渲染/折叠/外部展开/删除转发/空态） |

diff：`5 files changed, 332 insertions(+), 117 deletions(-)`（+3 新文件）。无 DB 改动、无迁移、无新依赖。

### 6.2 验证（全绿）

- `bunx vitest run src/pages/Consumption` → 18 passed
- `bunx vitest run` → **28 files / 346 tests passed**（`rewardService.test.ts` 未改也全过）
- `bun run typecheck` → 无输出（干净）
- `bun run build` → built in 4.84s（仅有既有的 500kB chunk 警告）

真页面验证（`bun run dev` + bow 浏览器，真实 UI 点击而非直接写库）：

1. 用商店 UI 真实兑换 4 笔：Coffee ×2（带备注 `with friends`）、Coffee ×1、Game time ×1、Snack ×1（`countInConsumption: false`）。
2. `/consumption` 数字与预期逐项一致：`350 points / ¥30 / 3 purchases · 4 items`；`By item` = Coffee ¥30 100% + Game time ¥0 0%，**Snack 不在 By item 里**（不计入统计）。
3. 分组：3 组，**按最近兑换时间倒序**（Coffee → Snack → Game time，与实际下单顺序相反，证明不是按金额/入参顺序）；Snack 组头显示 `1 not counted`、金额 `¥0`，组内行是 `Not counted`；Coffee 组内两行分别是 `×2 + with friends` 与 `×1`。
4. 联动：点 `By item` 的 Coffee 行 → chip 变 Coffee、该行高亮、只剩 Coffee 组（1 组）；点 chip `All` → 恢复 3 组。
5. 折叠：Coffee 组头点击后组内 2 行消失，再点恢复。
6. 删除回滚：删掉 Coffee ×1 → 汇总变 `250 / ¥20 / 2 purchases · 3 items`、Coffee 组变 `1 purchase · 2 items · 200 · ¥20`，且该组因 `lastAt` 变早而**排到末位**（排序口径正确）；直接读库确认对应 `reward_exchange -100` 流水也一并删除。
7. 验证数据已全部清理（`rewardPurchases` / `rewardTemplates` / `pointsHistory` / `replenishmentRecords` 计数归零），dev server 已停。

### 6.3 过程中发现

- **`browser_navigate` 到只有 hash 不同的 URL 不会重新加载**：给商店页塞数据后必须 `browser_reload`，否则列表仍显示旧数据（与既有结论一致）。liveQuery 只覆盖积分卡片，奖品列表不是 live 的。
- `PurchaseRow` 抽出来后**去掉了行内的奖品名**（组头已经写了），但保留了 `×N` —— 否则组内「×3 的那一笔」会看不出数量。
- `FilterTabs` 的 `#label` 插槽拿到的是原始 option 字符串，chip 的图标/标题靠页面侧的 `groupFor(option)` 映射（`?? 'Gift'` 兜底），没有为它改通用组件。
