# 取消兑换 99 上限 + 增加奖品模板删除入口

日期：2026-09-29
范围：`src/pages/Store/lib.ts`、`src/pages/Store/lib.test.ts`(新)、`src/pages/EditReward.tsx`、`src/locales/zh.json`、`src/locales/en.json`
可选范围：`src/db/services/rewardService.test.ts`（补一条「服务层不限制数量」的回归）
不改：DB 层、迁移、i18n 既有键、Header/Popup 组件

---

## 1. 目标

1. 取消「每次兑换最多 99 件」的 UI 上限，改为只受「积分余额」与「消费额度」两个真实约束限制。
2. 给奖品模板增加**删除入口**（决定：放在编辑页 Header 右上角的垃圾桶图标）。
3. 确认并锁定「删除商品不影响消费记录」这一前提 —— 每次购买都有快照，删除模板只删模板与补货记录。

已确认的两个设计决策（用户选择）：
- 删除入口只放**编辑页右上角垃圾桶**，商店弹窗与底部按钮都不加。
- **完全取消上限**，不留 9999 之类的兜底常数；0 积分无限量商品的 `max` 就是 `Infinity`（`NumberInput` 默认 `max = Infinity`，已支持）。

---

## 2. 现状（已读代码）

### 2.1 99 上限只有一处

`src/pages/Store/lib.ts:27-41`：

```ts
export function getMaxQuantity(
  reward: StoreReward | null,
  currentPoints: number
): number {
  if (!reward) return 1;
  const { template, availableCount } = reward;

  const maxByPoints = template.pointsCost > 0
    ? Math.floor(currentPoints / template.pointsCost)
    : Infinity;

  const maxByStock = template.replenishmentMode === 'none' ? Infinity : availableCount;

  return Math.max(1, Math.min(maxByPoints, maxByStock, 99));
}
```

- 全仓库 `grep 99` 在业务代码里只命中这一行（其余是 `23:59:59.999` 之类的时间常量），`src/locales/*.json` 里也没有 99。
- DB 服务层 `purchaseReward`（`src/db/services/rewardService.ts:170-278`）对 `quantity` 只校验 `Number.isInteger(quantity) && quantity > 0`，**没有 99 上限**。所以只需改 UI 这一行即与服务层一致。
- `maxQuantity` 的唯一消费方：`src/pages/Store/index.tsx:81` → `RewardDetailPopup.tsx:115` 的 `<NumberInput max={maxQuantity} />`。它**不参与** `canRedeem`/库存/积分校验（那些用 `availableCount` 与 `currentPoints` 现算），所以改它不会绕过任何校验。
- `NumberInput`（`src/components/NumberInput.tsx:52`）的 `max` 默认就是 `Infinity`；`applyBounds`（`src/libs/numberInput.ts:52`）用 `Math.min(max, ...)`，`Infinity` 天然安全；`isMaxReached = value >= max` 对 `Infinity` 恒为 false。现有测试 `src/components/NumberInput.test.tsx:18` 也用 `max = Infinity` 当默认值，说明该路径已被覆盖。

### 2.2 删除的数据能力已存在，只缺 UI

`src/pages/EditReward.tsx:44` 当前只取 create/update：

```tsx
const { create, update, isLoading: isSubmitting } = useRewardTemplateActions();
```

`useRewardTemplateActions()`（`src/hooks/useRewards.ts:76-125`）其实已经导出了 `remove`，全仓库**零调用**（`grep useRewardTemplateActions` 只命中 `EditReward.tsx` 与 hook 自身）。

`remove` → `deleteRewardTemplate`（`src/db/services/rewardService.ts:119-128`）：

```ts
/**
 * 删除奖励模板（同时删除关联的补货记录）
 * 注意：消费记录必须保留 —— 删掉商品不能抹掉记账历史
 */
export async function deleteRewardTemplate(id: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.rewardTemplates, db.replenishmentRecords, async () => {
    await db.replenishmentRecords.where('templateId').equals(id).delete();
    await db.rewardTemplates.delete(id);
  });
}
```

注意事务表里**没有** `rewardPurchases` —— 这正是「删商品≠删账」。

### 2.3 快照确认结论：每次购买都有快照，删除安全

- 写入侧：`purchaseReward` 在事务内**无条件**构造并落盘快照（`rewardService.ts:229-241`）：

```ts
const purchase: RewardPurchase = {
  ...
  template: toPurchaseSnapshot(template),
  quantity,
  pointsCost,
  pointsSpent: totalCost,
  moneyAmount: counted ? roundMoney(moneyCost * quantity) : undefined,
  ...
};
await db.rewardPurchases.add(purchase);
```

  `toPurchaseSnapshot`（`rewardService.ts:152-165`）写齐 `templateId/title/icon/iconColor/pointsCost/moneyCost/countInConsumption`，`moneyCost` 与 `countInConsumption` 都经归一化函数变成确定的 number/boolean，不会缺字段。

- 读取侧全部只读快照，**不查实时模板表**：
  - `src/pages/Consumption/components/PurchaseList.tsx:38,57,59,69,74` → `purchase.template.title / iconColor / icon / countInConsumption`
  - `src/db/services/rewardService.ts:381-430` `getRewardPurchaseStats` → `purchase.template.countInConsumption`、`bucket.title/icon/iconColor`
  - `src/components/PointsHistoryCard.tsx:74-77` → `purchase?.template?.title`
  - `src/libs/report/aggregate.ts:579-584` → `isCountedInConsumption(purchase.template.countInConsumption)`

- 删除后仍可回滚：`deleteRewardPurchase`（`rewardService.ts:305-341`）只在**模板还存在**时返还额度；模板已删就跳过额度返还、照常退积分。测试已覆盖。
- 历史数据风险为零：`rewardPurchases` 表是 v6 迁移**新建**的（`src/db/migrations/index.ts:96-98` 把 `rewardInstances` 置 `null` 并新建该表），快照字段从同一版起就在类型里（`src/db/types/reward.ts:84-96` 注释：`/** 购买时的商品快照：商品改名或删除后统计仍可读 */`）；v6 之前不存在消费记录。旧备份兼容路径（`exportImportService.ts:194-195`）处理的是「只有 rewardInstances、没有 rewardPurchases」，不会导入无快照的消费记录。
- 现有测试已锁定该前提：`rewardService.test.ts` 的
  - `商品已删除时仍可回滚积分`
  - `删除商品不会删除消费记录（记账历史保留）`（断言 `purchases[0].template.title === '吃饭'`）

**结论：删除模板不会影响任何消费记录、积分明细、消费统计与报告。**

---

## 3. 改法

### 3.1 `src/pages/Store/lib.ts` —— 去掉 99

`return Math.max(1, Math.min(maxByPoints, maxByStock, 99));`
→
`return Math.max(1, Math.min(maxByPoints, maxByStock));`

函数上方的注释「计算最大可购买数量（受积分与消费额度限制）」本来就准确，不动。

语义核对（改后）：
| 场景 | max | 说明 |
|---|---|---|
| 积分够、不补货（无限量） | `floor(points / cost)` | 只受积分限制 |
| 0 积分、不补货 | `Infinity` | 无限量、不花积分，数量无上限 |
| 0 积分、有补货 | `availableCount` | 受额度限制 |
| 积分不足（`floor = 0`） | `1` | 保留既有 `Math.max(1, ...)`，`canRedeem` 仍会拦住，行为不变 |

### 3.2 `src/pages/Store/lib.test.ts`（新建）—— 锁定不再有 99

新增最小回归，风格照 `src/pages/Store/` 现有 co-located 测试约定（vitest，`@/` 别名）：

```ts
import { describe, expect, it } from 'vitest';
import type { RewardTemplate } from '@/db/types';
import { getMaxQuantity, type StoreReward } from './lib';

function reward(overrides: Partial<RewardTemplate> = {}, availableCount = Infinity): StoreReward {
  return {
    template: {
      id: 't1', userId: 1, title: '吃饭', pointsCost: 100, moneyCost: 100,
      enabled: true, replenishmentMode: 'none', icon: 'Pizza',
      createdAt: '2026-09-01T00:00:00.000Z', ...overrides,
    } as RewardTemplate,
    availableCount,
  };
}
```

用例：
1. 受积分限制：`reward({ pointsCost: 100 })` + `currentPoints = 250` → `2`
2. 受额度限制：`reward({ replenishmentMode: 'daily' }, 5)` + `currentPoints = 100000` → `5`
3. **不再卡 99**：`reward({ pointsCost: 1 })` + `currentPoints = 1_000_000` → `1_000_000`
4. 0 积分、不补货 → `Infinity`
5. 0 积分、有额度 → `availableCount`
6. `null` → `1`；积分不足 → `1`（既有行为回归）

### 3.3 `src/pages/EditReward.tsx` —— 右上角垃圾桶 + 二次确认

1. import 增补：
   - `Header` → `import { Header, HeaderActionButton } from "@/components/Header";`
   - `import { useConfirm } from "@/hooks/useConfirm";`
   - `lucide-react` 行加 `Trash2`
2. 取 `remove` 与 confirm：
   ```tsx
   const { create, update, remove, isLoading: isSubmitting } = useRewardTemplateActions();
   const confirm = useConfirm();
   ```
3. 新增处理函数（放在 `handleSubmit` 附近）：
   ```tsx
   const handleDelete = async () => {
     if (!rewardId || !template) return;
     const ok = await confirm({
       title: t("common.delete"),
       message: t("editReward.confirmDelete", { title: template.title }),
       confirmLabel: t("common.delete"),
       variant: "danger",
     });
     if (!ok) return;
     try {
       await remove(rewardId);
       navigate(-1);
     } catch (err) {
       alert(err instanceof Error ? err.message : t("editReward.deleteFailed"));
     }
   };
   ```
   - 用 `template.title`（已加载的真实标题）而不是本地受控 `title` 输入框，避免「改了名还没保存就点删除」时确认框显示错名字。
   - 仅 `isEditing` 时显示（新建页没有可删对象）。
4. Header 加右槽：
   ```tsx
   <Header
     title={isEditing ? t("editReward.title") : t("editReward.createTitle")}
     back
     rightSlot={isEditing ? (
       <HeaderActionButton icon={Trash2} side="end" label={t("common.delete")} onClick={handleDelete} />
     ) : null}
   />
   ```
   `Header` 右槽容器是 `size-11`、`HeaderActionButton` 正好 `size-11`（`src/components/Header.tsx:56-89`），无需额外样式，符合 AGENTS.md 的 Header 约定。
5. 删除成功后 `navigate(-1)` 回到商店；`Store` 组件是另一条路由下的独立页面（`App.tsx:47-53`），返回时重新挂载并跑 `useStoreRewards` 的 mount refresh，列表与积分会自动刷新。

> 不加本地 `isDeleting` 状态：`useRewardTemplateActions` 的共享 `isLoading` 会让保存按钮短暂转圈，但确认框已防误触、成功后立即离页，失败才可见，收益不值得额外状态。若实现时发现失败态观感差，再补一个局部 `isDeleting` 禁掉垃圾桶按钮即可。

### 3.4 i18n（zh + en 同步）

`editReward` 段各加 2 个键（`common.delete` 已存在，直接复用）：

`src/locales/zh.json`（当前 375-386 行区间）：
```json
"confirmDelete": "确定删除「{title}」？消费记录会保留，补货记录会被一并删除。",
"deleteFailed": "删除失败"
```

`src/locales/en.json`:
```json
"confirmDelete": "Delete \"{title}\"? Spending records will be kept; restock history will be deleted.",
"deleteFailed": "Failed to delete"
```

`src/locales/locales.test.ts` 只校验 `HEADER_KEYS` 列表里的键，本次不新增标题键，无需改该测试；但两个语言文件必须都加（否则切英文会漏键）。

### 3.5（可选）`src/db/services/rewardService.test.ts` —— 服务层不限制数量

在「购买即消费」describe 里加一条，把「服务层本就没有 99 上限」也钉住：

```ts
it('不限制单次购买数量（99 上限只在 UI 层）', async () => {
  await seedPoints(100000);
  const templateId = await createRewardTemplate(template({ pointsCost: 1 }));
  const purchaseId = await purchaseReward(templateId, USER_ID, 5000);
  const purchase = await getRewardPurchaseById(purchaseId);
  expect(purchase!.quantity).toBe(5000);
  expect(purchase!.pointsSpent).toBe(5000);
});
```

---

## 4. 步骤与验证

| # | 步骤 | 文件 | 验证 |
|---|---|---|---|
| 1 | 去掉 `, 99` | `src/pages/Store/lib.ts` | `bunx tsc --noEmit` |
| 2 | 新建 lib 测试 | `src/pages/Store/lib.test.ts` | `bunx vitest run src/pages/Store/lib.test.ts` 全绿，重点是 `1_000_000` 与 `Infinity` 两例 |
| 3 | 加删除入口 | `src/pages/EditReward.tsx` | `bunx tsc --noEmit`（`HeaderActionButton`/`useConfirm`/`Trash2` 的缺失引用会被 `noUnusedLocals` 与类型检查拦住） |
| 4 | 加 i18n | `src/locales/zh.json`、`src/locales/en.json` | `bunx vitest run src/locales/locales.test.ts` |
| 5 | （可选）加服务层回归 | `src/db/services/rewardService.test.ts` | `bunx vitest run src/db/services/rewardService.test.ts` |
| 6 | 全量回归 | — | `bunx vitest run`（当前基线 22+ 文件全绿）、`bun run build` |
| 7 | 真机/真浏览器走查 | — | 见下 |

真浏览器走查（bow + `bun run dev`，真实 IndexedDB）：
1. 建一个 `pointsCost = 1`、不补货的商品，攒够积分后打开详情 → 数量输入框手动填 `1000`，**不再被夹回 99**，总计 = 1000 积分；购买成功后消费明细显示 `×1000`，积分余额、消费统计三处一致。
2. 建一个「0 积分 + 不补货」的商品 → 数量输入框的 `+` 按钮**不禁用**（`max = Infinity`），可连续增加；`canRedeem` 仍为真。
3. 在编辑页点右上角垃圾桶 → 弹出危险确认框，文案含商品名；取消则无变化；确认后回到商店，该商品从网格消失。
4. 删完后进「消费统计」页：该商品的明细行与按商品聚合的占比**仍在**（走快照），标题/图标正常；积分明细里对应 `购买 xxx` 流水也在；再删掉那条消费记录，积分正常返还、不报错（模板已删，跳过额度返还）。
5. 补货记录验证：给带补货的商品删掉后，`/replenishment/:templateId` 不再可达（商店已无入口），且 DB 内 `replenishmentRecords` 已随事务删除。

---

## 5. 风险与未知

1. **`Infinity` 传播**：`getMaxQuantity` 可能返回 `Infinity`，只传给 `NumberInput.max`。`NumberInput` 的默认 `max` 就是 `Infinity`，`applyBounds`/`isMaxReached`/`valueToText` 都只作用于**当前值**（始终有限），因此不会出现 `NaN`/空输入框。属已支持路径。
2. **0 积分无限量商品可无限下单**：这是「完全取消上限」的直接结果（用户已确认）。影响面小 —— 一次购买只写 1 条记录（`quantity` 大、`pointsSpent = 0`），不写 0 分流水，不产生记录泛滥。
3. **删除是硬删除、不可撤销**：模板与补货记录都删，只有消费记录留下。确认框已用 `variant: \"danger\"` 并写明后果。若日后想「软删除」，是另一个决定（需要加 `deletedAt` 与过滤），本次不做。
4. **共享 `isLoading` 的观感**：删除失败时保存按钮会闪一下转圈（见 3.3 备注），非功能问题。
5. **畸形导入数据的兜底（既有缺口，非本次引入）**：若有人手工构造/第三方生成含 `rewardPurchases` 但缺 `template` 字段的备份，`PurchaseList.tsx:57` 与 `aggregate.ts:583` 会抛 TypeError。现有兼容分支只处理「没有 rewardPurchases 字段」，不处理「有字段但记录缺快照」。本次不修；如要加固，可在 `getRewardPurchaseStats`/`PurchaseList` 里对 `purchase.template` 加可选链回退到积分流水描述。属可选后续项。
6. **无法从代码确定的一点**：`design/pages/editRewards.html` 里没有任何删除按钮设计稿（grep `delete|Delete|删除|Trash` 零命中），所以右上角垃圾桶是纯按现有 Header 约定新增的，没有设计稿可对齐颜色/位置；实现时用 `HeaderActionButton` 的默认 `text-text-secondary hover:text-primary` 即可，不手写样式。

---

## 6. 完成后记（2026-09-29）

已按方案实现并验证。

**改动**（`git status --short`）：
- `M src/pages/Store/lib.ts` —— `getMaxQuantity` 去掉 `, 99`
- `A src/pages/Store/lib.test.ts` —— 7 个用例（含「不再有 99 件上限」`1_000_000`、`Infinity` 两例）
- `M src/pages/EditReward.tsx` —— 引入 `HeaderActionButton`/`Trash2`/`useConfirm`，取 `remove`，新增 `handleDelete`，Header 加 `rightSlot`（仅编辑态）
- `M src/locales/zh.json`、`M src/locales/en.json` —— `editReward.confirmDelete` / `editReward.deleteFailed`
- `M src/db/services/rewardService.test.ts` —— 「不限制单次购买数量（99 上限只在 UI 层）」
- 注：`bun run dev` 会顺带重写 `bun.lock`（补 `tauri-plugin-background-service` 条目、删孤儿 `@types/node`/`undici-types`，属仓库既有的 lock 漂移）—— 已 `git checkout -- bun.lock` 还原，不在本次改动集内。

**静态与单测**：`bunx tsc --noEmit` 干净；`bunx vitest run` **24 文件 / 284 用例全绿**；`bun run build` 成功（仅既有 chunk >500kB 警告）。

**真浏览器走查**（bow + `bun run dev`，真实 IndexedDB，种子数据用完已清理）：
1. 99 上限：`pointsCost=1` 的商品在数量框填 `1000` → 输入框保留 `1000`（不再夹到 99），按钮 `购买 1000 个`，总计 `1,000 积分 ≈ ¥100000`；购买落库 `quantity=1000 / pointsSpent=1000 / moneyAmount=100000`，且 `template` 快照字段齐全（title/icon/iconColor/pointsCost/moneyCost/countInConsumption）。
2. 0 积分不补货商品：连点 `+` 到 `121`，`+` 仍不禁用（`max=Infinity`，`.disabled=false`）。
3. 删除入口：编辑页 Header 出现 `button[aria-label="删除"]`，点击弹危险确认框 `确定删除「测试商品-1积分」？消费记录会保留，补货记录会被一并删除。`；确认后 `navigate(-1)`，模板从 DB/商店消失。
4. 快照验证：删模板后 `rewardPurchases` 仍在（`templateId=cap-1`，快照 `title=测试商品-1积分`），`pointsHistory` 的 `-1000 购买 测试商品-1积分 ×1000` 仍在；`/consumption` 照常显示该商品占位与明细。
5. 模板已删后删消费记录：`deleteRewardPurchase` 正常退积分（余额回到 1,000,000）、删流水、不报错，页面回空态。
6. 补货记录：带 `replenishmentMode=daily` + 一条 `replenishmentRecords` 的模板删除后，`replenishmentRecords` 为空（事务内一并删除）。

**未做**：风险 5 的畸形导入兜底（既有缺口，本次未碰）；风险 6 无设计稿可对齐，实现用 `HeaderActionButton` 默认样式。

