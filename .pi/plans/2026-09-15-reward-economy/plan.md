# 奖品经济重构：购买即消费 + 积分货币比例 + 消费统计

日期：2026-09-15
范围：`src/db`、`src/hooks`、`src/pages`、`src/libs/report`、`src/locales`

---

## 1. 目标

把现在的「兑换 → 进背包 → 有有效期 → 手动使用」模型，改成**购买即消费**的记账模型：

1. **移除背包**：不再有 `RewardInstance`（奖励实例）、`available/used/expired` 状态流转、过期检查、批量使用。
2. **移除过期**：`RewardTemplate.validDuration` 及所有 `expiresAt` 逻辑删除。
3. **积分货币比例**：每个商品新增 `pointsPerYuan`（每 ¥1 折合多少积分）。商品**仍按积分定价**（`pointsCost` 不变），比例用于换算消费金额：`金额 = 积分 ÷ pointsPerYuan`。允许小数比例。
4. **购买即消费**：购买 = 一次性扣积分 + 落一条消费记录，没有中间态。
5. **消费统计页**：新建独立页面，展示消费积分 / 折合金额 / 笔数、按商品聚合的占比、月/年/自定义切换、消费明细，并支持删除记录回滚。
6. **保留补货与库存上限**，语义变为「消费额度」（例如每天最多买 2 次、总额度封顶 10 次）。

## 2. 已确认的决策

| 决策点 | 结论 |
| --- | --- |
| 比例语义 | 商品仍按**积分**定价；比例只用于换算金额。`金额 = pointsCost × 数量 ÷ pointsPerYuan` |
| 比例录入 | 允许小数（如 1.5、0.8），`> 0` |
| 金额精度 | 每条消费记录换算后四舍五入到 2 位小数；汇总时对已取整的每条求和 |
| 记录存储 | 新建独立表 `rewardPurchases`，删除 `rewardInstances`；同事务内仍写 `pointsHistory` 的 `reward_exchange` |
| 分类 | **不做分类字段**，统计直接按 `templateId`（商品）聚合 |
| 历史背包数据 | **直接丢弃**（不迁移）。积分余额不变（依赖 `pointsHistory`，本来就已经扣过） |
| 补货/库存 | 保留，作为消费额度；购买时扣库存 |
| 纠错 | 消费明细支持删除：删记录 + 反写积分 + 返还库存（同事务） |
| 统计入口 | 新建独立页面 `/consumption`，从商店页头部与个人中心进入 |
| 删除商品 | 只删 `rewardTemplates` + `replenishmentRecords`；**消费记录保留**（靠快照可读）——记账不能因为删商品而丢历史 |
| Reports 报告 | 只做最小适配（数据源换表），JSON `formatVersion: 1` 的 key 名不变 |

## 3. 数据结构设计

### 3.1 `RewardTemplate`（`src/db/types/reward.ts`）

```ts
export type ReplenishmentMode = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RewardTemplate {
  id: string;
  userId: number;
  title: string;
  description?: string;
  pointsCost: number;      // 单个商品所需积分（不变）
  pointsPerYuan: number;   // 新增：每 ¥1 折合多少积分，> 0，允许小数（吃饭=1，香烟=2）
  enabled: boolean;
  replenishmentMode: ReplenishmentMode;
  repeatInterval?: number;
  repeatDaysOfWeek?: number[];
  repeatDaysOfMonth?: number[];
  replenishmentNum?: number;
  replenishmentLimit?: number;
  currentStock?: number;
  lastReplenishedDate?: string;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  createdAt: string;
  updatedAt?: string;
}
```

**删除**：`validDuration`、`RewardStatus` 类型、`RewardInstance` 接口。

### 3.2 `RewardPurchase`（新增，同文件）

```ts
/** 购买时的商品快照：商品改名/删除后统计仍可读 */
export interface RewardPurchaseSnapshot {
  templateId: string;
  title: string;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  pointsCost: number;
  pointsPerYuan: number;
}

export interface RewardPurchase {
  id: string;
  userId: number;
  templateId: string;
  template: RewardPurchaseSnapshot;
  quantity: number;
  pointsCost: number;    // 单价快照（便于统计，避免依赖嵌套字段）
  pointsSpent: number;   // pointsCost * quantity
  moneyAmount: number;   // pointsSpent / pointsPerYuan，保留 2 位小数
  createdAt: string;
  updatedAt?: string;
}
```

### 3.3 `DB` 接口（`src/db/types/index.ts`）

- 删除 `rewardInstances: Table<RewardInstance, string>`
- 新增 `rewardPurchases: Table<RewardPurchase, string>`

### 3.4 Dexie 迁移 v6（`src/db/migrations/index.ts`）

```ts
// v6：购买即消费 —— 删除背包实例表，新增消费记录表；清理有效期字段，补齐积分货币比例
db.version(6).stores({
  rewardInstances: null,
  rewardPurchases: 'id, userId, templateId, createdAt, [userId+createdAt]',
}).upgrade(async (trans) => {
  const d = trans.db as DB;
  const templates = await d.rewardTemplates.toArray();
  const updates = templates.map((t) => ({
    key: t.id,
    changes: {
      validDuration: undefined,          // Dexie：显式 undefined 会删除该字段
      pointsPerYuan: t.pointsPerYuan ?? 1,
    },
  }));
  if (updates.length > 0) await d.rewardTemplates.bulkUpdate(updates);
});
```

> 注意：`rewardInstances: null` 会连同背包数据一起删除，符合「直接丢弃」的决策。

### 3.5 金额换算工具（新增 `src/libs/reward.ts`）

```ts
/** 积分 → 金额（元），保留 2 位小数；比例非法时返回 0 */
export function pointsToMoney(points: number, pointsPerYuan: number): number;
/** 金额展示，如 ¥12.5 / ¥12 */
export function formatMoney(amount: number): string;
/** 比例合法性：有限数且 > 0 */
export function isValidRatio(pointsPerYuan: number): boolean;
```

商店 UI、购买服务、统计页统一走这里，避免三处各写一份换算。

---

## 4. 实现任务（按顺序执行）

> 每个任务都是自包含的。执行者只改列出的文件，完成后跑 `bunx tsc --noEmit` 与相关 `bunx vitest`。

### Task 1 — 类型与数据库层

**文件**
- `src/db/types/reward.ts`
- `src/db/types/index.ts`
- `src/db/migrations/index.ts`
- `src/db/index.ts`
- `src/db/middleware/pointsHistoryMiddleware.ts`
- `src/libs/reward.ts`（新建）
- `src/libs/id.ts`（如 `hashRewardInstance` 已无引用则删除）

**内容**
1. 按 §3.1 / §3.2 重写 `reward.ts`（删 `validDuration`、`RewardStatus`、`RewardInstance`，加 `pointsPerYuan`、`RewardPurchaseSnapshot`、`RewardPurchase`）。
2. `types/index.ts`：`rewardInstances` → `rewardPurchases`。
3. `migrations/index.ts`：追加 v6（§3.4）。
4. `db/index.ts`：
   - 删除 `db.rewardInstances.hook('creating'/'updating', ...)` 两个 hook。
   - 新增 `db.rewardPurchases.hook('creating')`（补 `id = generateUUID()`、`createdAt`）与 `hook('updating')`（补 `updatedAt`），与 `replenishmentRecords` 写法保持一致。
   - 删除 `hashRewardInstance` import。
5. `middleware/pointsHistoryMiddleware.ts`：**删除整个 `db.rewardInstances.hook('creating', ...)` 区块**及文件顶部不再需要的 `RewardInstance` import。积分扣减改由 Task 2 的购买事务显式完成（现有 hook 用 `this.onsuccess` 在事务外写积分，本身有竞态，顺手修掉）。
6. 新建 `src/libs/reward.ts`（§3.5）。

**验收**
- `bunx tsc --noEmit` 在 Task 2 之前允许因 `rewardService` 仍引用旧类型而报错；本任务范围内文件自身无错误。
- 无 `rewardInstances` / `RewardInstance` 残留于以上文件。

---

### Task 2 — `rewardService`：购买 / 删除回滚 / 消费统计

**文件**
- `src/db/services/rewardService.ts`

**删除这些导出**（连同实现）
`createRewardInstance`、`redeemRewardWithStockCheck`、`redeemRewardsWithStockCheck`、`createRewardInstances`、`getAllRewardInstances`、`getRewardInstanceById`、`getRewardInstancesByTemplateId`、`getRewardInstancesByStatus`、`updateRewardInstance`、`useRewardInstance`、`useRewardInstances`、`checkAndUpdateExpiredRewards`、`deleteRewardInstance`、`deleteRewardInstances`、`deleteRewardInstancesByTemplateId`、`getRewardInstanceWithTemplate`、`getAvailableRewardInstances`、`getUserBackpack`、`getRewardStatistics`

**保留不动**
`createRewardTemplate`、`getAllRewardTemplates`、`getEnabledRewardTemplates`、`getRewardTemplateById`、`getRewardTemplatesByReplenishmentMode`、`updateRewardTemplate`、`toggleRewardTemplateEnabled`、`getStoreRewardTemplates`、补货相关全部（`getTemplatesNeedingReplenishment`、`replenishRewardTemplate`、`createReplenishmentRecord`、`getReplenishmentRecordsByTemplateId`、`getReplenishmentRecordsByUserId`、`deleteReplenishmentRecordsByTemplateId`、`calculateMissedDays`、`getReplenishmentScheduledDates`）

**修改 `deleteRewardTemplate`**：事务表集合改为 `rewardTemplates, rewardPurchases, replenishmentRecords`；删模板 + 补货记录，**不删消费记录**（历史记账要保留）。

**新增**

```ts
export async function purchaseReward(
  templateId: string,
  userId: number,
  quantity: number
): Promise<string>
```
单事务 `rw db.rewardTemplates, db.rewardPurchases, db.pointsHistory`：
1. `quantity` 必须为 `>= 1` 的整数，否则 `throw new Error('数量不合法')`。
2. 取模板；不存在 → `'商品不存在'`；`!enabled` → `'商品已下架'`。
3. `const ratio = isValidRatio(template.pointsPerYuan) ? template.pointsPerYuan : 1;`
4. `pointsCost <= 0` → `'商品积分价格无效'`。
5. 额度检查：`replenishmentMode !== 'none'` 且 `(currentStock ?? 0) < quantity` → `'消费额度不足'`。
6. `pointsSpent = pointsCost * quantity`；在当前事务内读 `pointsHistory` 求和得到余额，不足 → `` `积分不足。需要: ${pointsSpent}, 当前: ${balance}` ``（保留现有文案格式）。
7. `const purchaseId = generateUUID(); const now = new Date().toISOString();`
8. `db.rewardPurchases.add({ id: purchaseId, userId, templateId, template: {snapshot}, quantity, pointsCost, pointsSpent, moneyAmount: pointsToMoney(pointsSpent, ratio), createdAt: now })`。
9. `db.pointsHistory.add({ id: generateUUID(), userId, amount: -pointsSpent, type: 'reward_exchange', relatedInstanceId: purchaseId, description: `购买 ${title} ×${quantity}`, createdAt: now })`。
10. 有额度模式时扣 `currentStock`。
11. `return purchaseId;`

```ts
export async function getRewardPurchases(userId: number): Promise<RewardPurchase[]>
export async function getRewardPurchaseById(id: string): Promise<RewardPurchase | undefined>
```

```ts
/** 删除消费记录并回滚：删记录 + 删对应积分流水 + 返还额度 */
export async function deleteRewardPurchase(id: string): Promise<void>
```
单事务 `rw db.rewardTemplates, db.rewardPurchases, db.pointsHistory`：
1. 取 `purchase`；不存在直接 `return`。
2. `db.rewardPurchases.delete(id)`。
3. `db.pointsHistory.where('userId').equals(purchase.userId).filter(r => r.relatedInstanceId === id && r.type === 'reward_exchange').delete()`。
   - 直接删除原流水（而非写反向流水），保证积分明细与消费统计不会出现「已撤销但仍显示」的幽灵记录。
4. 模板仍存在且 `replenishmentMode !== 'none'` 时返还额度：`restored = (currentStock ?? 0) + quantity`，`replenishmentLimit !== undefined` 则 `Math.min(restored, replenishmentLimit)`。

```ts
export interface PurchaseTemplateBucket {
  templateId: string;
  title: string;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  count: number;        // 笔数
  quantity: number;     // 件数
  pointsSpent: number;
  moneyAmount: number;
}

export interface RewardPurchaseStats {
  pointsSpent: number;
  moneyAmount: number;
  count: number;        // 笔数
  quantity: number;     // 件数
  byTemplate: PurchaseTemplateBucket[];  // 按 pointsSpent 倒序
  purchases: RewardPurchase[];           // 区间内明细，createdAt 倒序
}

export async function getRewardPurchaseStats(
  userId: number,
  startISO: string,
  endExclusiveISO: string
): Promise<RewardPurchaseStats>
```
聚合规则：按 `templateId` 分组，`title/icon/iconColor` 取该组**最近一条**记录的快照（商品改名后展示最新快照，商品已删除仍可读）；`moneyAmount` 为组内各记录已取整金额之和。

**验收**
- `bunx tsc --noEmit` 通过（依赖 Task 4/5/7 同步改造，若尚未执行则允许相关调用点报错，按任务顺序执行即可）。

---

### Task 3 — 导出/导入适配

**文件**
- `src/db/services/exportImportService.ts`
- `src/db/services/exportImportService.test.ts`
- `src/pages/DataImportExport.tsx`
- `src/locales/zh.json` / `src/locales/en.json`（`data.import.preview.rewardInstances` → `rewardPurchases`）

**内容**
1. `ExportData.data`：`rewardInstances: RewardInstance[]` → `rewardPurchases: RewardPurchase[]`；同步 `ImportResult.stats`、`ImportPreview.stats` 字段。
2. 导出：读 `db.rewardPurchases`。
3. 校验 `validateBackup`：`requiredArrays` 把 `'rewardInstances'` 换成 `'rewardPurchases'`；备份兼容策略——**老备份（只有 `rewardInstances`、无 `rewardPurchases`）按缺失处理**，`rewardPurchases` 计 0，不报错。
4. 导入：清空 + 写入 `db.rewardPurchases`；模板写入前做归一化 `map(t => ({ ...t, pointsPerYuan: isValidRatio(t.pointsPerYuan) ? t.pointsPerYuan : 1, validDuration: undefined }))`，兼容旧备份。
5. `DataImportExport.tsx`：两处 `importPreview.stats.rewardInstances` / `importResult.stats.rewardInstances` 改为 `rewardPurchases`。
6. i18n：`data.import.preview.rewardInstances` → `data.import.preview.rewardPurchases`（zh: 「消费记录」/ en: "Purchases"）。若 `DataImportExport.tsx` 里是动态拼 key，保持键名一致即可。

**验收**
- `bunx vitest src/db/services/exportImportService.test.ts` 通过（用例同步改为 `rewardPurchases` 夹具，并补一条「老备份缺 `rewardPurchases` 仍可导入」的用例）。

---

### Task 4 — Hooks 层

**文件**
- `src/hooks/useRewards.ts`
- `src/hooks/useRewardPurchases.ts`（新建）

**`useRewards.ts` 删除**：`useAvailableRewards`、`useUserBackpack`、`useRewardStatistics`、`useRewardInstanceActions`，以及对应的 `getUserBackpack` / `getAvailableRewardInstances` / `getRewardStatistics` / `useRewardInstance` / `useRewardInstances` / `checkAndUpdateExpiredRewards` / `redeemRewardsWithStockCheck` import。

**`useRewards.ts` 保留**：`useRewardTemplates`、`useRewardTemplate`、`useRewardTemplateActions`、`useStoreRewards`、`useReplenishmentHistory`。

**新建 `src/hooks/useRewardPurchases.ts`**

```ts
/** 全部消费记录（倒序） */
export function useRewardPurchases(userId: number): {
  purchases: RewardPurchase[]; isLoading: boolean; error: string | null; refresh: () => Promise<void>;
};

/** 购买 / 删除回滚 */
export function useRewardPurchaseActions(): {
  purchase: (templateId: string, userId: number, quantity?: number) => Promise<string>;
  remove: (purchaseId: string) => Promise<void>;
  isLoading: boolean; error: string | null;
};

/** 周期统计：scope 为 'month' | 'year' | 'custom'，用 resolvePeriod 解析成 ISO 时间窗 */
export function useRewardPurchaseStats(input: {
  userId: number | null;
  scope: PurchaseScope;
  anchor: string;        // 用户日 YYYY-MM-DD
  customStart?: string;
  customEnd?: string;
}): {
  stats: RewardPurchaseStats | null;
  period: ReportPeriod | null;
  isLoading: boolean; error: string | null; refresh: () => Promise<void>;
};
```
- `PurchaseScope = 'month' | 'year' | 'custom'`
- 复用 `@/libs/report/period` 的 `resolvePeriod` + `getPeriodTimeWindow`，并从 `userStore.user.dayEndTime` 取用户日配置，保证与 Reports/积分明细的时间口径一致。
- 参考现有 `src/hooks/useReport.ts` 的写法（`useCallback` + `useEffect` 依赖三元组）。

**验收**
- `bunx tsc --noEmit` 中 `useRewards` 相关报错清空。

---

### Task 5 — 商店页改造

**文件**
- `src/pages/Store/index.tsx`
- `src/pages/Store/lib.ts`
- `src/pages/Store/components/RewardDetailPopup.tsx`
- `src/pages/Store/components/RewardsGrid.tsx`
- `src/pages/Store/components/PointsCard.tsx`（仅在需要展示本期消费时改，可选）

**内容**
1. `index.tsx`
   - `useRewardInstanceActions` → `useRewardPurchaseActions`；`redeem(...)` → `purchase(templateId, userId, quantity)`，去掉 `template.validDuration` 参数。
   - 头部左侧 `Package` + `/backpack` → `ChartPie`（或 `ReceiptText`）+ `/consumption`，label `t("consumption.title")`。
   - `handleRedeem` 里的积分/额度预检查保留（快速失败，服务层仍会再校验）。
   - 补货检查逻辑保留不动。
2. `lib.ts`
   - `getMaxQuantity` 逻辑不变（`Math.min(maxByPoints, maxByStock, 99)`）。
   - 新增 `getPurchaseMoney(reward, quantity): number`，内部用 `pointsToMoney(template.pointsCost * quantity, template.pointsPerYuan)`。
3. `RewardDetailPopup.tsx`
   - 删除 `formatDuration` / `formatDurationToString` / `Clock` / `store.validDuration` / `store.forever` 相关代码。
   - 右侧卡片由「有效期」改为「折合金额」：`¥{moneyAmount}`，副标题 `t("store.moneyValue")`。
   - 「总计」行同时展示积分与金额：`{totalCost} exp · ¥{money}`。
   - 主按钮文案与禁用逻辑沿用现有三分支（额度不足 / 积分不足 / 正常）。
4. `RewardsGrid.tsx`
   - 商品卡片在 `pointsCost exp` 后追加 `≈ ¥{pointsToMoney(pointsCost, pointsPerYuan)}`。
   - 库存提示文案由硬编码 `库存: N` 改为 `t("store.remainingQuota", { count })`，避免中文硬编码泄漏到 en。
5. i18n 新增：`store.moneyValue`、`store.remainingQuota`、`store.ratioShort`（如 `1:{{ratio}}`）；`store.redeem` 文案里的「兑换」→ 统一改为「购买」语义（`buy` / `buyCount`），`store.pointsShortage`、`store.stockShortage` 文案改为「积分不足」「消费额度不足」。

**验收**
- `bunx tsc --noEmit` 通过；手动在 dev 下走一遍购买流程（`bun run dev`）。

---

### Task 6 — 商品编辑页：删有效期、加比例

**文件**
- `src/pages/EditReward.tsx`
- `src/locales/zh.json` / `src/locales/en.json`

**内容**
1. 删除 `validDuration` 全部状态与 UI：`validDurationDays`、`hasValidDuration`、`Clock` import、整段 "Valid Duration" section（约 60 行）、提交时的 `validDurationSeconds` 计算。
2. 新增「积分货币比例」section（放在 Point Cost 之后）：
   - `const [pointsPerYuan, setPointsPerYuan] = useState(1)`
   - 加载时 `setPointsPerYuan(template.pointsPerYuan ?? 1)`
   - 提交时写入 `pointsPerYuan`，并做 `isValidRatio` 守卫（非法则 `alert(t("editReward.invalidRatio"))` 并 return）。
   - 控件用 `NumberInput`，参数 `min={0.1} step={0.5}`；**需要先确认 `NumberInput` 的 `input` 是否允许小数输入**：当前实现是受控 number input，`handleDecrease/Increase` 使用 `step`，`onChange` 走 `Number(e.target.value)`。若小数输入被截断，最小改动是在 `NumberInput` 增加可选 `allowDecimal?: boolean`（默认 false，保持既有调用点行为不变），本任务一并实现并只在本处传 `allowDecimal`。
3. 比例下方给一行实时预览：`100 积分 ≈ ¥{pointsToMoney(100, pointsPerYuan)}`，让用户直观看到换算结果。
4. 表单里其它文案是英文硬编码（既有现状），此处沿用，仅新增 key 走 i18n：`editReward.pointsPerYuan`（zh「积分货币比例」/ en "Points per ¥1"）、`editReward.pointsPerYuanHint`、`editReward.invalidRatio`。
5. 保存按钮文案 `Create Reward` / `Update Reward` 保持不变（既有现状，不在本次范围）。

**验收**
- 新建商品默认比例 1，可存 1.5；编辑已有商品回填正确；`bunx tsc --noEmit` 通过。

---

### Task 7 — 新建「消费统计」页

**文件（全部新建）**
- `src/pages/Consumption/index.tsx`
- `src/pages/Consumption/lib.ts`
- `src/pages/Consumption/components/PeriodSelector.tsx`
- `src/pages/Consumption/components/SummaryCards.tsx`
- `src/pages/Consumption/components/TemplateBreakdown.tsx`
- `src/pages/Consumption/components/PurchaseList.tsx`

**页面结构**
```
Header「消费统计」back
PeriodSelector       月 / 年 / 自定义  + ← 2026-09 →
SummaryCards         消费积分 | 折合金额 | 笔数
TemplateBreakdown    按商品聚合（图标 + 标题 + 占比条 + 积分/金额/件数）
PurchaseList         明细：图标 标题 ×数量  -积分  ¥金额  日期  [删除]
```

**要点**
1. `PeriodSelector`：复用 `@/components/FilterTabs` 与 `@/components/DatePicker`，参照 `src/pages/Reports/components/PeriodSelector.tsx`，但 options 只有 `['month','year','custom']`（消费记账不需要「周」）。`formatAnchorLabel` / `shiftAnchor` 可参照 `src/pages/Reports/lib.ts` 自行实现到 `Consumption/lib.ts`（month 显示 `YYYY-MM`，year 显示 `YYYY`）。
2. `SummaryCards`：三张卡片，分别 `stats.pointsSpent` / `formatMoney(stats.moneyAmount)` / `stats.count`。金额用主色强调。
3. `TemplateBreakdown`：按 `byTemplate` 渲染，进度条宽度 = `bucket.pointsSpent / maxPointsSpent * 100%`，颜色用 `bucket.iconColor ?? '#f56565'`，图标用 `@/components/DynamicIcon`。空态复用 `@/components/EmptyState`。
4. `PurchaseList`：每行用 `DynamicIcon` + 标题快照 + `×quantity` + `-pointsSpent` + `¥moneyAmount` + `formatRelativeDate(createdAt)`；右侧删除按钮走 `useConfirm()` 二次确认（文案 `consumption.confirmDelete`），确认后调 `useRewardPurchaseActions().remove(id)` 并 `refresh()`。
5. `lib.ts`：`PURCHASE_SCOPES`、`formatAnchorLabel`、`shiftAnchor`、`getMaxPoints(buckets)`。
6. 空数据 / 加载 / 错误态参照 `Reports/index.tsx` 用 `LoadingState` / `ErrorState` / `EmptyState`。

**i18n（zh + en 同步）**
```
consumption.title / subtitle
consumption.scope.month / .year / .custom
consumption.summary.points / .money / .count
consumption.breakdown.title / .empty
consumption.detail.title / .empty / .delete / .confirmDelete
consumption.quantity  「×{count}」
```

**验收**
- `bunx tsc --noEmit` 通过；dev 下切换月/年能看到正确的区间与聚合；删除一条记录后积分余额、消费统计、积分明细三处同步变化。

---

### Task 8 — 路由、入口、删除背包、i18n 收尾

**文件**
- `src/App.tsx`
- `src/pages/Profile/lib.ts`
- `src/locales/zh.json` / `src/locales/en.json`
- `src/locales/locales.test.ts`
- `src/components/PointsHistoryCard.tsx`
- 删除目录 `src/pages/Backpack/`（`index.tsx`、`lib.ts`、`components/BackpackItemList.tsx`、`components/StatsCard.tsx`、`components/StatusBadge.tsx`、`components/TabBar.tsx`）

**内容**
1. `App.tsx`：删除 `Backpack` import 与 `/backpack` 路由；新增 `Consumption` import 与 `/consumption` 路由（放在 `SimpleLayout` 组内）。
2. `Profile/lib.ts`：`{ icon: Backpack, label: "My Backpack", path: "/backpack" }` → `{ icon: ChartPie, label: "消费统计", path: "/consumption" }`（label 改为 i18n key `consumption.title` 更佳，但该数组当前就混用中英文硬编码，先保持既有风格，仅替换该项内容与图标）。
3. **删除整个 `src/pages/Backpack/` 目录**。
4. `PointsHistoryCard.tsx`：`getRewardInstanceById` → `getRewardPurchaseById`（import 与 `case "reward_exchange"` 分支），返回值取 `purchase?.template?.title ?? null`。
5. i18n：
   - 删除 `backpack.*` 整段（zh + en）。
   - 删除 `replenishment` 之外的失效键前先 grep 确认无引用。
   - `locales.test.ts` 的 `HEADER_KEYS`：`"backpack.title"` → `"consumption.title"`。
6. 全仓 grep `backpack|Backpack|rewardInstances|RewardInstance|validDuration|expiresAt|checkExpired|useRewardInstance`，确认除 `points.card` 之类的无关词外无残留。

**验收**
- `bunx tsc --noEmit` 无报错；`bunx vitest` 全绿。
- `grep -rn "backpack" src` 只剩空结果或注释历史。

---

### Task 9 — Reports 报告适配

**文件**
- `src/libs/report/types.ts`
- `src/libs/report/aggregate.ts`
- `src/db/services/reportService.ts`
- `src/libs/report/aggregate.test.ts`
- `src/db/services/reportService.test.ts`
- `src/locales/zh.json` / `src/locales/en.json`（`reports.extras.rewardsRedeemed` 文案）

**内容**
1. `types.ts`：`ReportSources.rewardInstances: RewardInstance[]` → `rewardPurchases: RewardPurchase[]`；删除 `RewardInstance` import，改 `RewardPurchase`。
2. `reportService.ts` `loadReportSources`：`db.rewardInstances...` → `db.rewardPurchases.where('userId').equals(userId).toArray()`，变量名同步。
3. `aggregate.ts` `computeExtras`：`sources.rewardInstances` → `sources.rewardPurchases`。
4. **不改 `ReportModel.extras.rewardsRedeemed` 的 key**（保持 `formatVersion: 1` 的 JSON 契约稳定），只把 i18n 文案改为「消费笔数」/「Purchases」。
5. 测试夹具同步替换。

**验收**
- `bunx vitest src/libs/report src/db/services/reportService.test.ts` 全绿；导出 Markdown 中 extras 行为「消费笔数: N」。

---

### Task 10 — 测试与最终校验

**文件**
- `src/db/services/rewardService.test.ts`（新建）
- `src/pages/Store/lib.test.ts`（新建，可选）

**`rewardService.test.ts` 用例**（参照 `exportImportService.test.ts` 的 `fake-indexeddb` 初始化方式）
1. 购买成功后：`pointsHistory` 新增一条 `-pointsSpent` 的 `reward_exchange`；`rewardPurchases` 新增一条，`moneyAmount` 正确。
2. 比例换算：`pointsCost=100, pointsPerYuan=2` → `moneyAmount = 50`；`pointsPerYuan=1.5, pointsCost=100` → `moneyAmount = 66.67`（2 位小数）。
3. 积分不足 → 抛错，且**不产生**任何 `rewardPurchases` / `pointsHistory` 记录（事务原子性）。
4. 额度不足 → 抛错且库存不变。
5. `replenishmentMode !== 'none'` 购买成功 → `currentStock` 正确扣减。
6. `deleteRewardPurchase` → 记录删除、对应积分流水删除、库存返还且不超过 `replenishmentLimit`。
7. `deleteRewardTemplate` → 商品与补货记录删除，**消费记录保留**。
8. `getRewardPurchaseStats` 区间过滤正确（边界含头不含尾），按商品聚合的 `pointsSpent` / `moneyAmount` / `count` / `quantity` 正确，`byTemplate` 按积分倒序。

**最终校验**
```bash
bunx tsc --noEmit
bunx vitest
bun run build
```

---

## 5. 影响面清单（改动全貌）

**删除**
- `src/pages/Backpack/**`（6 个文件）
- `RewardInstance`、`RewardStatus`、`RewardTemplate.validDuration`
- `rewardInstances` 表与全部实例 CRUD / 过期检查 / 背包查询
- `pointsHistoryMiddleware` 中的 `rewardInstances` hook

**新增**
- `rewardPurchases` 表 + `RewardPurchase` / `RewardPurchaseSnapshot`
- `src/libs/reward.ts`、`src/hooks/useRewardPurchases.ts`、`src/pages/Consumption/**`
- `/consumption` 路由

**修改**
- `src/db/{types,migrations,index,middleware,services}/*`
- `src/pages/{Store,EditReward,Profile,DataImportExport,Reports}` + `src/App.tsx`
- `src/libs/report/*`、`src/hooks/useRewards.ts`、`src/components/{PointsHistoryCard,NumberInput}.tsx`
- `src/locales/{zh,en}.json` + `locales.test.ts`

**不受影响**
- 任务系统、番茄钟、成就系统、补货逻辑本身、`pointsHistory` 表结构与既有积分类型

---

## 6. 边界与风险

| 风险 | 处理 |
| --- | --- |
| 老用户升级后背包数据消失 | 已确认「直接丢弃」。迁移前不额外备份；`exportImportService` 仍可导出旧数据（老备份可导入但 `rewardPurchases` 为 0） |
| 比例被改成 0 或负数导致除零 | `isValidRatio` 守卫 + 读取时 `/ 比例` 前统一 fallback 到 1；购买与编辑页双重校验 |
| 商品改名后统计显示 | 聚合取该商品**最近一条**购买快照的标题；商品已删除仍可读 |
| 商品删除导致历史丢失 | `deleteRewardTemplate` 不删 `rewardPurchases` |
| 金额浮点误差 | 每条记录写入时即 `round2`；聚合对已取整值求和，不做二次换算 |
| 删除回滚后积分明细出现幽灵记录 | 删除流水本身而非写反向流水；整段包在单事务里 |
| `NumberInput` 不支持小数 | Task 6 中加可选 `allowDecimal` prop（默认关闭，不影响既有调用点） |
| Reports 的 JSON 契约 | `extras.rewardsRedeemed` key 保持不变，只改展示文案 |
| 时区/用户日口径 | 统计复用 `resolvePeriod` + `getPeriodTimeWindow` + `user.dayEndTime`，与 Reports 完全一致 |

---

## 7. 建议提交拆分

1. `refactor(db): 奖品改为购买即消费，移除背包与有效期，新增消费记录表`
2. `feat(store): 商品支持积分货币比例，购买流程改为一次性消费`
3. `feat(consumption): 新增消费统计页（积分/金额/商品占比/月年切换/明细纠错）`
4. `chore: 清理背包页面、i18n 与报告/导出适配`

---

## 8. 执行结果（2026-09-15）

全部任务已实现。`bunx tsc --noEmit` 无错，`bunx vitest run` 15 个文件 / 177 个用例全绿，`bun run build` 通过。

### 计划外新增的改动点（侦察时漏掉的引用面）

| 文件 | 原因 |
| --- | --- |
| `src/libs/achievement/metrics.ts` | `AchievementSources.rewardInstances` → `rewardPurchases`；`reward_redeem_count` 改用消费笔数 |
| `src/db/services/achievementService.ts` | 同上（`loadSources`） |
| `src/services/achievementGenerator.ts` | 同上（`loadSources` + `itemsRedeemed`） |
| `src/hooks/useAchievementWatcher.ts` | liveQuery 签名源表换表 |
| `src/hooks/useProfileStats.ts` | `getRewardStatistics` 已删除，改用新增的 `getRewardPurchaseCount` |
| `src/pages/Profile/components/StatsSection.tsx` | "Items Redeemed" → "Purchases" |
| `src/db/types/achievement.ts` | 仅更新条件类型注释（`reward_redeem_count` 类型名保持不变，避免破坏已持久化的成就数据） |

### 执行中发现的既有问题

**`createRewardTemplate` 会强制覆盖 `currentStock`**（`currentStock: shouldReplenish ? 0 : undefined` 写在 `...template` 之后），因此 `EditReward` 里计算 `initialStock` 的整段代码从未生效。

处理方式：**保持服务层行为不变**（初始额度由补货流程负责，Store 打开时会自动补满，语义正确），改为删除 `EditReward` 中那段无效代码，避免误导。已在新测试中注明该行为。

### 新增测试

- `src/db/services/rewardService.test.ts`（19 例）：购买扣分/写记录、数量累加、比例换算（含 1.5 → ¥66.67）、积分不足的原子性、数量非法、商品下架、额度不足与扣减、删除回滚积分与额度、额度返还上限、删商品保留消费记录、统计区间边界与按商品聚合、改名后取最近快照、按用户隔离。
- `src/db/migrations/index.test.ts`（1 例）：**真实升级路径** —— 先用 v5 打开同一库写入带 `validDuration` 的老模板与背包实例，再用 `getDB()` 触发 v6，断言 `rewardInstances` 表被移除、`rewardPurchases` 存在、老模板补 `pointsPerYuan = 1`、已有比例不被覆盖、`validDuration` 被清除。
- `src/db/services/exportImportService.test.ts` 增 2 例：旧备份（无 `rewardPurchases`）导入成功且计 0；消费记录导出/还原 + 旧模板比例兜底。

### 提交拆分（实际）

计划里的 4 个 commit 无法做到每个都能独立编译 —— 前三个彼此互相依赖（类型/服务/调用点是一次性切换的），硬拆会让 `git bisect` 中间态全部编译失败。因此按「每个 commit 都能 `tsc` + 测试通过」合并为 2 个：

| Commit | SHA | 内容 |
| --- | --- | --- |
| `refactor(db)!: 奖品改为购买即消费，移除背包与有效期` | `0cfd414` | 数据层 + 服务层 + 全部调用点适配 + 商店/商品编辑页 UI + 删除背包页 + 新测试；46 文件 |
| `feat(consumption): 新增消费统计页` | `f11dce2` | 消费统计页 + 统计 hook + 路由/入口 + consumption i18n |

两个 commit 均已用独立 `git worktree` 验证：`bunx tsc --noEmit` 无错、`bunx vitest run` 全绿。

### 未提交

- `.pi/plans/2026-09-15-reward-economy/plan.md`（本计划文档）保持未跟踪，由你决定是否入库。
- 未做真机 Android 验证；`bun run dev` 下的手动流程未跑（无浏览器交互）。
