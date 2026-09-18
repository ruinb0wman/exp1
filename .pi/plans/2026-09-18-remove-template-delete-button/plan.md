# 去掉模板卡片的垃圾桶按钮，只保留停用（电源）按钮

日期：2026-09-18
范围：`src/components/TaskTemplateCard.tsx`、`src/pages/AllTasks/components/TaskList.tsx`、`src/pages/AllTasks/index.tsx`
不改：DB 层、i18n、测试文件、其他页面

---

## 1. 目标

「全部任务」页面每个模板卡片右侧的操作区，从 `↑ ↓ | ⚡ | 🗑 | ›` 变成 `↑ ↓ | ⚡ | ›`。

隐含结论（已核实，不影响功能）：**垃圾桶按钮本来就是「带确认框的停用」**，仓库里没有硬删除模板的实现，所以去掉它不丢任何能力。

---

## 2. 现状（已读代码）

### 2.1 垃圾桶按钮调的其实是 disable

`src/components/TaskTemplateCard.tsx:127-141`（当前）：

```tsx
{/* Delete Button */}
<button
  onClick={onDelete}
  disabled={isDeleting || isActionLoading}
  className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
  title="Delete"
>
  {isDeleting ? (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  ) : (
    <Trash2 className="w-4 h-4" />
  )}
</button>
```

`onDelete` 的实际来源是 `src/pages/AllTasks/index.tsx:60-83` 的 `handleDisable`：

```ts
const handleDisable = async (id: string, title: string) => {
  const confirmed = await confirm({
    title: "Disable Task",
    message: `Are you sure you want to disable "${title}"? This task will no longer generate new instances.`,
    ...
  });
  if (!confirmed) return;
  setDeletingId(id);
  await disable(id);      // → disableTaskTemplate：enabled = false
  refresh();
};
```

- `disable`（`src/hooks/useTasks.ts:113-124`）→ `disableTaskTemplate`（`taskService/template.ts:103`）：**只把 `enabled` 置 false**。
- 全仓库 grep：`deleteTaskTemplate` **无任何定义/调用**；`disableTaskTemplate` 的唯一调用方就是这个 hook。
- 因此垃圾桶 = 电源按钮 + 一次确认框，行为完全重叠；差别只是确认框与红色危险色。

### 2.2 受影响的调用链（只有一条）

`TaskTemplateCard` 仅被 `src/pages/AllTasks/components/TaskList.tsx` 使用（已 grep 确认，全仓 2 处引用：import 与 JSX）。`deletingId` 也只存在于 `AllTasks/index.tsx` 与 `AllTasks/components/TaskList.tsx` 两个文件。

### 2.3 不需要动的东西

- **i18n**：垃圾桶的 tooltip 是硬编码 `title="Delete"`，确认框文案也是硬编码英文；`locales/*.json` 里的 `delete` 键分属 `task.detail`（删除**任务实例**，由 `TaskDetailPopup` 使用）与消费记录，都不受影响、也不会变成死键。
- **测试**：项目没有组件测试基建（无 `@testing-library/react`），没有测试引用这些 props。
- `src/components/TaskCard.tsx` 里也有一份 `isDeleting` 垃圾桶，但该组件全仓无引用（既有死代码），不在本次范围。

---

## 3. 改法

### 3.1 `src/components/TaskTemplateCard.tsx`

1. import 去掉 `Trash2`：`import { ChevronDown, ChevronRight, ChevronUp, Power } from "lucide-react";`
2. `TaskTemplateCardProps` 去掉两个字段：`isDeleting: boolean;` 与 `onDelete: (e: React.MouseEvent) => void;`（`isActionLoading` 保留，排序按钮与电源按钮都在用）
3. 解构参数同步去掉 `isDeleting` / `onDelete`
4. 删掉整个 `{/* Delete Button */}` 块（含 `isDeleting` 的 spinner 三元）

结果操作区只剩：排序（可选传入）→ 电源 → `ChevronRight`。

### 3.2 `src/pages/AllTasks/components/TaskList.tsx`

1. `TaskListProps` 去掉 `deletingId: string | null;` 与 `onDelete: (id: string, title: string) => void;`
2. 函数签名同步去掉这两个参数
3. `<TaskTemplateCard>` 去掉 `isDeleting={deletingId === template.id}` 和：

```tsx
onDelete={(e) => {
  e.stopPropagation();
  onDelete(template.id!, template.title);
}}
```

### 3.3 `src/pages/AllTasks/index.tsx`

1. 删 `import { useConfirm } from "@/hooks/useConfirm";` 与 `const confirm = useConfirm();`
   （`confirm` 只被 `handleDisable` 使用；删掉后不删 import 会被 `noUnusedLocals` 拦住）
2. 删 `const [deletingId, setDeletingId] = useState<string | null>(null);`
   （`useState` 本身保留，`filter` 还在用）
3. 删整个 `handleDisable` 函数（含其上方 `// 停用任务` 注释）
4. `useTaskTemplateActions()` 解构去掉 `disable`
5. `<TaskList>` 去掉 `deletingId={deletingId}` 与 `onDelete={handleDisable}`

### 3.4 有意保留（可再删）

`disableTaskTemplate`（db service）与 `useTaskTemplateActions().disable` 会因此在 UI 上**不可达**，但都是导出的公开 API、零运行时代价，我倾向保留（万一以后要在别处做「停用」入口）。
如果你想彻底清掉这段死代码，再执行一步：删 `useTasks.ts` 的 `disable` 回调 + `disableTaskTemplate` 导入 + 返回对象里的 `disable` 字段，并删 `taskService/template.ts` 的 `disableTaskTemplate` 导出。**默认不做。**

### 3.5 行为提示（非回归）

停用之后没有确认框了 —— 但电源按钮本来就是立即切换、从来不带确认，所以这不是本次改动引入的变化；只是「带确认的那条路」消失了。若你希望停用时也弹一次确认（防误触导致任务不再生成实例），那是在 `handleToggleEnabled` 里加分支，属于另一个决定，默认不做。

---

## 4. 步骤与验证

| # | 步骤 | 验证 |
|---|---|---|
| 1 | 改 `TaskTemplateCard.tsx`（3.1） | `bunx tsc --noEmit` 此时应**报错**：`TaskList.tsx` 传了不存在的 `isDeleting`/`onDelete` —— 正好证明删除彻底 |
| 2 | 改 `AllTasks/components/TaskList.tsx`（3.2） | 同上，报错转移到 `AllTasks/index.tsx` |
| 3 | 改 `AllTasks/index.tsx`（3.3） | `bunx tsc --noEmit` 归零 |
| 4 | 回归 | `bunx vitest run`（22 文件 / 253 用例应全绿，本次不动逻辑）、`bun run build` |
| 5 | 真浏览器（bow + 已在跑的 vite dev server） | 全部任务页卡片操作区只有 `↑ ↓ ⚡ ›`，DOM 里 `button[title="Delete"]` 与 `svg.lucide-trash-2` 数量为 0；点 ⚡ 后 DB `enabled` 变 false、卡片变暗、`StatsSummary` 的 enabled 计数减 1；↑/↓ 排序仍生效 |

---

## 5. 风险

1. **几乎无风险**：改动只删 UI 与死参数，不碰数据模型、迁移、查询排序。
2. `noUnusedLocals` 是这次改动的主要护栏：任何漏删的 import/局部变量都会在 `tsc` 阶段暴露。
3. 唯一的产品含义：模板停用少了「二次确认 + 危险色」的入口，用户只能点电源按钮停用（无确认）。已在 3.5 说明，如需确认框可另开一步。

---

## 6. 完成后记（2026-09-18）

已按方案实现并验证：

- 三个文件均改完，`bunx tsc --noEmit` 干净（`noUnusedLocals` 把 `useConfirm`/`deletingId`/`disable` 的漏删全拦住了）；`bunx vitest run` **22 文件 / 253 用例全绿**；`bun run build` 成功。
- `grep onDelete|isDeleting|deletingId|Trash2|"Disable Task" src/components/TaskTemplateCard.tsx src/pages/AllTasks` **零命中**。
- 真浏览器（bow）实测：卡片操作区只剩 `↑ 下移 ⚡`（每卡 3 个按钮）；全页 `button[title="Delete"]` 与 `svg.lucide-trash-2` 均为 **0**；点 ⚡ 后 DB `enabled` 变 false、卡片变暗、`StatsSummary` 从 `1 of 2 enabled` 变 `0 of 2 enabled`，**未弹任何确认框**；↑/↓ 排序仍正常（`K1:0,K2:1` → 点 ↓ → `K2:0,K1:1`，UI 同步）。种子数据已清理。
- 按 3.4 的默认选择：`disableTaskTemplate` 与 `useTaskTemplateActions().disable` **保留**（现无 UI 调用方，但属导出 API）。未执行可选清理。
