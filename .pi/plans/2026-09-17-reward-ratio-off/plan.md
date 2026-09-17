# 奖品「积分货币比例」可关闭：关闭后不计入消费统计

日期：2026-09-17
范围：`src/db`、`src/libs`、`src/pages`、`src/locales`（+ 可选的 `src/libs/report`）

---

## 1. 目标

给每个奖品新增一个开关：**关闭「积分货币比例」** = 该奖品不折合金额，且**之后**购买它产生的消费不计入消费统计。

关闭后的期望行为（已与你确认）：

- 消费统计页的**汇总**（消费积分 / 折合金额 / 笔数 / 件数）与**商品占比**都不含这些购买；
- 消费统计页的**明细列表仍然列出**这些购买，只把「¥金额」换成「不计入统计」标注 —— 保住唯一的撤销/回滚入口（删除记录会返还积分与消费额度）；
- 开关**只影响之后的购买**：关闭前已记录的消费保持原样，历史月份/年度统计不回算；
- 编辑页里开关放在「积分货币比例」区块标题右侧，关闭即隐藏比例输入与预览，只留一行说明；
- 新增奖品与存量奖品默认**开启**（行为与现状完全一致）。

**假设**：不做数据库迁移。旧模板/旧消费记录里没有该字段，一律按「缺省 = 计入」处理（见 §3.3）。

---

## 2. 现状（侦察结论，引用自实际代码）

| 位置 | 现状 |
| --- | --- |
| `src/db/types/reward.ts:64` | `RewardTemplate.pointsPerYuan: number`「每 ¥1 折合多少积分」，必填 |
| `src/db/types/reward.ts:81-105` | `RewardPurchaseSnapshot`（购买时快照）+ `RewardPurchase.moneyAmount: number`（`= pointsSpent / pointsPerYuan`） |
| `src/db/services/rewardService.ts:147` | `toPurchaseSnapshot()` 把模板字段拷进快照 —— 这就是「按快照判定」的落点 |
| `src/db/services/rewardService.ts:212` | `purchaseReward` 里 `moneyAmount: pointsToMoney(totalCost, ratio)`，与积分扣减、积分流水同事务 |
| `src/db/services/rewardService.ts:361-397` | `getRewardPurchaseStats` 对窗口内**全部**记录累加 `pointsSpent`/`moneyAmount`/`quantity`，按 `templateId` 聚合成 `byTemplate`，并把同一批记录原样作为 `purchases` 明细返回 |
| `src/pages/Consumption/components/PurchaseList.tsx:88` | 明细每行渲染 `formatMoney(purchase.moneyAmount)`；删除按钮 → `deleteRewardPurchase`（唯一回滚入口，积分明细页没有删除） |
| `src/pages/Store/components/RewardsGrid.tsx:68`、`RewardDetailPopup.tsx:86,146` | 商店卡片与购买弹窗展示折合金额（卡片行 / 金额卡 / 「总计 ≈ ¥X」） |
| `src/pages/EditReward.tsx:256-301` | 「积分货币比例」区块：`NumberInput` + hint + 实时预览；`handleSubmit` 用 `isValidRatio(pointsPerYuan)` 守卫 |
| `src/libs/reward.ts` | `isValidRatio` / `normalizeRatio` / `pointsToMoney` / `formatMoney` / `formatRatio`（`formatRatio` 目前无引用） |

现状的既有不变量（本次必须保持）：消费记录不因删商品而丢；金额在写入时四舍五入到 2 位小数、汇总对已取整值求和；统计时间窗口走 `resolvePeriod` + `getPeriodTimeWindow` + `user.dayEndTime`。

---

## 3. 数据结构设计

### 3.1 `src/db/types/reward.ts`

```ts
export interface RewardTemplate {
  // ...
  /**
   * 积分货币比例：每 ¥1 折合多少积分（吃饭 = 1，香烟 = 2）
   * 必须为有限正数，允许小数；金额换算为 pointsCost / pointsPerYuan
   * 关闭比例（countInConsumption === false）时该值仍保留，重新打开即可复用
   */
  pointsPerYuan: number;
  /**
   * 是否折合金额并计入消费统计；缺省（旧数据）视为 true
   */
  countInConsumption?: boolean;
}

/** 购买时的商品快照：商品改名或删除后统计仍可读 */
export interface RewardPurchaseSnapshot {
  // ...
  pointsPerYuan: number;
  /** 购买那一刻的「计入消费统计」设置，统计与明细标注都按它判定 */
  countInConsumption?: boolean;
}

export interface RewardPurchase {
  // ...
  /** 实际扣除积分 = pointsCost * quantity */
  pointsSpent: number;
  /**
   * 折合金额 = pointsSpent / pointsPerYuan，保留 2 位小数
   * 关闭比例的购买不写该字段（undefined = 不计入消费统计），避免 0 被误读成真实金额
   */
  moneyAmount?: number;
  createdAt: string;
  updatedAt?: string;
}
```

字段命名取 `countInConsumption`（与「计入消费统计」一一对应，避免 `trackMoney` 这类只描述金额的歧义命名）。`RewardPurchaseStats.moneyAmount`、`PurchaseTemplateBucket.moneyAmount` **保持必填 number**（它们只累加计入统计的记录）。

### 3.2 `src/libs/reward.ts`（新增一个纯函数）

```ts
/**
 * 该奖品/该笔购买是否计入消费统计
 * 缺省（v7 之前写入的旧数据没有这个字段）视为计入
 */
export function isCountedInConsumption(flag?: boolean): boolean {
  return flag !== false;
}
```

所有「是否计入」的判断只走这一个函数：服务层、明细标注、商店展示、编辑页回填。不新增第二个真值来源。

### 3.3 为什么不做 Dexie 迁移

- 旧 `rewardTemplates` 没有 `countInConsumption` → `isCountedInConsumption(undefined) === true`，正好等于「默认开启」，无需回填；
- 旧 `rewardPurchases` 的 `template` 快照没有该字段、但都有 `moneyAmount` → 判定为计入，历史统计不变；
- `pointsPerYuan` 自 v6 起已被强制写成显式值（`migrations/index.ts:95`），不会被误当「关闭」。

因此**不加 v7**，避免只为写一个 `true` 而全表 `bulkUpdate`。这条约定要在函数注释与测试里固化（见 Task 7）。

---

## 4. 实现任务（按顺序执行）

> 每步只改列出的文件；完成后跑该步的验收命令。

### Task 1 — 工具函数与类型

**文件**：`src/libs/reward.ts`、`src/db/types/reward.ts`

1. `libs/reward.ts`：新增 `isCountedInConsumption`（§3.2），文件头注释补一句「关闭比例 = 不折合金额且不计入消费统计」。
2. `db/types/reward.ts`：`RewardTemplate.countInConsumption?: boolean`、`RewardPurchaseSnapshot.countInConsumption?: boolean`、`RewardPurchase.moneyAmount?: number`（§3.1）。

**验收**：`bunx tsc --noEmit` —— 预期只剩 `PurchaseList.tsx:88` 一处报错（`number | undefined` 不能传给 `formatMoney`），Task 4 修掉。

---

### Task 2 — 服务层：快照写入 + 统计过滤

**文件**：`src/db/services/rewardService.ts`

1. `toPurchaseSnapshot()`（:147）加一行：
   ```ts
   countInConsumption: isCountedInConsumption(template.countInConsumption),
   ```
2. `createRewardTemplate()`（:20）显式落库 `countInConsumption: isCountedInConsumption(template.countInConsumption)`（与 `pointsPerYuan: normalizeRatio(...)` 同风格，让新数据自描述）。`updateRewardTemplate()`（:95）已经在 spread `...updates`，无需改动。
3. `purchaseReward()`（:186 起）：
   ```ts
   const counted = isCountedInConsumption(template.countInConsumption);
   // ...
   const purchase: RewardPurchase = {
     // ...其余字段不变
     moneyAmount: counted ? pointsToMoney(totalCost, ratio) : undefined,
   };
   ```
   积分扣减、额度扣减、积分流水、错误分支**全部不变**。
4. `getRewardPurchaseStats()`（:347 起）改口径：

   | 输出字段 | 口径 |
   | --- | --- |
   | `purchases` | 窗口内**全部**记录，`createdAt` 倒序（明细保留不计入的） |
   | `pointsSpent` / `moneyAmount` / `count` / `quantity` / `byTemplate` | 只累加 `isCountedInConsumption(purchase.template.countInConsumption)` 的记录 |

   实现：窗口过滤排序后先得到 `purchases`，再 `const counted = purchases.filter(p => isCountedInConsumption(p.template.countInConsumption))` 供聚合循环使用；返回 `count: counted.length`、`quantity: counted 件数`，`purchases` 仍传全量。
   接口注释同步写明：「`count`/`quantity` 为计入统计的笔数/件数；`purchases` 含不计入统计的明细」。

**验收**：`bunx tsc --noEmit`（仍只允许 Task 4 那一处报错）；`bunx vitest run src/db/services/rewardService.test.ts`（既有 19 例应全绿：现有夹具都没有该字段，判定为计入）。

---

### Task 3 — 编辑页开关

**文件**：`src/pages/EditReward.tsx`、`src/locales/zh.json`、`src/locales/en.json`

1. 新增状态：`const [countInConsumption, setCountInConsumption] = useState(true);`
2. 回填（`useEffect`，:70 起）：`setCountInConsumption(template.countInConsumption !== false);`
3. 「积分货币比例」区块（:256-301）标题行改成 `flex items-center justify-between`，右侧放开关按钮 —— 复用本文件里 "Enabled" 开关的既有写法（`relative inline-flex h-7 w-12 items-center rounded-full transition-colors` + 内部 `span` 平移），补 `role="switch"` / `aria-checked` / `aria-label={t("editReward.countInConsumption")}`。
4. 关闭时（`countInConsumption === false`）：隐藏比例输入行、`pointsPerYuanHint`、实时预览行，只显示一行 `t("editReward.pointsPerYuanOffHint")`（沿用 `text-text-muted text-sm` 样式）。
5. `handleSubmit`（:111）：`if (countInConsumption && !isValidRatio(pointsPerYuan))` 才报警；payload 仍照常写 `pointsPerYuan`（保留原值便于重新打开），并新增 `countInConsumption`。
6. i18n（zh + en 同时加）：
   - `editReward.countInConsumption`：zh「计入消费统计」 / en「Count in spending」
   - `editReward.pointsPerYuanOffHint`：zh「不折合金额，不计入消费统计」 / en「No money value, excluded from spending stats」

**验收**：`bunx tsc --noEmit`；dev 下新建奖品 → 关开关 → 保存 → 重新进入编辑页开关仍为关闭且比例输入隐藏。

---

### Task 4 — 消费明细标注（保住回滚入口）

**文件**：`src/pages/Consumption/components/PurchaseList.tsx`、`src/locales/zh.json`、`src/locales/en.json`

1. 每行 `const counted = isCountedInConsumption(purchase.template.countInConsumption);`
2. 右侧金额区改为二选一：
   - 计入：`formatMoney(purchase.moneyAmount ?? 0)`（`?? 0` 只为满足类型；计入的记录一定有值）
   - 不计入：`<p className="text-text-muted text-xs">{t('consumption.detail.notCounted')}</p>`
3. 积分、日期、`×数量`、删除按钮**都不变**（删除仍返积分与额度）。删除确认文案 `consumption.detail.confirmDelete` 也不改。
4. i18n：`consumption.detail.notCounted`：zh「不计入统计」 / en「Not counted」。
5. （可选，成本很低）明细区块标题下加一行灰色小字 `另有 {count} 笔不计入统计`；需新增 `consumption.detail.notCountedHint`，并让 `Consumption/index.tsx` 传一个计数 —— 不做也不影响主流程，默认不做。

**验收**：`bunx tsc --noEmit` 全绿；`bunx vitest run src/locales/locales.test.ts`；dev 下关闭比例的奖品买一次 → 明细出现「不计入统计」且汇总数字不变。

---

### Task 5 — 商店页：关闭比例就不显示金额

**文件**：`src/pages/Store/components/RewardsGrid.tsx`、`src/pages/Store/components/RewardDetailPopup.tsx`

1. `RewardsGrid.tsx:68`：`isCountedInConsumption(template.countInConsumption)` 为真时才渲染那行 `formatMoney(...)`（图标 + 积分数保留）。
2. `RewardDetailPopup.tsx`：
   - `const counted = isCountedInConsumption(template.countInConsumption);`
   - `:60` 的两列网格：关闭时改为 `grid-cols-1` 且不渲染「折合金额」卡（`store.moneyValue` 那张），只留积分数卡；
   - `:146` 「总计」行的 `≈ {formatMoney(purchaseMoney)}` 关闭时不渲染（积分总数照常显示）。
3. `getPurchaseMoney`（`src/pages/Store/lib.ts:47`）**保持返回 number 不变**，由调用点用 `isCountedInConsumption` 守卫 —— 避免在 lib 里再引入一层 `undefined` 传播。
4. `getMaxQuantity` / 补货 / 购买校验逻辑一律不动。

**验收**：`bunx tsc --noEmit`；dev 下商店里关闭比例的奖品卡片与弹窗都不出现 ¥。

---

### Task 6 — 导出/导入与报告口径（两项小改动）

**文件**：`src/db/services/exportImportService.ts`、`src/libs/report/aggregate.ts`

1. `exportImportService.ts:246` 的模板归一化补上 `countInConsumption: isCountedInConsumption(template.countInConsumption)`（旧备份没有该字段 → 落成显式 `true`，与 `pointsPerYuan` 的兜底风格一致）。消费记录 `bulkPut` 保持不变（旧记录靠函数缺省判定为计入）。
2. `libs/report/aggregate.ts:495` 的 `rewardsRedeemed`：其 i18n 文案是 **「消费笔数」**（`zh.json:644`），为与消费统计页口径一致，过滤条件加 `&& isCountedInConsumption(purchase.template.countInConsumption)`。
   - 这与「只影响之后的购买」不冲突：判定用的仍是**该笔记录自己的快照**，关闭前记录的笔数不会被抹掉。
   - 如果你希望报告页保持「含全部购买」的旧口径，跳过这一条即可，其余步骤不受影响。

**明确不改**（这些统计的是「购买/兑换次数」，不是消费统计）：
- `src/hooks/useProfileStats.ts:129` → Profile 的 "Purchases"
- `src/services/achievementGenerator.ts:109`、`src/libs/achievement/metrics.ts:127` → 成就 `reward_redeem_count`
- `src/db/services/rewardService.ts` 的 `getRewardPurchaseCount()`

**验收**：`bunx vitest run src/db/services/exportImportService.test.ts src/libs/report src/db/services/reportService.test.ts` 全绿（现有夹具都无该字段，行为不变）。

---

### Task 7 — 测试

**文件**：`src/db/services/rewardService.test.ts`（改 + 增）、`src/libs/reward.test.ts`（新建，小）

1. 夹具 `template()`（:26）加 `countInConsumption: true`，便于后续按需覆盖。
2. 新增用例（`describe('rewardService - 购买即消费')` 内）：
   - **关闭比例购买**：`countInConsumption: false` 的模板 → `purchase.moneyAmount` 为 `undefined`、快照 `template.countInConsumption === false`、积分照扣（`currentPoints` 减少）、`pointsHistory` 有一条 `reward_exchange`。
   - **旧记录缺省**：直接 `bulkAdd` 一条快照**没有** `countInConsumption` 字段的记录 → 统计把它计入（兼容性回归）。
3. 新增用例（`describe('rewardService - 消费统计')` 内）：
   - **关闭后不计入汇总**：窗口内 1 条计入 + 1 条不计入 → `count === 1`、`quantity` 只含计入件数、`pointsSpent`/`moneyAmount` 只含计入值、`byTemplate` 只有 1 个商品；而 `stats.purchases` 长度为 **2** 且含那条不计入的（明细保留的回归测试）。
   - **只影响之后的购买**（本次核心口径）：先用 `countInConsumption: true` 购买一条，再把模板改成 `false` 并购买第二条 → 两条都在 `purchases` 里，但 `pointsSpent`/`moneyAmount` 只含**第一条**。这条用例锁死「快照判定」这个约定，防止后人改成读模板当前值。
4. `src/libs/reward.test.ts`（新建）：`isCountedInConsumption(undefined/*true/false*/)` 三个断言，把「缺省 = 计入」写进单测。

**验收**：`bunx vitest run src/db/services/rewardService.test.ts src/libs/reward.test.ts` 全绿。

---

### Task 8 — 全量校验

```bash
bunx tsc --noEmit
bunx vitest run
bun run build
```

- `bunx vitest run` 基线是 27 个测试文件 / 404 用例全绿（本仓 v7 之前的口径；以实际输出为准，只要求「原有用例不减少、不失败」）。
- 手动走查（`bun run dev`，Android/浏览器均可）：编辑页开关 → 商店不显示 ¥ → 购买 → 消费统计页汇总与明细标注 → 删除该明细回滚积分与额度。

---

## 5. 影响面清单

**修改**
- `src/libs/reward.ts`（新增 `isCountedInConsumption`）
- `src/db/types/reward.ts`（3 个字段）
- `src/db/services/rewardService.ts`（快照、创建、购买、统计口径）
- `src/pages/EditReward.tsx`（开关 + 守卫）
- `src/pages/Consumption/components/PurchaseList.tsx`（明细标注）
- `src/pages/Store/components/RewardsGrid.tsx`、`RewardDetailPopup.tsx`（隐藏金额）
- `src/db/services/exportImportService.ts`（导入兜底）、`src/libs/report/aggregate.ts`（消费笔数口径，可选项）
- `src/locales/zh.json`、`src/locales/en.json`（3 个新 key）
- `src/db/services/rewardService.test.ts`、`src/libs/reward.test.ts`（新建）

**不动**
- 数据库 schema 与迁移（不加 v7）、`pointsHistory`、补货/额度逻辑、成就与 Profile 的「购买次数」、`RewardPurchaseStats.moneyAmount` 的必填类型、路由。

---

## 6. 风险与未知

| 风险 | 处理 |
| --- | --- |
| 明细里出现「不计入统计」的行，但汇总数字不含它，可能让用户以为统计漏了 | 用灰色小字标注（Task 4）；若需要可在明细标题下补「另有 N 笔不计入统计」（已列为可选项） |
| `moneyAmount` 变可选后其他调用点漏改 | TS 会在编译期全部暴露（当前只有 `PurchaseList.tsx:88` 一处读 `purchase.moneyAmount`） |
| 关闭后再打开，历史记录不会重新计入 | 这是「只影响之后」的必然结果，符合已确认决策；如需改成回算，需要额外写一条「重写历史快照」的迁移/动作（本计划不做） |
| 关闭比例后无法从商店弹窗判断该奖品是否记账 | 开关只影响 ¥ 的展示；奖品的消费额度与积分数一切照常。编辑页可随时看到开关状态 |
| 旧数据判定依赖「缺省 = 计入」这一约定 | 由 `isCountedInConsumption` 单点实现 + Task 7 的兼容性用例固化；不引入迁移 |
| 真机 Android 未验证 | 本计划只保证 `tsc` / `vitest` / `build`；真机走查由你决定 |

---

## 7. 建议提交拆分

1. `feat(reward): 积分货币比例可关闭，关闭后不折合金额且不计入消费统计`
   —— Task 1~5 + 7（类型/工具/服务/三个页面/测试必须一起落地，拆开会让中间态编译失败）
2. `chore(reward): 导入兜底与报告消费笔数口径对齐`
   —— Task 6

---

## 8. 执行结果（2026-09-17）

全部任务已实现（Task 6 的两项也做了，未跳过）。

### 校验

| 命令 | 结果 |
| --- | --- |
| `bunx tsc --noEmit` | 无输出（通过） |
| `bunx vitest run` | 16 个测试文件 / **186 个用例全绿**（改动前 15 / 177，新增 `src/libs/reward.test.ts` 与 8 条用例） |
| `bun run build` | 通过（`dist/assets/index-D.WudvUg.js` 730.73 kB，chunk 体积告警是既有的） |

### 真实浏览器端到端走查（`bunx vite --port 5199` + 真实 IndexedDB）

**第一轮：关闭即生效**

1. `/rewards/new` 关闭「积分货币比例」→ 设定区块收起，只剩一行「不折合金额，不计入消费统计」（`aria-checked` 从 true 变 false）。
2. 保存后 `rewardTemplates` 落库为 `countInConsumption: false`，`pointsPerYuan` 仍保留原值。
3. `/store` 卡片只有 `100 exp`，无 ¥；购买弹窗只剩积分数卡，「总计」行没有 `≈ ¥100`。
4. 购买后 `rewardPurchases` 记录：`template.countInConsumption === false`、`pointsSpent: 100`、`moneyAmount === undefined`；积分 2000 → 1900，`pointsHistory` 照常写入一条 `reward_exchange`。
5. `/consumption`：汇总为 `消费积分 0 / ¥0 / 0 件商品`，商品占比空，而明细里仍列出「看电影 -100 **不计入统计**」。

**第二轮：清库重跑「开关从开到关」的时序（锁死「只影响之后的购买」）**

1. 删库重启，`/rewards/new` 确认新奖品默认 `aria-checked = "true"`、比例输入可见 → 建「抽烟」（100 积分，比例 1）。
2. `/store` 卡片显示 `¥100`，弹窗有「折合金额」卡 → 买第 1 单（`money: 100`、`flag: true`）。
3. `/rewards/:id` 关闭开关 → 区块收起 → `Update Reward` 保存；复盘：`countInConsumption: false`、`pointsPerYuan` 仍为 `1`，`/store` 的 ¥100 消失。
4. 再买第 2 单（`money: undefined`、`flag: false`），积分 1000 → 800。
5. `/consumption` 实测输出：
   - 汇总：`消费积分 100` / `折合金额 ¥100` / `1 笔`、`1 件商品` → **只含关闭前那笔，历史未被回算**
   - 商品占比：`抽烟 1 笔 · 1 件 / 100 / ¥100` → 也只含计入的那笔
   - 明细两行都在：`-100 ¥100`（关闭前）与 `-100 不计入统计`（关闭后）
6. 走查完毕删除该 origin 的 IndexedDB 并停掉 5199 dev server（未动你原有的 1420 dev server）。

### 计划外的新增/变更点

| 项 | 说明 |
| --- | --- |
| `isCountedInConsumption` 放进 `libs/reward.ts` | 与 `pointsToMoney` 等同处，避免新开模块 |
| `createRewardTemplate` 落库时归一化 `countInConsumption` | 与既有 `pointsPerYuan: normalizeRatio(...)` 写法对齐，新数据自描述 |
| `RewardPurchase.moneyAmount` 为 `undefined` 时字段仍存在于对象上 | IndexedDB 结构化克隆会保留该键（值为 undefined），读取端一律用 `?? 0` / `isCountedInConsumption` 处理；JSON 导出会自然丢弃它 |
| `formatRatio` 补了注释 | 提示调用前需自行确认是否计入统计（该函数当前无引用） |

### 未做

- 真机 Android 验证（本次只到浏览器端到端）。
- 提交：改动尚未 commit，建议按 §7 拆两个 commit。
