# 奖品计价重构：用「单份金额」取代「积分货币比例」

日期：2026-09-17
范围：`src/db`、`src/libs`、`src/pages`、`src/locales`

---

## 1. 目标与结论

**问题**：`pointsCost = 0` 的奖品（吃饭：每天 25 份额度、价值 ¥25）在当前模型下既买不了、也永远算不出金额。

**根因**（实测定位，非推测）：

| 层 | 位置 | 事实 |
| --- | --- | --- |
| 买不了 | `src/db/services/rewardService.ts:192` | `if (!Number.isFinite(pointsCost) \|\| pointsCost <= 0) throw new Error('商品积分价格无效')` —— 积分价 0 的奖品一点购买就抛错，**连消费记录都产生不了**。补货/额度不校验积分价，所以「每天补 25 份」看起来正常，问题被误认为出在比例上 |
| 算不出钱 | `src/db/services/rewardService.ts:224` | `moneyAmount: pointsToMoney(totalCost, ratio)`，而 `totalCost = pointsCost × 数量 = 0` → 恒为 ¥0。**比例是推导关系，0 积分必然归零** |
| 允许建出这种奖品 | `src/pages/EditReward.tsx:233` | `Point Cost` 用 `NumberInput min={0}`，可以保存积分价 0 的奖品 |

**结论**：把计价模型从「积分为主 + 比例换算金额」改为**「积分价 + 单份金额」两个独立字段**。

- `pointsCost`：单份所需积分（`0` = 不花积分）
- `moneyCost`：单份折合金额（元，`0` = 不记金额）
- 购买金额 `moneyAmount = moneyCost × quantity`（2 位小数），**不再有除法、不再有比例**

「吃饭」= `pointsCost 0 / moneyCost 1 / 每日额度 25` → 买 25 份 = 消费记录 0 积分、¥25。

---

## 2. 已确认决策 / 本次的默认口径

你已明确「统一改为单份金额」。以下是方案里我采用的配套口径，**若有不认同的逐条改**：

| 决策点 | 结论 | 理由 |
| --- | --- | --- |
| 字段名 | `moneyCost`（单份金额，元），与 `pointsCost` 对称 | 一眼看出两个价 |
| 金额精度 | 写入时 `round2`，汇总对已取整值求和 | 沿用既有记账口径 |
| 「计入消费统计」开关 | **保留**（`countInConsumption`） | 与金额来源正交：有些奖品就是不想记账 |
| 积分价 0 的购买 | 允许购买；**不写 amount 为 0 的 `reward_exchange` 积分流水** | 避免积分明细被没意义的 0 分行刷屏；`rewardPurchases` 照写，消费统计不受影响 |
| 积分不足校验 | `pointsCost = 0` 时 `balance < 0` 恒不成立，自然放行 | 不改逻辑 |
| 旧模板迁移 | v7 迁移：`moneyCost = round2(pointsCost ÷ pointsPerYuan)`，并删除 `pointsPerYuan` | 与旧模型算出的金额逐条等价 |
| 旧消费记录 | **不动**（`moneyAmount` 早已冻结在每条记录里） | 历史统计不变 |
| 旧备份导入 | 同样按上式兜底，并去掉 `pointsPerYuan` | 与迁移口径一致 |
| 新建奖品默认值 | `pointsCost = 100`、`moneyCost = 100`（沿用旧默认 1:1 的手感） | 平滑过渡；两者此后各自独立 |

---

## 3. ⚠️ 迁移后你必须手动做的一件事

旧模型下「吃饭」是 `pointsCost = 0`（或此前比例 1），迁移公式只能算出 `moneyCost = round2(0 ÷ 1) = ¥0` —— **机器无法猜出「¥25/天 ÷ 25 份 = ¥1/份」**。

所以升级后请打开「吃饭」编辑页，把**单件金额填成 1**，再保存。之后买 25 份就是 ¥25。

（如果你希望迁移时对 `pointsCost = 0` 的奖品填一个非 0 默认值，告诉我填几，我改成迁移里写死。）

---

## 4. 语义对照

| 场景 | 旧模型 | 新模型 |
| --- | --- | --- |
| 吃饭（每日免费额度 25 份，¥1/份） | 积分价 0 → 购买报错 / 金额恒为 0 ❌ | `pointsCost 0` + `moneyCost 1` → 买 25 份 = ¥25 ✅ |
| 香烟（20 积分，¥0.5/份） | `pointsCost 20` + `pointsPerYuan 2` | `pointsCost 20` + `moneyCost 0.5` |
| 看电影（50 积分，不记金额） | `pointsCost 50` + 关闭比例开关 | `pointsCost 50` + `moneyCost 0`（或保留开关关闭） |
| 改积分价 | **折合金额跟着变**（金额是推导值） | 金额不变（金额是独立设定值）—— 这是本次的语义变化 |
| 金额展示 | `formatMoney(pointsToMoney(points, ratio))` | `formatMoney(moneyCost × 数量)` |

---

## 5. 数据结构与迁移

### 5.1 `src/db/types/reward.ts`

```ts
export interface RewardTemplate {
  /** 单个商品所需积分，0 = 不花积分（如每日免费额度） */
  pointsCost: number;
  /** 单件折合金额（元），0 = 不记金额；金额条目 = moneyCost × quantity */
  moneyCost: number;
  // ...其余字段不变
  countInConsumption?: boolean;
}

export interface RewardPurchaseSnapshot {
  templateId: string;
  title: string;
  icon: RewardIconName;
  iconColor?: RewardIconColor;
  pointsCost: number;
  /** 购买时的单价快照（元） */
  moneyCost: number;
  countInConsumption?: boolean;
}

export interface RewardPurchase {
  // ...
  pointsSpent: number;
  /** 折合金额 = moneyCost × quantity，保留 2 位小数；关闭统计时不写（undefined） */
  moneyAmount?: number;
}
```

- `pointsPerYuan` 从两个接口上**删除**（迁移会从模板删字段；旧 purchase 快照里残留的同名字段类型上看不到、也不被读取，无害）。
- `moneyCost` 在 `RewardTemplate` 上设为**必填**，让所有构造点（编辑页、迁移、导入、测试夹具）都必须显式给值，避免漏填。

### 5.2 `src/libs/reward.ts`

```ts
export function roundMoney(amount: number): number;          // 2 位小数
export function isValidMoneyCost(moneyCost: number): boolean; // 有限且 >= 0
export function formatMoney(amount: number): string;          // 保留
export function isCountedInConsumption(flag?: boolean): boolean; // 保留
```

**删除**：`pointsToMoney`、`normalizeRatio`、`isValidRatio`、`formatRatio`（`formatRatio` 本来就无引用）。文件头注释改成「积分价 + 单份金额两个独立维度」。

### 5.3 `src/db/migrations/index.ts` 追加 v7

```ts
// v7：金额与积分解耦 —— 用「单件金额」取代积分货币比例
db.version(7).upgrade(async (trans) => {
  const d = trans.db as DB;
  const templates = await d.rewardTemplates.toArray();
  const updates = templates.map((t) => {
    const legacy = t as unknown as { pointsPerYuan?: number };
    const ratio = isValidRatio(legacy.pointsPerYuan) ? legacy.pointsPerYuan! : 1;
    return {
      key: t.id,
      changes: {
        moneyCost: roundMoney(t.pointsCost / ratio),
        pointsPerYuan: undefined, // Dexie：显式 undefined 会删除该字段
      },
    };
  });
  if (updates.length > 0) await d.rewardTemplates.bulkUpdate(updates);
});
```

**注意**：v6 的 upgrade 里那句 `pointsPerYuan: t.pointsPerYuan ?? 1` 在类型删除后会编译不过，改为 `(t as unknown as { pointsPerYuan?: number }).pointsPerYuan ?? 1` —— v6 依然负责给老模板补 1，紧接着 v7 再换算成 `moneyCost`。

---

## 6. 实现任务（按顺序）

> 每步只改列出的文件，完成后跑该步验收命令。

### Task 1 — 工具函数与类型
**文件**：`src/libs/reward.ts`、`src/db/types/reward.ts`
按 §5.1 / §5.2 改写。
**验收**：`bunx tsc --noEmit` —— 预期剩下所有读 `pointsPerYuan` 的报错清单（Task 2~5 逐个清掉），这是切换的检查表。

### Task 2 — 迁移 v7
**文件**：`src/db/migrations/index.ts`
按 §5.3 追加，并修掉 v6 里的类型读取。
**验收**：`bunx tsc --noEmit` 该文件无错。

### Task 3 — 服务层
**文件**：`src/db/services/rewardService.ts`
1. `createRewardTemplate`：`moneyCost: isValidMoneyCost(template.moneyCost) ? roundMoney(template.moneyCost) : 0`（替换原 `pointsPerYuan: normalizeRatio(...)`）。`updateRewardTemplate` 同理，只在 `updates.moneyCost !== undefined` 时归一化。
2. `toPurchaseSnapshot`：写 `moneyCost: roundMoney(template.moneyCost)`，删 `pointsPerYuan`。
3. `purchaseReward`：
   - 校验改为「积分价必须是有限的非负数」：`if (!Number.isFinite(pointsCost) || pointsCost < 0) throw new Error('商品积分价格无效')`（**放开 0**）。
   - `const moneyCost = roundMoney(template.moneyCost);`，`moneyAmount: counted ? roundMoney(moneyCost * quantity) : undefined`。
   - `totalCost === 0` 时**跳过**写 `pointsHistory`（不写 0 分流水）；`totalCost > 0` 时行为完全不变。
4. `getRewardPurchaseStats`、`deleteRewardPurchase`、补货相关**全部不动**（统计只读 `moneyAmount`；删除时按 `relatedInstanceId` 过滤积分流水，找不到就自然不删）。
**验收**：`bunx tsc --noEmit` 服务层无错。

### Task 4 — 编辑页 + i18n
**文件**：`src/pages/EditReward.tsx`、`src/locales/zh.json`、`src/locales/en.json`
1. 状态：`const [moneyCost, setMoneyCost] = useState(100);`（替换 `pointsPerYuan`，新建默认 100 = 沿用旧 1:1 手感）；回填 `setMoneyCost(template.moneyCost ?? 0)`。
2. 提交：`countInConsumption && !isValidMoneyCost(moneyCost)` → `alert(t("editReward.invalidMoneyCost"))`；payload 里 `pointsCost, moneyCost, countInConsumption`。
3. 区块（现 :258-325）改造：
   - 标题 `t("editReward.moneyCost")`（zh「单件金额」/ en "Unit Value"），右上角保留「计入消费统计」开关（现有 `role="switch"` 写法）。
   - 开关开启时：`NumberInput value={moneyCost} min={0} step={1} allowDecimal`，label `t("editReward.moneyCostLabel")`（zh「单件金额（¥）」），hint `t("editReward.moneyCostHint")`（zh「单件折合金额。积分价为 0 的免费额度也按它记账，例如 ¥1/份」），预览行 `t("editReward.moneyCostPreview", { points: pointsCost })` + `formatMoney(moneyCost)`。
   - 开关关闭时：一行 `t("editReward.moneyCostOffHint")`（zh「不折合金额，不计入消费统计」）。
   - 「Point Cost」输入保持 `min={0}`（现在 0 是合法值）。
4. i18n 删掉 `pointsPerYuan*` 四个 key，新增 `moneyCost`、`moneyCostLabel`、`moneyCostHint`、`moneyCostPreview`、`moneyCostOffHint`、`invalidMoneyCost`（zh + en 同步）。
**验收**：`bunx tsc --noEmit`；`bunx vitest run src/locales/locales.test.ts`。

### Task 5 — 商店页
**文件**：`src/pages/Store/lib.ts`、`src/pages/Store/components/RewardsGrid.tsx`、`RewardDetailPopup.tsx`
1. `getPurchaseMoney(template, quantity)` → `roundMoney(template.moneyCost * quantity)`。
2. `RewardsGrid`：金额展示改为 `formatMoney(template.moneyCost)`（不再 `pointsToMoney`）。
3. `RewardDetailPopup`：`purchaseMoney = getPurchaseMoney(...)`（**现在是线性的，数量变化就是乘法**，不再有除零/比例问题），其余「关闭统计则不显示金额」的既有分支保留。
4. `getMaxQuantity` 不动（`pointsCost > 0 ? floor(points/pointsCost) : Infinity`，积分价 0 → 无穷，最终由额度与 99 上限收口）。
**验收**：`bunx tsc --noEmit`；dev 下积分价 0 的奖品卡片显示 `¥1`、能加数量、总价随数量线性增长。

### Task 6 — 导出/导入
**文件**：`src/db/services/exportImportService.ts`（+ 其测试）
导入模板时归一化（旧备份没有 `moneyCost`）：
```ts
const legacy = template as unknown as { pointsPerYuan?: number };
moneyCost: isValidMoneyCost(template.moneyCost)
  ? roundMoney(template.moneyCost)
  : roundMoney(template.pointsCost / (isValidRatio(legacy.pointsPerYuan) ? legacy.pointsPerYuan : 1)),
```
（`isValidRatio` 若已从 libs 删除，就在此文件内联一个局部判断，或保留该函数仅用于兼容旧数据 —— 实现时选内联，别为一个一次性用途留公共 API。）
**验收**：`bunx vitest run src/db/services/exportImportService.test.ts`。

### Task 7 — 测试
**文件**：`src/db/services/rewardService.test.ts`、`src/db/migrations/index.test.ts`、`src/db/services/exportImportService.test.ts`、`src/libs/reward.test.ts`、`src/libs/report/aggregate.test.ts`
1. 夹具 `template()`：`pointsPerYuan: 1` → `moneyCost: 100`（保持原有期望值不变）。
2. 原「比例换算」两例改写为单份金额：
   - `moneyCost: 50` → 买 1 份 `moneyAmount = 50`；买 3 份 = 150（乘法的线性验证）
   - `moneyCost: 0.5` → 买 3 份 = 1.5（小数金额）
3. **新增核心用例（本次要修的场景）**：
   - `pointsCost: 0` + `moneyCost: 1` + 每日额度 25 → `purchaseReward(id, USER_ID, 25)` 成功；`pointsSpent === 0`、`moneyAmount === 25`；**不产生** `reward_exchange` 积分流水；`currentStock` 25 → 0；`getRewardPurchaseStats` 汇总 `moneyAmount === 25`、`quantity === 25`。
   - `pointsCost: 0` + 额度不足时仍抛「消费额度不足」。
   - 积分价负数 → 抛「商品积分价格无效」。
4. 快照口径既有用例（关闭比例只影响之后的购买）改用 `moneyCost`，断言不变。
5. `migrations/index.test.ts` 新增 `v7` 用例：先用 v6 结构建库写入 `pointsCost: 100 / pointsPerYuan: 2`（→ 期望 `moneyCost 50`）与 `pointsCost: 0 / pointsPerYuan: 1`（→ 期望 `moneyCost 0`）的模板，再用 `getDB()` 触发升级，断言 `moneyCost` 正确、`'pointsPerYuan' in t === false`、旧 purchase 记录不受影响。
6. `libs/reward.test.ts` 增补 `roundMoney`（0.005 进位、1.005 → 1.01 这类边界按 `Math.round` 行为写实）与 `isValidMoneyCost`（0 合法、负数/NaN 非法）。
7. `aggregate.test.ts` / `exportImportService.test.ts` 夹具里的 `pointsPerYuan` 改为 `moneyCost`。
**验收**：`bunx vitest run` 全绿。

### Task 8 — 全量校验 + 真实浏览器验证
```bash
bunx tsc --noEmit
bunx vitest run
bun run build
```
真实走查（`bunx vite --port 5199`，清库重跑，与上一轮同法）：
1. 建「吃饭」：积分价 **0**、单件金额 **1**、补货每日 25、额度上限 25。
2. 商店卡片显示 `0 exp` + `¥1`；购买弹窗能选到 25 份，「总计 0 积分 ≈ ¥25」。
3. 买 25 份 → `rewardPurchases`: `pointsSpent 0` / `moneyAmount 25`；`pointsHistory` 无新增行（积分明细不出现 0 分行）。
4. `/consumption`：汇总 `消费积分 0 / ¥25 / 1 笔 · 25 件商品`，商品占比「吃饭 25 件 ¥25」，明细一行 `-0 ¥25`。
5. 删掉这条记录 → 额度回到 25、统计归零（无积分可回滚）。
6. 再验证一个积分价 > 0 的奖品（如 20 积分 / ¥0.5）购买与统计不受影响。

---

## 7. 影响面清单

**修改**
- `src/libs/reward.ts`（换算函数换血）
- `src/db/types/reward.ts`（`pointsPerYuan` → `moneyCost`）
- `src/db/migrations/index.ts`（新增 v7 + v6 类型修正）
- `src/db/services/rewardService.ts`（创建/更新/快照/购买校验与金额、跳过 0 分流水）
- `src/pages/EditReward.tsx`、`src/pages/Store/{lib.ts,components/*}`、`src/locales/{zh,en}.json`
- `src/db/services/exportImportService.ts` + 5 个测试文件

**不动**
- `RewardPurchase.moneyAmount` 的语义与消费统计页全部组件（只读已冻结的 `moneyAmount`）
- 补货/额度逻辑、`pointsHistory` 表结构、成就/Profile 的购买次数口径
- `countInConsumption` 开关与其统计过滤（上一轮刚做，二者互补）

---

## 8. 风险与未知

| 风险 | 处理 |
| --- | --- |
| **迁移不可逆**（`pointsPerYuan` 从模板删除） | 换算关系逐条等价（`pointsCost ÷ ratio`），迁移前可先导出一次备份；旧 purchase 记录完全不参与迁移 |
| 语义变化：改积分价不再改变金额 | 有意的，正是「统一为单份金额」的含义；编辑页把两个价并排显示，避免误改 |
| 存量 `pointsCost = 0` 的奖品迁移后 `moneyCost = 0` | §3 已单列：需要手动填一次（如「吃饭」填 1）。若你要求迁移给个默认值，改一行即可 |
| 0 分购买不写积分流水 → 「购买必有一条流水」不变式被打破 | 只对 `pointsSpent === 0` 生效；`deleteRewardPurchase` 的流水过滤是 `filter` 删除，找不到不会报错；积分明细页只会少掉没意义的 0 分行 |
| 一处件数买 25 次很累 | `getMaxQuantity` 已允许一次买满额度（上限 99），弹窗数量输入可直接填 25 |
| 老备份导入时模板没有 `moneyCost` | Task 6 的兜底公式与 v7 迁移完全一致，导入后再跑一次等价换算 |
| 真机 Android 未验证 | 与前几轮一致，只保证 `tsc` / `vitest` / `build` + 浏览器端到端 |

---

## 9. 建议提交拆分

1. `refactor(reward)!: 奖品金额改用单份金额，移除积分货币比例（含 v7 迁移）`
   —— 类型/工具/迁移/服务/三个页面/i18n + 测试（必须一起落地，否则中间态编译不过）
2. `chore(reward): 旧备份导入适配单份金额`

---

## 10. 执行结果（2026-09-18）

Task 1~8 全部完成。

### 校验

| 命令 | 结果 |
| --- | --- |
| `bunx tsc --noEmit` | 无输出（通过） |
| `bunx vitest run` | 16 个测试文件 / **196 个用例全绿**（改动前 186；新增 0 积分场景 3 例 + `libs/reward.test.ts` 重写为 10 例） |
| `bun run build` | 通过 |

### 真实浏览器端到端走查（`bunx vite --port 5199` + 真实 IndexedDB，清库重跑）

**1. 你要的场景（吃饭：0 积分 / ¥1 一份 / 每日 25 额度）**
- 编辑页：`Point Cost 0` + `单件金额 1`，预览行显示「0 积分 / 份 折合 ¥1」；`Daily` + `Restock amount 25` + `Stock Limit 25`。
- 存储实测：`{ pointsCost: 0, moneyCost: 1, replenishmentMode: 'daily', replenishmentNum: 25, replenishmentLimit: 25 }`，`'pointsPerYuan' in t === false`。
- 商店卡片：`0 exp` + `¥1` + `剩余 25`；弹窗选 25 份时「总计 0 积分 ≈ ¥25」。
- 买 25 份：消费记录 `qty 25 / pointsSpent 0 / moneyAmount 25`，快照 `moneyCost 1`；**`pointsHistory` 里 0 条 `reward_exchange`**（不写 0 分流水）；额度 25 → 0。
- `/consumption`：汇总 `消费积分 0 / 折合金额 ¥25 / 1 笔 · 25 件商品`，商品占比「吃饭 1 笔 · 25 件 / 0 / ¥25」，明细「吃饭 ×25 / 0 / ¥25」。
- 删除该记录：额度回到 25、统计归零（无积分可回滚，`deleteRewardPurchase` 的流水过滤找不到记录不报错）。

**2. 积分价 > 0 的回归（香烟：20 积分 / ¥0.5）**
- 卡片 `20 exp` + `¥0.5`；弹窗 3 份 → 「总计 60 积分 ≈ ¥1.5」（线性乘法，不再是比例除法）。
- 消费记录 `moneyAmount 1.5`；积分 100 → 40，写入一条 `-60` 的 `reward_exchange` 流水（原有路径不变）。

**3. 关闭「计入消费统计」开关**（上一轮功能）仍然有效：关闭后不写 `moneyAmount`、不计入汇总，明细保留并标注。

### 计划外发现的显示瑕疵（已修）

0 积分的消费明细原样渲染成 **`-0`**（模板串 `-{pointsSpent}` 拼出来的）。已在 `PurchaseList.tsx` 修正：`pointsSpent > 0 ? '-N' : '0'`，并把 0 分的数字改成灰色（不再用主色强调），避免看起来像“负零消费”。

### 计划外补充的测试

- `0 积分的免费额度：可以购买、按单件金额记账、不写 0 分流水`
- `0 积分但额度不足时仍抛错`
- `负数积分价被视为无效`
- `roundMoney` 的浮点边界写实（`1.005 → 1`，与旧 `pointsToMoney` 同行为，避免后人误改记账口径）

### 未做 / 待你确认

- **真机 Android 未验证**（与前几轮一致，只到浏览器端到端）。
- 你现有的「吃饭」升级后 `moneyCost = 0`（公式 `0 ÷ 1`），**需要手动改成 1**；我未按猜测给它填默认值（见 §3）。若想要迁移时写死一个值，说一声。
- 提交：计划拆两个 commit（功能 + 导入适配）。
