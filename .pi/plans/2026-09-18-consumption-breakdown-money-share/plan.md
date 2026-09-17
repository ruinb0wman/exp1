# 消费统计「商品占比」修复：显示百分比 + 改按金额计算

日期：2026-09-18
范围：`src/pages/Consumption`、`src/db/services`、`src/locales`（无需改）

---

## 1. 问题

你报的两个问题，定位如下（均已复现）：

| # | 问题 | 根因 |
| --- | --- | --- |
| 1 | 没有显示百分比 | `src/pages/Consumption/components/TemplateBreakdown.tsx` 里 `percent` **只用于进度条宽度**（`:38` 计算 `const percent = ...`，`:53` 用于 `style={{ width: `${percent}%` }}`），从未渲染成文本 |
| 2 | 应按金额算百分比与排名，实际按积分 | ① 分母错：`src/pages/Consumption/lib.ts:40` 的 `getMaxPoints()` 返回**最大的单个商品积分消耗**，`percent = bucket.pointsSpent / maxPoints` —— 这是「相对最大项」而不是「占总额比例」，所以第一名永远满格 100%，哪怕它只占总额 30%。② 排序错：`src/db/services/rewardService.ts:414` `sort((a, b) => b.pointsSpent - a.pointsSpent)`，也是积分口径 |

改成金额口径后还有一个连带收益：金额与积分在「单件金额」独立之后可能不同序（例如 100 积分 / ¥0 的奖品 vs 10 积分 / ¥5 的奖品），现在排名会正确按钱来。

---

## 2. 改法

### 2.1 服务层：按金额排名
`src/db/services/rewardService.ts`
```ts
const byTemplate = Array.from(bucketMap.values()).sort(
  (a, b) => b.moneyAmount - a.moneyAmount   // 原为 b.pointsSpent - a.pointsSpent
);
```
同步把 `RewardPurchaseStats.byTemplate` 的注释从「按积分消耗倒序」改为「按金额倒序（商品占比与排名都以金额为准）」。

### 2.2 口径工具：占总额的金额百分比
`src/pages/Consumption/lib.ts` —— **删除** `getMaxPoints`（唯一调用点是占比组件），**新增**：
```ts
/** 商品金额占总额的百分比；总额为 0（全免费额度）时返回 0，不产生 NaN */
export function getMoneySharePercent(moneyAmount: number, totalMoney: number): number {
  if (!Number.isFinite(moneyAmount) || !Number.isFinite(totalMoney) || totalMoney <= 0) return 0;
  return (moneyAmount / totalMoney) * 100;
}

/** 占比文案：10% 及以上取整（41%），10% 以下保留 1 位小数（3.4%），避免小项全显示成 0% */
export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return '0%';
  return percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1)}%`;
}
```

### 2.3 组件：显示百分比 + 进度条与数字同口径
`src/pages/Consumption/components/TemplateBreakdown.tsx`
- props 增加 `totalMoney: number`（页面传 `stats.moneyAmount`，避免组件内再求和引入浮点差）。
- 每行：`const percent = getMoneySharePercent(bucket.moneyAmount, totalMoney);`
- 右侧金额行补上百分比文本：
  ```
  [icon] 商品名                   3,200          ← 积分（不变）
         N 笔 · M 件              ¥25  41%       ← 金额 + 新增百分比
  [========= 进度条 =========]
  ```
- 进度条宽度 = `${percent}%`（**占总额比例**，与数字一致；最大项不再永远满格）。
- 金额为 0 的商品（积分 > 0 但 `moneyCost = 0`）显示 `¥0  0%`、进度条不显示长度 —— 这是金额口径的必然结果，与「按金额统计」一致，不特殊处理。

### 2.4 页面接线
`src/pages/Consumption/index.tsx`
```tsx
<TemplateBreakdown buckets={stats.byTemplate} totalMoney={stats.moneyAmount} />
```

---

## 3. 测试

1. `src/db/services/rewardService.test.ts`
   - 现有「按时间窗过滤并聚合」用例的两项金额恰好同序，**改完不会失败**，因此必须新增一条能区分口径的用例：
     - 商品 A：1 笔 1000 积分 / ¥1（moneyCost 1）
     - 商品 B：1 笔 10 积分 / ¥50（moneyCost 50）
     - 断言 `byTemplate[0].templateId === B`（金额多的排前），并断言按积分排会是 A —— 锁死「按金额排名」这个决定。
2. 新建 `src/pages/Consumption/lib.test.ts`
   - `getMoneySharePercent`：正常占比（25 / 100 → 25）、总额为 0 → 0、非有限值 → 0。
   - `formatPercent`：`0` → `0%`、`3.44` → `3.4%`、`41.6` → `42%`、`NaN` → `0%`。
   - 断言各商品占额之和 ≈ 100%（口径自洽）。

**验收**：`bunx tsc --noEmit`、`bunx vitest run`（基线 16 文件 / 196 用例，应变为 17 文件 / 200+ 用例且全绿）、`bun run build`。

---

## 4. 真实浏览器验证

`bunx vite --port 5199` + 真实 IndexedDB，清库后造两个「金额与积分不同序」的奖品（用于同时验证排名与百分比）：

| 奖品 | 积分价 | 单件金额 | 买法 | 期望 |
| --- | --- | --- | --- | --- |
| 积分王 | 1000 | ¥1 | 1 份 | 积分榜第一、金额榜第二 |
| 小钱多 | 10 | ¥50 | 1 份 | 积分榜第二、金额榜第一 |

期望在 `/consumption` 看到：
- 商品占比首行是**小钱多**（金额 ¥50，约占 98%），次行是积分王（¥1，约 2%）；
- 每行都显示百分比文本，且两行百分比之和 ≈ 100%；
- 进度条长度与百分比一致（首行几乎满格、次行很短），不再出现「第一名永远 100%、第二名按最大项缩放」的旧行为；
- 汇总卡的「折合金额 ¥51」与占比行金额之和一致。

清理：走查结束删除该 origin 的 IndexedDB、停掉 5199 dev server（不动你原有的 1420）。

---

## 5. 风险

| 风险 | 处理 |
| --- | --- |
| 改成金额口径后，纯积分奖品（金额 0）在占比里显示 0% 且条形不可见 | 这是「按金额统计」的直接结果；积分金额仍照常显示，不特殊处理。若你希望这类奖品退回按积分占比，告诉我，我再加一个「金额全为 0 时回退积分」的分支 |
| 百分比四舍五入后各行之和不正好 100% | 不做「最大余额法」补偿，展示层允许 99.9%/100.1% 的舍入差；测试只用容差断言 |
| 进度条从「相对最大项」改成「占总额」后视觉上整体变短 | 与数字口径一致是这次修复的重点（旧行为第一名永远满格，是本次要消除的误导） |

---

## 6. 执行结果（2026-09-18）

### 校验

| 命令 | 结果 |
| --- | --- |
| `bunx tsc --noEmit` | 无输出（通过） |
| `bunx vitest run` | 17 个测试文件 / **203 个用例全绿**（改动前 16 / 196；新增 `Consumption/lib.test.ts` 6 例 + 排名口径 1 例） |
| `bun run build` | 通过 |

### 真实浏览器验证（清库 + 直接造三条消费记录，故意制造「金额序 = 积分序完全相反」）

| 商品 | 积分支出 | 金额 |
| --- | --- | --- |
| 积分王 | 1000 | ¥1 |
| 中等奖 | 100 | ¥30 |
| 小钱多 | 10 | ¥50 |

总额 ¥81。`/consumption` 实测：

- **排名**：小钱多 → 中等奖 → 积分王（金额序）；若仍按积分排会完全相反（1000 / 100 / 10） —— 口径确实改了。
- **百分比数字**：`62%` / `37%` / `1.2%`（50/81 = 61.7% → 62%，30/81 = 37.0% → 37%，1/81 = 1.23% → 1.2%），三者之和 ≈ 100%。
- **进度条宽度**：`61.7284%` / `37.037%` / `1.23457%` —— 与百分比文本同口径（不再是「第一名永远满格」）。
- 汇总卡「折合金额 ¥81」与占比行金额之和一致。

**边界（总金额为 0）**：造一条纯积分奖品（100 积分 / ¥0，买 2 份）→ 占比显示 `¥0  0%`、条形宽度 `0%`、页面无 `NaN`、不崩溃。与计划一致未做特殊回退。

### 计划外的微调

百分比初版写成 `<p className="text-green-400 text-xs">¥50<span className="text-text-secondary">62%</span></p>` —— 子元素的颜色靠 Tailwind 工具类在样式表里的先后顺序压过父级（实测生效，但很脆）。已改成结构上无冲突：外层 `<p className="text-xs">`，金额与百分比各自带颜色类，并把间距从 6px 调到 8px。

### 未做

- 真机 Android 验证（与前几轮一致）。
- 提交：代码 + 计划文档两个 commit。
