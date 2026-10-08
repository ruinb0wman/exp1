# 奖品不再「删除」，改为「停用」+ 新增奖品管理页

日期：2026-10-08
范围：`src/db/services/rewardService.ts`、`src/composables/useRewards.ts`、`src/pages/EditReward.vue`、`src/pages/Store/index.vue`、`src/router/index.ts`、新增 `src/pages/RewardsManage/**`

---

## 1. 起因与澄清

起因是上一个改动（消费页按奖品分组，commit `02e2c87`）之后的疑问：**「分组是按 rewardTemplateId 分的吧？那删掉奖品会不会分类对不上？要不要把删除改成停用？」**

先核对事实（都读过代码 / 跑过）：

| 问题 | 事实 |
| --- | --- |
| 分组 key | `purchase.templateId` = `RewardTemplate.id`（顶层字段，与 `byTemplate` 一致） |
| 删了奖品，消费页的分组会不会对不上？ | **不会**。每条消费记录自带购买快照（title/icon/单价/是否计入统计），`rewardService.test.ts` 与 `Consumption/lib.test.ts` 都有「模板缺失仍可读快照」的用例 |
| 删除真正破坏了什么？ | ① `deleteRewardTemplate` 会**连带删除补货记录**（历史丢失）；② **重新建一个同名奖品 → 消费页出现两个同名分组**（历史一个、新的一个）—— 这才是「分类对不上」的真实来源；③ 不可撤销 |
| 停用能力 | **已存在**：`EditReward.vue` 表单里就有 `enabled` 开关；停用的奖品不进商店（`getStoreRewardTemplates` 过滤 `enabled`）、不参与补货（`rewardService.ts` 的 `getTemplatesNeedingReplenishment` 要求 `t.enabled`） |
| ⚠️ 致命前提 | 进 `/rewards/:id` 的**唯一入口是商店格子**，而商店只列启用的奖品 → 停用后**再也点不进去、无法重新启用**。`getAllRewardTemplates` 的 composable（`useRewardTemplates`）当时**没有任何页面在用**。也就是说：删掉 Delete 之前必须先补一个「能看到停用奖品」的入口，否则停用 = 单向操作（比删除更糟：数据还在但永远看不见） |

用户拍板：**新增独立「奖品管理」页**（参照 AllTasks），**`deleteRewardTemplate` 一并删干净**。

---

## 2. 改法

### 2.1 移除「删除奖品」这条路径（全仓库清零）

| 文件 | 改动 |
| --- | --- |
| `src/db/services/rewardService.ts` | 删除 `deleteRewardTemplate()`（连带删补货记录的那段事务） |
| `src/composables/useRewards.ts` | `useRewardTemplateActions` 去掉 `remove()` 与 `deleteRewardTemplate` import，返回 `{ create, update, toggleEnabled, isLoading, error }` |
| `src/pages/EditReward.vue` | 去掉 Header 的 Delete 按钮、`handleDelete()`、`Trash2` / `HeaderActionButton` / `useConfirm` 引用；原地留一条注释说明「停用 = 下架，可随时重新启用」 |
| `src/db/services/rewardService.test.ts` | 2 条依赖 `deleteRewardTemplate` 的用例改成直接 `db.rewardTemplates.delete(id)`（场景改为「**旧版本删过的库**」），**保留**覆盖：`deleteRewardPurchase` 在模板行缺失时仍能回滚积分；消费记录不依赖模板行仍可读 |

保留的服务端行为：`deleteRewardPurchase()`（删**消费记录**并回滚）**不受影响** —— 消费页的撤销入口照旧。`deleteRewardPurchase` 里「模板缺失就跳过额度返还」的分支也留着（旧库可能仍有被删掉的奖品），并继续有测试覆盖。

### 2.2 新增「奖品管理」页 `/rewards/manage`

```
src/pages/RewardsManage/
├── index.vue                          # Header + FilterTabs(All/Enabled/Disabled) + 统计行 + 列表
├── lib.ts                             # filterTemplatesByEnabled / getRewardStats / formatRewardSubtitle
├── lib.test.ts                        # 9 条
└── components/
    ├── RewardList.vue                 # Loading / Error / Empty / 行列表
    └── RewardTemplateRow.vue          # 图标 + 名称 + Disabled 徽标 + 副标题 + Power 开关 + 点击进编辑
```

- 路由插在 `rewards/new` 之后、`rewards/:id` **之前**（否则 `manage` 会被当成模板 id）。
- 数据用现成的 `useRewardTemplates`（`getAllRewardTemplates`，按积分升序）与 `useRewardTemplateActions.toggleEnabled` —— 这两个之前都是**无调用方的死代码**，现在成了唯一使用者。
- 行内开关与 AllTasks 的 `TaskTemplateCard` 同款（Power 图标 + `@click.stop`），点击整行进 `/rewards/:id`。

### 2.3 入口：商店页的「Manage」胶囊

`src/pages/Store/index.vue` 把搜索行改成 `[搜索框][Manage]`，胶囊**始终可见**（空状态也在）—— 这样「所有奖品都停用了 → 商店显示 No Rewards」时仍有路可走。视觉语言与 Home 的「All Tasks」胶囊一致。

---

## 3. 验证

### 3.1 自动化

- `bunx vitest run` → **29 files / 353 tests passed**（上一版 28 files / 346；新增 `RewardsManage/lib.test.ts` 7 条，`rewardService.test.ts` 两条删除用例被改写成等量的「旧库残留」用例，**条数不变**）
- `bun run typecheck` 干净；`bun run build` 3.93s 成功
- `grep -rn deleteRewardTemplate src/` → **无结果**（删除能力彻底清零）

### 3.2 真页面（dev server + bow 浏览器，真实点击）

1. 种子：Coffee（启用）、Retired prize（停用）+ 一笔 Retired prize 的历史消费记录。
2. 商店只列 Coffee，**Retired prize 不出现**；「Manage」胶囊在。
3. 商店 UI 真实兑换 Coffee ×1 → 积分 2000 → 1900。
4. `/rewards/manage`：标题 `Reward Management`、`All/Enabled/Disabled` 三个 tab、统计行 `1 enabled | 1 disabled · 2 total`、两行都在（Retired prize 带 `Disabled` 徽标 + 灰图标）。
5. 筛选：`Disabled` → 只剩 Retired prize；`Enabled` → 只剩 Coffee；`All` → 两行。
6. 开关：把 Coffee 关掉 → 统计变 `0 enabled | 2 disabled · 2 total`；回商店 → `No Rewards`，但**Manage 胶囊仍在**（这正是修复的缺口）；再启用 Coffee → 统计回到 `1 enabled | 1 disabled`。
7. 消费页不受停用影响：`/consumption` 仍显示两个分组 —— `Coffee 1 purchases · 1 items · 100 · ¥10` 与 **`Retired prize 1 purchases · 1 items · 50 · ¥0`**（停用的奖品分组照旧，快照自足）。
8. `Edit Reward` 页（停用奖品）：header 只剩 `Back`，**无 Delete**，`Enabled` 开关在。
9. 验证数据已清理（四张表计数归零），dev server 已停。

---

## 4. 副作用与遗留

- **代价**：应用内不再能永久删除奖品。误建的奖品只能停用（会一直留在管理页里）。这是用户明确选择的方向：换掉「删了再建 → 消费页两个同名分组」和「补货历史被连带删除」。
- **旧数据**：以前删过奖品的库仍可能有「有消费记录、没有模板行」的数据，消费页靠快照照常显示；`deleteRewardPurchase` 的额度返还分支对这类记录会跳过（本来也回滚不了）。
- **导出/导入**：`exportImportService` 走的是整表读写，没有用 `deleteRewardTemplate`，不受影响。
- 没有给 `RewardsManage` 加 FloatingAddButton（新建仍在商店页，一处入口），也没有在 Profile 的 QuickActions 里加第二个入口 —— 需要的话再说。
