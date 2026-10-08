# 消费页简化：去掉 By item 与分类筛选，只保留折叠分组

日期：2026-10-08
范围：`src/pages/Consumption/**`（**不碰** `src/db/**`）

---

## 1. 为什么改

`02e2c87` 给消费页加了「By item（按奖品聚合）+ 点它下钻到记录区 + 记录区筛选 chip」这一套。用下来结论是**多余**：记录区本身已经按奖品分组、点组头就能折叠展开，等于「分类查看」已经由折叠实现了 —— 再叠一层「按奖品聚合的排名 + 点它切换筛选 + 滚动定位」是两套入口做同一件事，还带来滚动跳动。

用户决定：**去掉 `By item` 整块 + 去掉 `Records by reward` 的筛选 chip 行，只用折叠分组。**

（中途还试过「By item 不可点、chip 保留但不滚动」的中间态，被否掉了 —— 直接一步到位。）

---

## 2. 改法

| 文件 | 改动 |
| --- | --- |
| `src/pages/Consumption/index.vue` | 删掉 `By item` 区块与 `TemplateBreakdown`；删掉 `FilterTabs` chip 行、`selectedTemplateId` / `activeTemplateId` / `visibleGroups` / `groupFor` / `rewardFilterOptions` / `selectReward` / `handleFilterChange` 与 `nextTick`、`DynamicIcon` 导入。现在页面 = 周期选择 → 汇总卡片 → `Records by reward` 折叠分组 |
| `src/pages/Consumption/components/TemplateBreakdown.vue` | **删除**（唯一调用点消失） |
| `src/pages/Consumption/lib.ts` | 删掉只服务于 `By item` 占比条的 `getMoneySharePercent()` 与 `formatPercent()` |
| `src/pages/Consumption/lib.test.ts` | 删掉上面两个函数的 6 条用例 |
| `src/pages/Consumption/components/RewardRecordGroups.vue` | 去掉 `expandedTemplateId` prop 与配套 `watch`（外部选中不存在了）；**默认改为全部折叠**（状态从「折叠集合」反转为「展开集合」）；展开区加 `pt-2`（原 `px-3 pb-3`） |
| `src/pages/Consumption/components/RewardRecordGroups.test.ts` | 改成「默认折叠」+「展开/折叠互不影响」2 条，删除「外部选中会重新展开」 |

保留不动：
- 分组口径（key = `purchase.templateId`、组头取最近快照、积分含全部记录而金额只含计入统计的、按 `lastAt` 倒序）；
- 行内删除 + 回滚；
- 服务层 `getRewardPurchaseStats()` 与其 `byTemplate` 聚合（仍在 `rewardService.test.ts` 里被锁定，见 §4）。

### 2.1 折叠默认值 + 第一行贴着组头（同一轮反馈）

- **默认全部折叠**：原实现是「`collapsed` 集合 = 默认展开」，改成「`expanded` 集合 = 默认折叠」。进入页面时只看得到各奖品的汇总行，想看明细再点开 —— 和「折叠即可」的初衷一致（奖品多时不再一屏全是明细）。
- **第一行与组头贴合**：实测不是几何重叠，而是第一行的浅色底块（`bg-surface-light`）正好从组头的下边缘开始（`firstRow.top === header.bottom`，组头下 padding 是透明的），视觉上像连在一起。展开区加 `pt-2`（8px，与行间距 `gap-2` 一致）。

---

## 3. 验证

- `bun run typecheck` 干净；`bunx vitest run` → **29 files / 346 tests passed**（上一版 353，减去被删的 6 条占比用例 + 2 条旧的展开默认值用例，新增 1 条互不影响用例）；`bun run build` 4.25s 成功
- 真页面（dev server + bow，种子 3 个奖品 / 4 笔消费，含一笔 `countInConsumption: false`）：
  - 页面里 **`By item` 不存在**、**筛选 chip 一个都没有**（`hasByItem: false`、chip 查询返回空数组）
  - 汇总仍是 `350 / ¥30 / 3 purchases · 4 items`；3 个分组按最近兑换倒序（Coffee → Snack → Game time），Snack 组头 `1 not counted`、`¥0`
  - 折叠（默认折叠）：进页面/刷新后 0 条记录行、每个组头 `aria-expanded="false"`；点开 Coffee 出现 3 条（+ 汇总卡片），再点回到 0
  - 展开后组头底边到第一行的间距 = **8px**（`padding-top: 8px`，行间距也是 8px），不再贴在一起
  - `window.scrollY` 全程为 0（没有任何滚动定位行为）
  - 验证数据已清理（三张表计数归零），dev server 已停

---

## 4. 遗留（留给用户决定）

`getRewardPurchaseStats()` 的 `byTemplate: PurchaseTemplateBucket[]` 现在**没有 UI 消费者**了（只有 `rewardService.test.ts` 的 6 条用例在用）。它是一份仍然正确的数据层聚合（「按金额倒序的商品占比桶」），删掉能少算一点、但要动服务层与那些测试；暂时**保留**，等确认以后不再需要占比视图再删。
