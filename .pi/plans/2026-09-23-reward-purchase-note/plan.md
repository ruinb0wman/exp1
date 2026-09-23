# 兑换奖品时填写备注

日期：2026-09-23
范围：`src/db/types/reward.ts`、`src/libs/reward.ts`、`src/db/services/rewardService.ts`、
`src/hooks/useRewardPurchases.ts`、`src/pages/Store/index.tsx`、
`src/pages/Store/components/RewardDetailPopup.tsx`、`src/pages/Consumption/components/PurchaseList.tsx`、
`src/locales/{zh,en}.json`、`src/libs/reward.test.ts`、`src/db/services/rewardService.test.ts`
不涉及：无 DB 版本/迁移、无 export/import 改动、无 Rust / tauri、**不新增依赖**

---

## 1. 目标与前提

1. 在商店页兑换奖品时，弹层里可以填一段**可选备注**（多行 textarea）。
2. 备注随消费记录落库，并显示在**两处**：
   - 消费统计 → 明细（`Consumption` → `PurchaseList`）
   - 积分明细（`PointsHistory` → `PointsHistoryCard` 的副标题行）
3. **只在兑换时填一次**，事后不给编辑入口（填错了就删掉这条消费记录重兑 —— 现有删除即回滚已经能做到）。
4. 已拍板的三点：展示范围＝消费明细＋积分明细；不可事后编辑；控件＝多行 textarea。

假设：
- 备注是**整单一条**（一次兑换一份备注），不是每件一条。数量已有独立的 `quantity` 字段。
- 备注为空／纯空白时等同于「没填」，不写字段、不改变文案格式。

---

## 2. 现状（已读代码）

### 2.1 兑换链路：一次事务写两张表

`src/pages/Store/index.tsx:82-116` 的 `handlePurchase` 调 `purchase(template.id!, user.id, redeemQuantity)`；
`src/hooks/useRewardPurchases.ts:64-78` 只是透传给服务层：

```ts
const purchase = useCallback(
  async (templateId: string, userId: number, quantity: number = 1) => {
    ...
    return await purchaseReward(templateId, userId, quantity);
```

`src/db/services/rewardService.ts:222-251` 在同一个事务里写 `rewardPurchases` + `rewardTemplates`(扣额度) + `pointsHistory`：

```ts
      const purchase: RewardPurchase = {
        id: purchaseId,
        userId,
        templateId,
        template: toPurchaseSnapshot(template),
        quantity,
        pointsCost,
        pointsSpent: totalCost,
        moneyAmount: counted ? roundMoney(moneyCost * quantity) : undefined,
        createdAt: now,
      };
      await db.rewardPurchases.add(purchase);

      // 0 积分的免费额度不写 0 分流水，避免刷屏积分明细
      if (totalCost > 0) {
        const spendRecord: PointsHistory = {
          ...
          description: `购买 ${template.title} ×${quantity}`,
          createdAt: now,
        };
        await db.pointsHistory.add(spendRecord);
      }
```

注意两点：
- **0 积分的免费额度不写积分流水**（`if (totalCost > 0)`）⇒ 这类兑换的备注只可能出现在消费明细。
- `PointsHistory.id` 由 `hashPointsHistory(relatedInstanceId, type, stageId)` 生成（`src/db/index.ts:113-124`），
  **与 `description` 无关** ⇒ 改文案不会撞主键。

### 2.2 两处展示点

消费明细 `src/pages/Consumption/components/PurchaseList.tsx:66-79` 现在只有「标题 ×N」+ 时间：

```tsx
						<div className="flex-1 min-w-0">
							<p className="text-text-primary font-medium truncate">
								{purchase.template.title}
								...
							</p>
							<p className="text-text-muted text-xs">
								{formatPurchaseDateTime(purchase.createdAt)}
							</p>
						</div>
```

积分明细 `src/components/PointsHistoryCard.tsx:138-146` 主行取奖品名（`getRelatedEntityName` 会
`getRewardPurchaseById` 查快照标题），副行是 `description`：

```tsx
        <p className="text-text-primary font-medium">
          {entityName || label}
        </p>
        <p className="text-text-secondary text-sm truncate">
          {item.description || label}
        </p>
```

⇒ **只要把备注拼进 `pointsHistory.description`，积分明细页无需改动**（这正是所选方案的做法）。

### 2.3 数据模型与迁移

`src/db/types/reward.ts:76-96` 的 `RewardPurchase` 目前没有备注字段。
Dexie schema（`src/db/migrations/index.ts:120`）：

```ts
		rewardPurchases: 'id, userId, templateId, createdAt, [userId+createdAt]',
```

`note` **不参与索引** ⇒ 加一个可选字段**不需要升 version、不需要 migration**，旧记录读出来就是 `undefined`。
`src/db/services/exportImportService.ts` 是整表 `toArray()` / `bulkPut()` ⇒ 备份自动带上 `note`，无需改动。

---

## 3. 改动清单

### 3.1 `src/db/types/reward.ts` — 加字段

`RewardPurchase` 里新增（放在 `moneyAmount?` 之后）：

```ts
  /**
   * 兑换时填写的一次性备注（整单一条）；缺省 = 未填。
   * 只读展示：不提供事后编辑入口，填错请删除该消费记录后重兑。
   */
  note?: string;
```

不改 `RewardPurchaseSnapshot`：备注是每笔购买自己的，不属于商品快照。

### 3.2 `src/libs/reward.ts` — 归一化纯函数（可单测）

新增常量与函数：

```ts
/** 备注最大长度（与 textarea 的 maxLength 保持一致） */
export const MAX_PURCHASE_NOTE_LENGTH = 200;

/**
 * 归一化兑换备注：去首尾空白、超长截断；空/纯空白返回 undefined（= 未填）
 */
export function normalizePurchaseNote(note?: string): string | undefined {
  if (typeof note !== 'string') return undefined;
  const trimmed = note.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_PURCHASE_NOTE_LENGTH);
}
```

### 3.3 `src/db/services/rewardService.ts` — 落库 + 拼文案

- 改签名为 `purchaseReward(templateId, userId, quantity = 1, note?: string)`（第 171 行附近）。
- 事务内、构造 `purchase` 之前：

```ts
      const normalizedNote = normalizePurchaseNote(note);
```

- `purchase` 对象加 `note: normalizedNote`（第 222-231 行）。
- 流水文案：保留旧格式做基底，有备注时追加「 · 备注」（换行压成空格，保持单行）：

```ts
        const purchaseLabel = `购买 ${template.title} ×${quantity}`;
        const notedLabel = normalizedNote
          ? `${purchaseLabel} · ${normalizedNote.replace(/\s+/g, ' ')}`
          : purchaseLabel;
```

然后 `description: notedLabel`。

### 3.4 `src/hooks/useRewardPurchases.ts` — 透传

`useRewardPurchaseActions` 里 `purchase(templateId, userId, quantity = 1, note?: string)`，
第四个参数原样传给 `purchaseReward`。

### 3.5 `src/pages/Store/index.tsx` — 弹层状态

- 新增 `const [redeemNote, setRedeemNote] = useState("")`（挨着 `redeemQuantity`）。
- `handleRewardClick` 里 `setRedeemNote("")`（第 74 行附近，与 `setRedeemQuantity(1)` 一起）。
- `handlePurchase` 里改为 `await purchase(template.id!, user.id, redeemQuantity, redeemNote)`，
  成功后 `setRedeemNote("")`，依赖数组加 `redeemNote`。
- 给 `RewardDetailPopup` 传 `note={redeemNote}` / `onNoteChange={setRedeemNote}`。

### 3.6 `src/pages/Store/components/RewardDetailPopup.tsx` — 输入框

- props 加 `note: string` / `onNoteChange: (note: string) => void`。
- 在「数量 + 总计」卡片之后、`redeemError` 之前插入一块（风格对 `EditReward` 的描述 textarea）：

```tsx
      <div className="bg-surface rounded-xl p-4">
        <div className="flex items-center justify-between pb-2">
          <span className="text-text-secondary text-sm">{t("store.noteLabel")}</span>
          <span className="text-text-muted text-xs">
            {note.length}/{MAX_PURCHASE_NOTE_LENGTH}
          </span>
        </div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={MAX_PURCHASE_NOTE_LENGTH}
          rows={2}
          placeholder={t("store.notePlaceholder")}
          className="w-full resize-none rounded-lg bg-surface-light text-text-primary placeholder:text-text-muted p-3 text-base focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
```

（`MAX_PURCHASE_NOTE_LENGTH` 从 `@/libs/reward` import。）

### 3.7 `src/pages/Consumption/components/PurchaseList.tsx` — 显示备注

在时间那行下面追加（有备注才渲染）：

```tsx
							{purchase.note && (
								<p className="text-text-secondary text-xs mt-0.5 whitespace-pre-line break-words">
									{purchase.note}
								</p>
							)}
```

不用 `truncate`：备注允许多行，用 `whitespace-pre-line break-words` 展示完整内容。

### 3.8 i18n：`src/locales/zh.json` / `en.json`

`store` 段（zh.json:187-200）补两个键，两种语言都要加：

| key | zh | en |
| --- | --- | --- |
| `store.noteLabel` | `备注（可选）` | `Note (optional)` |
| `store.notePlaceholder` | `例如：和朋友一起 / 周末奖励自己` | `e.g. with friends / weekend treat` |

### 3.9 测试

`src/libs/reward.test.ts` 新增 `describe('normalizePurchaseNote')`：
- `undefined` / `''` / `'   '` / `'\n\t'` → `undefined`
- `'  和朋友一起  '` → `'和朋友一起'`
- 保留内部换行：`'第一行\n第二行'` → 原样（只 trim 两端）
- 超长（201 字符）→ 截断到 200
- 非字符串（`null as never`）→ `undefined`

`src/db/services/rewardService.test.ts` 在「购买即消费」describe 里新增：
- **带备注**：`purchaseReward(id, USER_ID, 1, '  和朋友一起  ')` → `purchase.note === '和朋友一起'`；
  对应 `pointsHistory` 记录（`relatedInstanceId === purchaseId`）的 `description === '购买 吃饭 ×1 · 和朋友一起'`。
- **不带备注**：`note` 为 `undefined`，`description === '购买 吃饭 ×1'`（回归保护：旧格式不变）。
- **0 积分免费额度 + 备注**：`purchase.note` 有值、积分明细里**没有**对应流水（沿用现有 `totalCost > 0` 口径）。
- **备注含换行**：`purchase.note` 保留换行，`description` 里换行被压成空格（单行）。

---

## 4. 实施顺序（每步可独立验证）

1. `src/libs/reward.ts` + `src/libs/reward.test.ts`（纯函数，`bunx vitest src/libs/reward.test.ts`）。
2. `src/db/types/reward.ts` 加 `note?`；`src/db/services/rewardService.ts` 接入
   （`bunx vitest src/db/services/rewardService.test.ts`）。
3. `src/hooks/useRewardPurchases.ts` 透传 + `src/pages/Store/index.tsx` 状态。
4. `src/pages/Store/components/RewardDetailPopup.tsx` textarea + i18n 两个键
   （`bunx tsc --noEmit`，`bun run build`）。
5. `src/pages/Consumption/components/PurchaseList.tsx` 展示备注。
6. 全量：`bunx vitest` + `bunx tsc --noEmit`。

---

## 5. 风险 / 未知 / 需要留意

1. **备注会顺带出现在报告里**（所选方案的副作用，不是新增渲染）：`src/libs/report/renderMarkdown.ts:265`
   会把 `pointsHistory.description` 原样写进报告的积分明细表。好消息是 `cell()`
   （renderMarkdown.ts:11-13）会转义 `|` 并把换行压成空格，不会破坏 Markdown 表格。
   **若不接受**：改成不写 `description`，由 `PointsHistoryCard` 用 `getRelatedEntityName` 里那次
   `getRewardPurchaseById` 顺带读 `note`（会多改一个组件 + 它的测试）。
2. **0 积分免费额度奖品**：不写积分流水 ⇒ 备注只在消费明细可见。这是既有口径，不额外处理。
3. **删除消费记录会连带删掉积分流水**（`deleteRewardPurchase`，rewardService.ts:279-319），备注随之消失；
   没有编辑入口，所以「填错了」的唯一修法是删除重兑（与现有模型一致）。
4. **旧备份 / 旧记录**：`note` 一律为 `undefined`，消费明细不渲染该行，无兼容问题。
5. **不改 Dexie version**：`note` 不进索引。若后续想按备注搜索，才需要动 schema —— 本轮不做。
6. 备注上限 200 字符（`MAX_NOTE_LENGTH`）：只是一个防长文本的保护值，若嫌短/长，改一个常量 + 一条测试即可。

---

## 6. 完成后记（2026-09-23）

### 6.1 落地清单

| 文件 | 改动 |
| --- | --- |
| `src/db/types/reward.ts` | `RewardPurchase.note?: string`（+ 注释说明「只读展示、填错请删除重兑」） |
| `src/libs/reward.ts` | `MAX_PURCHASE_NOTE_LENGTH = 200`、`normalizePurchaseNote()` |
| `src/db/services/rewardService.ts` | `purchaseReward(..., note?)`；事务外归一化；`purchase.note`；流水描述拼 `· 备注`（`\s+` → 空格） |
| `src/hooks/useRewardPurchases.ts` | `purchase(..., note?)` 透传 |
| `src/pages/Store/index.tsx` | `redeemNote` 状态；打开/成功后重置；传给弹层；`purchase(..., redeemNote)` |
| `src/pages/Store/components/RewardDetailPopup.tsx` | 备注 textarea（`maxLength`、字数 `n/200`、`rows=2`） |
| `src/pages/Consumption/components/PurchaseList.tsx` | 时间行下方展示 `note`（`whitespace-pre-line break-words`） |
| `src/locales/{zh,en}.json` | `store.noteLabel` / `store.notePlaceholder` |
| `src/libs/reward.test.ts` | `normalizePurchaseNote` 4 条 |
| `src/db/services/rewardService.test.ts` | 备注 6 条（带/不带/空白/换行/0 积分/超长） |
| `src/libs/report/renderMarkdown.test.ts` | **计划外新增 1 条**：备注含 `\|` 与换行时报告表格不被破坏 |

与计划的两处偏差：
1. `normalizePurchaseNote` 放在**事务外**调用（纯函数，不必占事务）。
2. 多加了 `renderMarkdown.test.ts` 一条测试 —— 因为备注让「描述里出现用户输入的竖线/换行」第一次成为**真实可达**的输入，
   而 §5 风险 1 说的就是这条路径；用测试钉住比只写在风险里可靠。

### 6.2 验证

- `bunx tsc --noEmit` 干净；`bun run build` 成功；`bunx vitest run` **276 通过**（275 → 276）。
- **pre-fix 红测**（把本轮改动逐段撤掉再跑）：
  - 撤 `rewardService` 的备注逻辑 → `-t 备注` 下 **4 红**（`expected undefined to be '和朋友一起'` /
    `'第一行\n第二行'` / `'免费的那一份'` / `Target cannot be null or undefined`），
    另 2 条（不带备注、空白备注）按设计**仍然绿** —— 它们是旧行为回归保护。
  - 撤 `libs/reward` 的两个 helper → **4 红**（`normalizePurchaseNote is not a function`）。
- **真浏览器端到端**（`bunx vite --host 127.0.0.1 --port 1420` + bow 打开 `http://127.0.0.1:1420`，用真实 IndexedDB）：
  - 商店卡片 → 弹层出现「备注（可选）0/200」，`placeholder` 与 `maxLength=200` 正确；输入 `和朋友一起\n周末` 后计数变 `8/200`。
  - 购买后 DB：`purchase.note === '和朋友一起\n周末'`（换行保留）、
    `pointsHistory.description === '购买 看电影 ×1 · 和朋友一起 周末'`（换行压空格）。
  - 消费统计 → 明细行：`看电影 / 2026-09-23 16:09 / 单次点击验证 / -10 / ¥5`（备注另起一行）；积分明细行：
    `看电影 / 购买 看电影 ×1 · 单次点击验证`。
  - 不填备注购买：`note` 为 `undefined`，描述 `购买 看电影 ×1`（旧格式），消费明细**没有**空备注行。

### 6.3 过程中发现（都要知道）

1. **工作区里混着上一轮的未提交改动**：`src/db/services/rewardService.ts`、`src/libs/reward.ts`、
   两个对应 test 里还带着「商店按积分升序」那一轮的未提交实现与测试（我开工前 `git status` 就看到这些文件是 `M`，
   一度误以为是我的改动）。`git diff --stat` 的 12 个文件里，这 3 个是两块内容混在一起 —— 提交时请留意。
   **教训**：`git stash push -- <file>` 做 pre-fix 对照会连带撤掉同文件里的既有未提交工作（本次第一次对照就是这么被污染的），
   要么先确认该文件只有本轮改动，要么像后来那样把文件副本存 `/tmp` 再做外科式回退。
2. **bow 的 `browser_click` 对同一个按钮实测派发两次点击**：点一次「购买 1 个」写了两条消费记录、扣了 20 分
   （两条 `createdAt` 相差 14ms）。改用**一次 DOM `.click()`** 复测 → 只有 1 条 ⇒ 不是应用 bug，是工具行为。
   （顺带暴露：应用侧只有 `disabled={!canRedeem}` 这一层异步状态拦重复点击，理论上有双击窗口 —— 本次未改，既有行为。）
3. **报告页 UI 不渲染积分明细表**：备注只在**导出的 Markdown** 的积分小节里出现（§5 风险 1 已说明），
   已用 6.1 那条测试钉住转义。
4. 遗留测试数据：dev 环境的 IndexedDB 里有我注入的「看电影」奖品与几条消费记录；vite dev server 仍在
   `127.0.0.1:1420` 运行（bow 标签页 10），需要的话可直接点开复看，或让我清掉。
