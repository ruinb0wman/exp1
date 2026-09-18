# 工作区未提交改动的提交计划

日期：2026-09-18
范围：纯 git 操作，**不改任何源文件**
前提：工作区当前是「3 个已完成并自测过的任务 + 1 个文档更新」的混合状态

---

## 1. 目标

把工作区里三批已完成的改动（NumberInput 重写 / 模板自定义顺序 / 模板卡片去垃圾桶）
加一次 README 更新，切成 **4 个可读的提交**（代码 2 个、文档 2 个），并且每个提交都能独立编译。

**必须承认的约束**：任务 B（模板顺序）与任务 C（去垃圾桶）在 3 个文件里逐行交织，
`git add -p` 拆不开（详见 §3.2）。已确认选择：**B 与 C 合并为一个提交**。

---

## 2. 改动清单（逐文件归类）

清单来源：会话早期的一次 `git status --short` + 对 `src/`、`.pi/`、仓库根的全量 mtime 交叉核对。
**注意：我只读模式跑不了 git（`bash` 只剩 `ls`/`grep`/`cd`/`pwd`），提交前请以你自己的 `git status --short` 为准。**

### 提交 1 — 任务 A `2026-09-18-number-input-editable`

| 文件 | 状态 | 内容 |
|---|---|---|
| `src/libs/numberInput.ts` | 新增 | 纯逻辑：`valueToText` / `isTextAllowed` / `textToNumber` / `applyBounds` / `resolveBlurValue` |
| `src/libs/numberInput.test.ts` | 新增 | 15 例 |
| `src/components/NumberInput.test.tsx` | 新增 | 10 例（`createRoot` + `act`，未引入 `@testing-library/react`） |
| `src/components/NumberInput.tsx` | 修改 | 输入层重写：`type="text"` + `inputMode`，内部文本态，聚焦可清空、失焦兜底 |
| `src/pages/EditTask.tsx` | **部分**修改 | 只有 3 处内联输入迁移（`:667` Expire after / `:718` Every / `:806` After N times）；**`sortOrder` 那个 hunk 属于提交 2** |

### 提交 2 — 任务 B + C（合并）

**B：模板自定义显示顺序**（`.pi/plans/2026-09-18-task-template-order/plan.md`）

| 文件 | 内容 |
|---|---|
| `src/db/types/task.ts` | `TaskTemplate.sortOrder: number`（必填），位置在 `enabled` 之后 |
| `src/libs/task.ts` | `compareTemplateOrder` / `sortTaskTemplates` / `computeSortOrderUpdates` / `sortDisplayTasks` / `buildTemplateOrderMap` |
| `src/libs/task.test.ts` | 顺序三件套用例 |
| `src/db/migrations/index.ts` | `db.version(8).upgrade` 按 `createdAt` 回填 `sortOrder` |
| `src/db/migrations/index.v8.test.ts` | 新增（v8 单独成文件，因为 `index.test.ts` 已先打开 `getDB()` 单例） |
| `src/db/services/taskService/template.ts` | 查询统一 `sortTaskTemplates`；`createTaskTemplate` 追加到末尾；新增 `reorderTaskTemplates` |
| `src/db/services/taskService/template.test.ts` | 新增 |
| `src/db/services/taskService/query.ts` | `getTodayTaskInstances` / `getNoDateTaskInstances` 接入实时顺序 + `sortDisplayTasks` |
| `src/db/services/taskService/instance.test.ts` | 测试工厂适配（**内容待你 `git diff` 确认，见 §5.1**） |
| `src/db/services/exportImportService.ts` | `BACKUP_VERSION` `'1.1'` → `'1.2'`；导入后归一化 `sortOrder` |
| `src/db/services/exportImportService.test.ts` | 版本断言 + 旧备份归一化用例 |
| `src/db/services/reportService.test.ts`、`src/libs/report/aggregate.test.ts` | 测试工厂补 `sortOrder` |
| `src/hooks/useTasks.ts` | `useTaskTemplateActions` 新增 `reorder` |
| `src/hooks/useTaskInstanceGenerator.ts` | `getDisplayTasksForDate` 按模板顺序混排（不再「实例在前、预览在后」） |
| `src/pages/AllTasks/lib.ts` | 新增 `moveTemplateOrder` |
| `src/pages/AllTasks/lib.test.ts` | 新增 |
| `src/pages/AllTasks/index.tsx` | `handleMove` + `reorder` + 透传 `onMove` |
| `src/locales/{zh,en}.json` | `allTasks.moveUp` / `moveDown` |
| `src/pages/EditTask.tsx` | `taskData` 类型加 `"sortOrder"` 到 `Omit`（**提交 1 剩下的那个 hunk**） |

**C：去掉模板卡片垃圾桶按钮**（`.pi/plans/2026-09-18-remove-template-delete-button/plan.md`）

| 文件 | 内容 |
|---|---|
| `src/components/TaskTemplateCard.tsx` | 删 `Trash2` import、`isDeleting`/`onDelete` props 与整个 Delete Button 块；同时含 B 的 `+ChevronUp/ChevronDown` 与 4 个排序 props |
| `src/pages/AllTasks/components/TaskList.tsx` | 删 `onDelete`/`deletingId`；同时含 B 的 `onMove`/`canMoveUp`/`canMoveDown` |
| `src/pages/AllTasks/index.tsx` | 删 `useConfirm`/`handleDisable`/`deletingId`；与 B 的 `handleMove` 紧邻 |

> 有意保留：`disableTaskTemplate`（db service）与 `useTaskTemplateActions().disable`（现无 UI 调用方）。
> 这是方案 C §3.4 的既定选择，不是遗漏。

### 提交 3 — plan 归档

- `.pi/plans/2026-09-18-number-input-editable/plan.md`（新增）
- `.pi/plans/2026-09-18-task-template-order/plan.md`（新增）
- `.pi/plans/2026-09-18-remove-template-delete-button/plan.md`（新增）
- `.pi/plans/2026-09-18-pending-changes-commit-plan/plan.md`（本文件，新增）

### 提交 4 — README

- `README.md`：功能列表删「背包系统」「本地同步」，补消费统计 / 分析报告 / 成就系统 / AI 能力，
  「数据统计」改写为「进度统计」

### 不应提交

- `dist/`（.gitignore 已忽略）、`docs`（软链仍 dangling，无改动）
- 无 `src-tauri/`、无 `package.json`、无配置文件改动（已用 mtime 确认）

---

## 3. 为什么这么切

### 3.1 顺序按实现时间

A（00:38）→ B（12:16）→ C（12:40）。按此顺序提交，中间态的语义与当时的自测状态一致。

### 3.2 B 与 C 为什么必须合并

三处逐行交织，`git add -p` 的 hunk 无法切（3 行上下文的 hunk 会把两边吞进同一块）：

| 文件 | 交织点 |
|---|---|
| `TaskTemplateCard.tsx` | import 行同时 `+ChevronUp, +ChevronDown` 与 `-Trash2`；props 段同时 `+onMoveUp/onMoveDown/canMoveUp/canMoveDown` 与 `-isDeleting/onDelete` |
| `AllTasks/components/TaskList.tsx` | props 段同时 `+onMove` 与 `-onDelete/-deletingId` |
| `AllTasks/index.tsx` | `handleDisable`（删）与 `handleMove`（加）紧邻，落在同一 hunk |

要拆开只能在 3 个文件上手写 `git add -e`，且中间提交「HEAD+B」需要人工构造
（保留 `Trash2`、`isDeleting`、`onDelete`、`handleDisable` 的同时加上排序相关代码），
风险高于收益 → 合并，用一个提交消息里分两段说明。

### 3.3 EditTask.tsx 是唯一需要 `git add -p` 的文件

B 的 `Omit<..., "sortOrder">` 在 `:222`，A 的三处输入在 `:667` / `:718` / `:806`，相距远超 6 行
→ `git add -p` 会给出彼此独立的 hunk，可放心逐块选择。

---

## 4. 执行步骤

### 第 0 步 — 基线验证（在动 git 之前）

```bash
git status --short            # 与 §2 清单核对，确认没有清单外的文件
git diff --stat
bunx tsc --noEmit
bunx vitest run               # 方案自称 22 文件 / 253 用例；自己确认
bun run build
```

### 第 1 步 — 提交 1（任务 A）

```bash
git add src/libs/numberInput.ts src/libs/numberInput.test.ts \
        src/components/NumberInput.tsx src/components/NumberInput.test.tsx
git add -p src/pages/EditTask.tsx     # 只选 3 处 NumberInput 迁移的 hunk，跳过 sortOrder 那个
git diff --cached --stat              # 确认 EditTask.tsx 只有 ~3 处改动
git commit -m "$(cat <<'EOF'
feat(number-input): 聚焦可清空、失焦兜底 0/min，EditTask 三处输入统一迁移

- 新增 src/libs/numberInput.ts 纯逻辑（valueToText / isTextAllowed / textToNumber /
  applyBounds / resolveBlurValue），组件只做编排
- NumberInput 改为 type="text" + inputMode，内部文本态驱动：聚焦时可删到空，
  失焦兜底 applyBounds(0, min, max)，min > 0 时天然落到 min；补回 ↑/↓ 步进与 Enter 提交
- EditTask 的 Expire after / Every / After N times 三处内联 type="number" 迁到 NumberInput，
  全仓库 type="number" 归零
- 新增 src/libs/numberInput.test.ts（15 例）、src/components/NumberInput.test.tsx（10 例）
EOF
)"
```

**隔离验证中间态**（工作区此时仍有未暂存的 B/C，直接跑测试验证不到这个提交）：

```bash
git stash push -u            # 收走未暂存改动 + 未跟踪的新文件
bunx tsc --noEmit && bunx vitest run
git stash pop
```

### 第 2 步 — 提交 2（任务 B + C）

```bash
git add src/components/TaskTemplateCard.tsx \
        src/db/migrations/index.ts src/db/migrations/index.v8.test.ts \
        src/db/services/exportImportService.ts src/db/services/exportImportService.test.ts \
        src/db/services/reportService.test.ts \
        src/db/services/taskService/instance.test.ts \
        src/db/services/taskService/query.ts \
        src/db/services/taskService/template.ts \
        src/db/services/taskService/template.test.ts \
        src/db/types/task.ts \
        src/hooks/useTaskInstanceGenerator.ts src/hooks/useTasks.ts \
        src/libs/report/aggregate.test.ts src/libs/task.ts src/libs/task.test.ts \
        src/locales/en.json src/locales/zh.json \
        src/pages/AllTasks/index.tsx src/pages/AllTasks/lib.ts src/pages/AllTasks/lib.test.ts \
        src/pages/AllTasks/components/TaskList.tsx \
        src/pages/EditTask.tsx
git diff --cached --stat      # 对比 §2，确认 src/ 下再无遗漏
git status --short            # 应只剩 .pi/plans 与 README.md
git commit -m "$(cat <<'EOF'
feat(tasks): 模板自定义显示顺序，并精简模板卡片操作区

模板顺序（原 2026-09-18-task-template-order 方案）：
- TaskTemplate 新增必填 sortOrder；新增 compareTemplateOrder / sortTaskTemplates /
  computeSortOrderUpdates / sortDisplayTasks / buildTemplateOrderMap 纯函数
- 迁移 v8 按 createdAt 回填 sortOrder（DB 名仍为 exp-v7，未改名）
- 模板查询统一排序；createTaskTemplate 追加到末尾；新增 reorderTaskTemplates
- 实例查询改用实时模板表顺序 + pending 优先；Stats 预览与真实实例混排
- 全部任务页新增 ↑/↓ 按钮（筛选视图下跳过隐藏项，用 moveTemplateOrder 计算）
- 导入旧备份（无 sortOrder）时归一化；BACKUP_VERSION 1.1 → 1.2

卡片操作区（原 2026-09-18-remove-template-delete-button 方案）：
- 去掉垃圾桶按钮（其行为本就是把 enabled 置 false 的带确认停用），操作区变为 ↑ ↓ | ⚡ | ›
- AllTasks 移除 useConfirm / handleDisable / deletingId
EOF
)"
```

然后工作区即等于 HEAD，直接跑完整验证：

```bash
bunx tsc --noEmit && bunx vitest run && bun run build
```

### 第 3 步 — 提交 3（plan 归档）

```bash
git add .pi/plans/2026-09-18-number-input-editable \
        .pi/plans/2026-09-18-task-template-order \
        .pi/plans/2026-09-18-remove-template-delete-button \
        .pi/plans/2026-09-18-pending-changes-commit-plan
git commit -m "docs(plans): 补记 NumberInput / 模板顺序 / 卡片精简三份方案的完成与实测"
```

（把本文件一起提交是为了让 `git status` 收尾干净；若不想让「提交计划」进历史，去掉最后一行的目录即可。）

### 第 4 步 — 提交 4（README）

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: README 功能列表同步消费统计、分析报告与成就系统

删去已移除的「背包系统」（0cfd414）与「本地同步」（1a5021e），
补充消费统计、分析报告、成就系统、AI 能力，并把「数据统计」改写为「进度统计」。
EOF
)"
```

### 第 5 步 — 收尾

```bash
git status --short     # 期望：干净
git log --oneline -5
# git push origin master   ← 你确认后再推
```

---

## 5. 风险与未知

1. **`src/db/services/taskService/instance.test.ts` 的改动内容我没能 diff 出来**（git 被策略拒绝）。
   我读到的是：该文件的 `createInstance` 工厂用 `as unknown as TaskTemplate` 绕过类型检查，
   文件内**不含** `sortOrder`（`grep sortOrder` 零命中）。这说明它的改动不属于方案 B §7 列的
   「三处测试工厂补 sortOrder」，可能是别的适配。**提交前先 `git diff` 看一眼**，若发现夹带了
   无关改动，先决定是单独成提交还是还原。
2. **中间提交的验证必须用 stash**。提交 1 之后、提交 2 之前，工作区仍含未暂存的 B/C，
   直接跑 `bunx vitest` 验证的是「提交 1 + 未暂存 B/C」而不是提交 1 本身（§4 第 1 步已给命令）。
3. **`src/db/migrations/index.test.ts` 的 mtime 是 09-18 12:30 但 `git status` 里没有它**
   → 内容已改回原样（方案 B §6 提到过「v8 迁移单独放 `index.v8.test.ts`，因为
   `index.test.ts` 已先打开 `getDB()` 单例」）。无需处理，但 `git status` 里看不到它在提醒
   mtime 不可单独作为判据——所以我用 mtime 只做「有没有漏掉的文件」的交叉核对，不用它判内容。
4. **我的清单来自一次可能被截断的输出**：会话早期那次 `git status --short` 拼了 `| head -30`，
   而输出正好 30 行。我随后用 `ls -laR` 全量 mtime 核对，09-18 变动的文件恰好等于该清单，
   未发现第 31 个文件。仍以你第 0 步的 `git status` 为最终依据。
5. **v8 迁移的真机副作用仍未验证**：`bulkUpdate` 会触发 `taskTemplateMiddleware` 的
   `updating` 钩子，对每个模板跑一次 `checkAndGenerateForTemplate`（幂等但有一批 DB 读）。
   方案 B §5.1 已把它列为风险 1，且「真机升级后今日实例是否还在」**尚未在真机验证**。
   这不是提交阻塞项，但提交后值得单独盯一次（老库升级路径）。
6. **本计划不包含任何代码改动**。若第 0 步的 `tsc` / `vitest` 红了，先修代码，再回到本计划。
