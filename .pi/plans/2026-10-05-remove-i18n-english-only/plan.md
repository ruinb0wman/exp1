# 移除 i18n，应用改为英文单语

日期：2026-10-05 · 模式：plan → build

## 0. 目标与已确认的决定

**目标**：删掉 i18next / react-i18next 这一整套运行时，界面与所有面向用户的文案只保留英文；
仓库里不再有面向用户的中文（注释、`console.log` 仍可中文）。

用户已拍板的四件事：

1. **全层英文化** —— 界面层 + DB 写入的描述/错误提示 + Rust 通知与报错 + 内置成就预设。
2. **彻底移除** —— 删依赖、删语言包、删语言设置项，约 480 处 `t()` 换成内联英文。
3. **存量数据不动** —— 已写进 IndexedDB 的中文（积分明细 `description`、已接取成就的标题/描述）
   保持中文，不加迁移。只有新产生的记录是英文。
4. **文档只改 `AGENTS.md:170`** 的 i18n 约定；README / `design/` 保持中文。

**假设**：英文文案一律以 `src/locales/en.json` 的现有值为准（它已 100% 英文、无缺失键），
不重新翻译。只有约 12 处 en.json 里没有对应 key 的硬编码中文需要新写英文（见 §4）。

---

## 1. 现状（读代码得到的事实）

### 1.1 i18n 运行时

`src/libs/i18n.ts` 是唯一初始化点（`fallbackLng: "zh"`，`prefix/suffix` 用 `{ }`，
`LanguageDetector` 顺序 `localStorage → navigator`），由 `src/App.tsx:26` 的 `import "@/libs/i18n"` 引入：

```ts
// src/App.tsx:28-37
const { i18n } = useTranslation();
useEffect(() => { if (user?.language) { i18n.changeLanguage(user.language); } }, [user?.language, i18n]);
```

- `src/locales/en.json` / `zh.json` 各 687 行、595 个键，**结构完全对齐**，没有 `_one/_plural`（无复数）。
- `src/locales/locales.test.ts` 断言 18 个 Header 标题键在两份语言包里都存在 —— 删除语言包后此测试必须删。
- 使用面：**55 个文件** `useTranslation()`；**约 480 处**静态 key 调用（其中 39 处带插值参数）；
  **16 处动态 key**（模板字符串/变量 key）。

### 1.2 四个把 `t` 当参数传出去的非组件模块（改签名，不能靠正则替换）

- `src/libs/achievement/formatCondition.ts:8` —— `formatCondition(condition, t: TFunction, templateTitle?)`，
  被 `AchievementCard.tsx` / `AchievementProposalCard.tsx` / `AchievementAcceptDialog.tsx` 调用。
- `src/libs/report/renderMarkdown.ts` —— 9 个内部函数都接 `t: ReportTranslate`（82 处调用），
  入口 `renderReportMarkdown(model, translate, { includePrompt })`。
- `src/libs/report/prompt.ts:4` —— `export type ReportTranslate = (key, options?) => string`，
  `buildAnalysisPrompt(model, t)`。
- 上面两个由 `src/pages/Reports/index.tsx:50` 造出 `translate`，经
  `src/pages/Reports/components/ExportActions.tsx:39` 传下去 —— 这条 `translate` 管线整条删掉。

### 1.3 混在代码里的 `i18n.language === 'zh'` 三目（4 处，英文分支直接留下）

`TaskDetailPopup.tsx:249,251,252,255`、`TaskInstanceCard/index.tsx:128`、
`PointsHistoryCard.tsx:123`、`Pomo/components/PomoHeader.tsx:35`。

### 1.4 用户语言偏好字段

`src/db/types/user.ts:3,23` 的 `SupportedLanguage = "zh" | "en"` 与 `User.language?`。
`users` 表的 Dexie schema 是 `'id, name, updatedAt'`（`src/db/migrations/index.ts:23`）——**没索引 language**，
所以删字段不需要新版本迁移，老行上残留的 `language` 属性无害。
`src/libs/report/types.ts:21` 的 `ReportLocale` 是死类型（全仓库无引用），顺手删。

### 1.5 LLM 提示词与报告会跟着语言走

- `src/services/achievementGenerator.ts:125-132` 接 `locale: 'zh' | 'en'`，拼 `Write title and description in 简体中文`；
  调用方 `src/pages/Achievements/index.tsx:119` 从 `user?.language` 推 `locale`。
- 报告 Markdown 与「分析提示词」章节的全部文案都来自语言包 → 去掉 `t` 后自动变成英文。

### 1.6 不在 i18n 里、但**面向用户**的硬编码中文（这才是"全层英文化"的主要工作量）

| 位置 | 内容 |
|---|---|
| `src/db/middleware/pointsHistoryMiddleware.ts:44,74` | `'任务完成'`、`'撤销简单任务'`（写库的积分明细描述） |
| `src/db/services/taskService/instance.ts:181,192,205` | `` `撤销任务：${template.title}` `` |
| `src/db/services/taskService/progress.ts:51,75,97,123,240,252,273,285` | `` `阶段回退：…` ``、`'任务完成状态回退'`、`` `完成阶段：…` ``、`'任务全部完成'`、`` `完成子任务：…` ``、`` `取消子任务：…` ``、`'子任务全部完成'`、`'子任务完成度不足'`（含 `'分钟'/'次'` 单位） |
| `src/db/services/achievementService.ts:156,277` | `'成就不存在'`、`` `成就达成：${title}` `` |
| `src/db/services/reportService.ts:33` | `'未找到用户数据'` |
| `src/db/services/exportImportService.ts:159,166,170,186,294,310` | 备份格式校验错误、`'数据导入成功（全量覆盖）'`、`'未知错误'` |
| `src/db/services/rewardService.ts:183,195,198,206,214,223,248` | 兑换校验错误、`` `积分不足。需要: …` ``、`` `购买 ${title} ×${qty}` `` |
| `src/services/llmService.ts:28`、`achievementGenerator.ts:243` | `'LLM 请求失败'`、`` `模型返回的成就格式无法解析（…）` `` |
| `src/hooks/useReport.ts:52`、`useTaskHistory.ts:83` | `'生成报告失败'`、`'加载失败'` |
| `src/hooks/useGlobalPomoTimer.ts:286,331` | `` `番茄钟 ${time}` `` → 前台服务常驻通知的标题 |
| `src/libs/achievement/presets.ts:12-63` | 7 个内置预设成就的中文标题/描述（接取后会**写库**） |
| `src/pages/Profile/lib.ts:11,13` | `"分析报告"`、`"消费统计"` |
| `src/pages/TaskHistory/lib.ts:41,43,45,59-63,77-81,104-116` | 状态标签、`今天/昨天/N天前`、`无日期` |
| `src/components/DatePicker.tsx:38`、`pages/EditReward.tsx:221`、`pages/TaskHistory/index.tsx:158` | `请选择日期`、`点击更换图标`、`暂无记录` |
| `src-tauri/src/pomo_native.rs:79-83` | 通知 `番茄钟` / `🍅 专注完成！` / `☕ 休息结束` |
| `src-tauri/gen/android/.../PomoAlarmReceiver.kt:47` | `CHANNEL_NAME = "番茄钟提醒"`（系统通知设置里可见） |
| `src-tauri/src/llm.rs`（15 处）、`pomo_timer.rs:231,254`、`lib.rs:35` | 会经 `invoke` 冒到 UI 的报错文案 |

已确认是**死代码**、可直接删（全仓库无调用方，也无测试引用）：

- `src/libs/time.ts:519 formatDurationToString` / `:554 formatRelativeDateToString`
- `src/pages/TaskHistory/lib.ts:38 getStatusLabel` / `:50 formatDateTime` / `:70 formatShortDate`
  （TaskHistory 实际用的是 `src/components/TaskInstanceCard/lib.ts` 里返回 *key* 的那一套）

**不动的**：所有中文注释、`console.log/error/warn`、`README*`、`design/`、`.pi/plans/` 历史计划。

---

## 2. 改动清单（按文件分组）

### 2.1 删除

- `src/libs/i18n.ts`
- `src/locales/en.json`、`src/locales/zh.json`、`src/locales/locales.test.ts`（整个目录消失）

### 2.2 依赖与锁

- `package.json` 删 `i18next`、`i18next-browser-languagedetector`、`react-i18next`，随后 `bun install` 刷新 `bun.lock`。

### 2.3 语言设置的整条链路

- `src/App.tsx` —— 删 `useTranslation` 导入、`import "@/libs/i18n"`、语言同步 `useEffect` 与 `i18n` 变量。
- `src/pages/Settings.tsx` —— 删 `Globe` 图标导入、`SUPPORTED_LANGUAGES`/`SupportedLanguage` 导入、
  `handleLanguageChange`、`i18n`、以及整块「General / 语言」卡片（第 74-100 行附近）；保留时间设置与 AI 设置。
- `src/db/types/user.ts` —— 删 `SupportedLanguage` 与 `language` 字段。
- `src/libs/report/types.ts` —— 删死类型 `ReportLocale`。
- `src/services/achievementGenerator.ts` —— 删 `locale` 形参，`language` 固定 `'English'`。
- `src/pages/Achievements/index.tsx:119,126` —— 删 `locale` 推导与实参。

### 2.4 约 480 处静态 `t()` 调用 → 内联英文（55 个文件）

分布（精确统计，`t(` 后紧跟引号字母）：

```
libs/report/renderMarkdown.ts 82   pages/DataImportExport.tsx 38   components/TaskDetailPopup.tsx 42
pages/Settings.tsx 19              pages/EditTask.tsx 18            pages/Achievements/index.tsx 17
pages/PointsHistory/index.tsx 17   components/AiSettingsSection.tsx 15  components/TaskInstanceCard/index.tsx 15
pages/EditReward.tsx 14            pages/Store/components/RewardDetailPopup.tsx 14
pages/Reports/index.tsx 11         pages/Pomo/components/SettingsPopup.tsx 11
components/TaskContributionGraph.tsx 9  pages/Consumption/index.tsx 9  pages/Reports/components/SummaryCards.tsx 9
components/IconPicker.tsx 8        pages/Reports/components/{LevelTable,TemplateTable}.tsx 8 each
pages/Achievements/components/AchievementAcceptDialog.tsx 8   pages/Reports/components/ExportActions.tsx 7
…其余 30 个文件各 1~6 处（Pomo 子组件、Store 子组件、TaskHistory、Profile、Consumption 子组件、Stats、
ReplenishmentHistory、AllTasks、TimePicker、TaskCard、TaskTemplateCard、Header、Popup、PomoTimer 等）
```

### 2.5 16 处动态 key → 显式映射表

| 位置 | 现在的 key | 改法 |
|---|---|---|
| `formatCondition.ts:14,22,25` | `achievement.conditions.*`、`scopeAll/scopeTemplate`、`achievement.taskTypes.*` | 改成 `CONDITION_TEMPLATES: Record<type, (v) => string>` + `TASK_TYPE_LABEL`，`scope = templateTitle ? `“${title}” ` : ""` |
| `renderMarkdown.ts:55` | `reports.notes.${code}` | `NOTE_TEXT: Record<code, (p) => string>` |
| `renderMarkdown.ts:216,246,261,265,293` | `reports.taskType.*`、`reports.pomo.mode.*`、`reports.points.type.*`、`reports.weekday.*` | 4 张 `Record<union, string>` 常量（英文值取自 en.json） |
| `prompt.ts:12-23` | `reports.prompt.*` | 直接内联 9 段英文 |
| `TaskDetailPopup.tsx:225` | `` t(`home.${dayKeys[d]}`) `` | `const DAY_NAMES = ['Sunday',…]` 常量数组 |
| `PomoTimer.tsx:80`、`ModeSwitcher.tsx:40` | `` pomo.mode.${mode} `` / `${mode}Running` | `POMO_MODE_LABEL` + `POMO_MODE_RUNNING_LABEL`（`focus→Focusing`，休息两档同名） |
| `PointsHistoryCard.tsx:101` | `` points.${labelKey} `` | `getPointsHistoryLabelKey` 改成直接返回英文 label（或加 `POINTS_LABEL: Record<type,string>`） |
| `Achievements/index.tsx:288` | `` achievement.tabs.${option} `` | `ACHIEVEMENT_TAB_LABEL` 常量 |
| `Reports/components/PeriodSelector.tsx:39`、`Consumption/components/PeriodSelector.tsx:39` | `` reports.scope.${option} `` / `` consumption.scope.${option} `` | 两张 `Record<scope, string>` |
| `TaskHistory/components/FilterBar.tsx:26` | `t(tab.labelKey)`（变量 key） | `TaskHistory/lib.ts` 的 `filterTabs` 把 `labelKey` 换成 `label: "All"/"Pending"/"Completed"/"Skipped"` |

### 2.6 非组件模块签名收紧

- `formatCondition.ts` —— 去掉 `TFunction` 参数；三个调用方同步改。
- `renderMarkdown.ts` / `prompt.ts` —— 去掉 `ReportTranslate` 与所有 `t` 形参。
- `Reports/index.tsx` 删 `translate` + `useCallback`；`ExportActions.tsx` 删 `translate` prop。
- `libs/achievement/formatCondition.test.ts`、`libs/report/renderMarkdown.test.ts` —— 删掉 `import zh/en`、
  `makeT`、`i18n.changeLanguage`，断言改英文（`renderMarkdown.test.ts` 里现有的 `tEn` 期望值可直接复用）。

### 2.7 §1.6 的硬编码中文 → 英文（含 12 处新写文案）

新增文案（en.json 里没有对应 key）：

| 中文 | 英文 |
|---|---|
| `请选择日期` | `Select date` |
| `点击更换图标` | `Tap to change icon` |
| `暂无记录` | `No records yet` |
| `分析报告` / `消费统计` | `Reports` / `Spending`（与 `reports.page.title`、`consumption.title` 保持一致） |
| `已完成` / `已跳过` / `待完成`（TaskHistory 死函数，删除即可） | — |
| `无日期` / `今天` / `昨天` / `${n}天前` | `No Date` / `Today` / `Yesterday` / `${n} days ago` |
| `永久有效` / `${n} 天` / `${n} 个月`（死函数，删除） | — |
| `任务完成` / `撤销简单任务` | `Task completed` / `Simple task undone` |
| `撤销任务：X` | `Task undone: X` |
| `阶段回退：A → B` | `Stage reverted: A → B`（单位 `分钟/次` → `minutes/times`） |
| `任务完成状态回退` | `Completion status reverted` |
| `完成阶段：A` / `任务全部完成` | `Stage completed: A` / `All stages completed` |
| `完成子任务：X` / `取消子任务：X` | `Subtask completed: X` / `Subtask unchecked: X` |
| `子任务全部完成` / `子任务完成度不足` | `All subtasks completed` / `Not enough subtasks completed` |
| `成就不存在` / `成就达成：X` | `Achievement not found` / `Achievement unlocked: X` |
| `未找到用户数据` | `User data not found` |
| `无效的备份文件格式` / `备份文件缺少版本信息` / `备份文件缺少数据内容` / `备份文件缺少 ${key} 数据` | `Invalid backup file format` / `Backup file is missing version info` / `Backup file is missing data` / `Backup file is missing "${key}" data` |
| `数据导入成功（全量覆盖）` / `导入失败: X` / `未知错误` | `Import succeeded (full overwrite)` / `Import failed: X` / `Unknown error` |
| `数量不合法` / `商品不存在` / `商品已下架` / `商品积分价格无效` / `消费额度不足` | `Invalid quantity` / `Reward not found` / `Reward is no longer available` / `Invalid reward price` / `Insufficient spending limit` |
| `积分不足。需要: A, 当前: B` | `Insufficient points. Required: A, current: B` |
| `购买 X ×N` | `Purchased X ×N` |
| `LLM 请求失败` / `模型返回的成就格式无法解析（X）` | `LLM request failed` / `Could not parse achievements from the model response (X)` |
| `生成报告失败` / `加载失败` | `Failed to generate report` / `Failed to load` |
| `番茄钟 ${time}` | `Pomodoro ${time}` |
| 7 个预设成就 | `Baby Steps` / `One Hour of Focus` / `Pomodoro Pro` / `Seven-Day Streak` / `Unstoppable` / `${title}: Next Level` / `Getting There`（描述按原意英译，见 §1.6 顺序） |

Rust / Kotlin 侧：`pomo_native.rs` 通知 → `Pomodoro` / `🍅 Focus complete!` / `☕ Break over`；
`llm.rs` 15 条、`pomo_timer.rs` 2 条、`lib.rs` 1 条错误文案英译；
`PomoAlarmReceiver.kt:47` `CHANNEL_NAME` → `Pomodoro reminders`。

### 2.8 约定文档

- `AGENTS.md:170` —— `- **i18n** - UI is in Chinese; use Chinese for user-facing text`
  → `- **Language** - UI is English only; write all user-facing text in English (comments/logs may stay Chinese)`。

---

## 3. 执行步骤（每步可独立验证）

1. **盘点 + 生成映射**：从 `src/locales/en.json` 导出 `key → value` 平表（脚本放 `/tmp`），
   并列出所有 `t(` 调用点里 key 不在表内的（预期 0 个）。产物：`/tmp/i18n-keys.json` + 差异报告。
2. **写一次性 codemod**（`/tmp/i18n-codemod.mjs`，不入库）：
   - `t("k")` → `"value"`（`JSON.stringify` 保证转义正确，JSX 里就是 `{"value"}`，合法）；
   - `t("k", { a, b })` → 模板字符串，`{a}` → `${a}`，只处理占位符能对上 options 键名的；
   - 跳过并打印：模板字符串 key、变量 key、嵌套 `t()`（`DataImportExport.tsx:58,115`）、
     参数里带函数调用的复杂表达式；
   - 顺手删掉仅剩 `useTranslation` 的文件里的 import 与 `const { t } = useTranslation();` 行。
   - 先 `--dry-run` 打印「将替换 N 处 / 跳过 M 处」，确认 M ≈ 20 再实跑。
   - 验证：`grep -rn "useTranslation\|react-i18next" src` 只剩 §1.3 那 4 个文件 + App/Settings（下一步处理）。
3. **手工收尾 §2.5 的 16 处动态 key**（每改完一处跑 `bunx tsc --noEmit`）。
   验证：`grep -rn 't(`' src` 为空，`grep -rn 't("' src | grep -v "\.test\."` 为空。
4. **手工处理 §1.3 的 4 处 `i18n.language` 三目**：删 `import i18n from "i18next"`，只留英文分支。
   验证：`grep -rn "i18n\." src` 为空。
5. **收紧签名**（§2.6）：`formatCondition` → `renderMarkdown`/`prompt` → `Reports/index.tsx` + `ExportActions.tsx`。
   验证：`grep -rn "ReportTranslate\|TFunction" src` 为空；`bunx tsc --noEmit` 通过。
6. **改测试**：删 `src/locales/locales.test.ts`；重写 `formatCondition.test.ts`、`renderMarkdown.test.ts`。
   验证：`bunx vitest` 全绿（当前基线：`bunx vitest` 应全绿，改动前先跑一次留基线）。
7. **删机制文件与依赖**：`src/libs/i18n.ts`、`src/locales/`、package.json 三个依赖、`bun install`。
   验证：`bunx tsc --noEmit`；`grep -rn "i18next" src package.json` 为空。
8. **语言设置链路清理**（§2.3）：App.tsx、Settings.tsx、user.ts、report/types.ts、achievementGenerator + Achievements 页。
   验证：`grep -rn "language" src --include=*.ts --include=*.tsx | grep -v localeCompare` 只剩无关命中；
   `bunx tsc --noEmit`。
9. **硬编码中文 → 英文**（§2.7）：先删 5 个死函数（`libs/time.ts` 2 个、`pages/TaskHistory/lib.ts` 3 个），
   再按表格逐处替换 DB/服务/hook/页面文案。
   验证：`bunx vitest` + `bunx tsc --noEmit`。
10. **Rust / Kotlin**：`pomo_native.rs`、`llm.rs`、`pomo_timer.rs`、`lib.rs`、`PomoAlarmReceiver.kt`。
    验证：`cd src-tauri && cargo check`。
11. **AGENTS.md 约定行**（§2.8）。
12. **终检**：见 §5 的残留扫描 + `bun run build` + 真机确认。

---

## 4. 风险与未知

1. **`CHANNEL_NAME` 改名对已安装设备无效**：Android 的 NotificationChannel 一旦创建，名字不会随代码更新
   （同 `CHANNEL_ID` 只改名字会被忽略）。所以老设备在系统「通知设置」里仍显示「番茄钟提醒」，
   只有新装/清数据后才变英文。**不建议**改 `CHANNEL_ID`（会多出一个重复渠道）。
2. **存量中文数据（已定：不动）**：积分明细 `description`、已接取成就的标题/描述会一直是中文，
   报告/明细页会出现中英混排。这是本次接受的代价，写进 commit message 以免以后被当 bug。
3. **codemod 的 JSX 转义**：`en.json` 里有 `"` 与 `'`（如 `reports.caliber.item1`、`editReward.confirmDelete`），
   `JSON.stringify` 后放进 JSX `{...}` 是安全的，但放进**属性字符串**时要注意原代码是
   `placeholder={t("x")}` 还是 `placeholder="..."`；codemod 只替换 `t(...)` 表达式，不动外围引号。
   每步后 `tsc` 能兜住语法错误，但**文案错位**（换了 key 的相邻值）`tsc` 抓不到 ——
   所以第 3 步要求按文件抽样 diff（至少 82 处的 `renderMarkdown.ts`、42 处的 `TaskDetailPopup.tsx`、
   38 处的 `DataImportExport.tsx` 全量肉眼过一遍）。
4. **`en.json` 里 `achievement.conditions.scopeAll` 是空字符串**：`formatCondition` 重写时别写成 `undefined`，
   否则文案会变成 `undefinedComplete 100 tasks in total`。测试要覆盖。
5. **`reports.title` 等带 `·`、`~` 的值**：英文串里有 `Task Review · {label} ({start} ~ {end})`，
   转模板字符串时 `{label}` 必须精确匹配 options 键名，否则会渲染出字面量 `{label}`。
6. **i18next 的 `count` 特殊处理**：`t("iconPicker.icons", { count })`、`store.remainingQuota`、
   `achievement.nextUnlock` 都用了 `count`/`n`。因为没有 `_plural` 键，行为就是简单插值，
   替换成 `${...}` 语义等价 —— 但要确认没有别处依赖 i18next 的复数回退（已 grep：无）。
7. **测试里渲染组件的用例**（`Popup.test.tsx`、`NumberInput.test.tsx`、`DynamicIcon.test.tsx`）
   用的是自带的中文 fixture，不依赖 i18n，预期不受影响；但 `Popup.test.tsx` 当前渲染的 `Popup`
   会调 `t()`（无 provider 时返回 key 字面量），去掉后断言若碰巧匹配 key 会失效 —— 跑一遍确认。
8. **未验证**：真机（Android）上的通知标题/渠道名、以及 12 个页面逐个肉眼查残留中文，只能在
   `build:android:all` + `adb install -r` 之后做。

---

## 5. 验证

```bash
bunx tsc --noEmit                       # 类型
bunx vitest                             # 测试（基线：改动前先跑一次）
bun run build                           # tsc && vite build
cd src-tauri && cargo check

# 机制残留必须为空
grep -rn "i18next\|useTranslation\|react-i18next\|ReportTranslate\|TFunction" src
grep -rn "i18n\." src

# 面向用户的中文残留：只应剩注释 / console.* （人工过滤）
grep -rnP '(["\x27`])[^"\x27`]*[\x{4e00}-\x{9fff}]' src src-tauri/src --include=*.ts --include=*.tsx --include=*.rs
grep -rnP '[\x{4e00}-\x{9fff}]' src-tauri/gen/android/app/src/main/java

# 真机（Android）
bun run build:android:all && adb install -r <apk>
# 逐个页面看：Home / Pomo / Store / Stats / Profile / Settings / Reports / Achievements / TaskHistory
# 跑一次番茄钟到点 → 通知标题应为 "Pomodoro"；系统通知设置里的渠道名新装设备应为英文
```

---

## 6. 执行结果（2026-10-05）

**做法**：先按 §3 写了一个一次性 codemod（`/tmp/i18n-codemod.mjs`，未入库），
`--dry-run` 报「替换 482 处无参 + 36 处带参、0 处 missing key、0 处跳过」后实跑；
16 处动态 key 与 4 处 `i18n.language` 三目手工改；
随后用一个窄规则的收尾脚本（`/tmp/i18n-tidy.mjs`）把 209 个 `{"Text"}` 还原成 JSX 文本 / 属性字符串。

**统计**：`src` 下 **88 个文件**被改（约 1974 行增删），删掉 `src/libs/i18n.ts`、
`src/locales/{en,zh}.json`、`src/locales/locales.test.ts`，`package.json` 去掉 3 个依赖（`bun install` 已刷新 `bun.lock`）。

**顺手清掉的死代码**（全仓库无调用方、无测试引用，改动前已逐个 grep 确认）：
`libs/time.ts` 的 `DurationResult` / `formatDuration` / `formatDurationToString` / `formatRelativeDateToString`；
`pages/TaskHistory/lib.ts` 的 `getStatusIcon` / `getStatusStyle` / `getStatusLabel` / `formatDateTime` / `formatShortDate`；
`db/types/pomo.ts` 里 `POMO_MODE_CONFIG.label`（原本就没人读，与新的 `POMO_MODE_LABEL` 重复）。
另：`PointsHistoryLabelKey` 类型与 `getPointsHistoryLabelKey` 被 `getPointsHistoryLabel` 取代（直接返回英文）。

**额外改的两处计划外内容**（都属于「面向用户的文案」）：
- `index.html` 的 `<title>任务+积分工具</title>` → `<title>exp1</title>`（与 `tauri.conf.json` 的 productName 一致）。
- `DatePicker` 底部按钮「取消 / 确定」→ `Cancel / Confirm`（§1.6 表里漏了这两个纯 JSX 文本）。

**验证**：
| 检查 | 结果 |
|---|---|
| `bunx tsc --noEmit` | ✅ |
| `bunx vitest run` | ✅ 25 文件 / 319 例（原 26 / 336，少了 locales.test.ts 与 formatCondition/renderMarkdown 重写后减少的用例） |
| `bun run build` | ✅ |
| `cd src-tauri && cargo check` | ✅ |
| `bun run build:android:all` | ✅ 产出 `app-universal-release.apk`（验证 Kotlin 改动与 Android target 编译） |
| 残留扫描 | ✅ `grep -rn "i18next\|useTranslation\|ReportTranslate\|TFunction\|i18n\." src` 为空；`dist/assets/*.js` 里搜不到任何 i18n key 名 |
| 浏览器逐页冒烟（vite dev + 15 条路由） | ✅ 全部英文、无 key 泄漏；唯一中文是用户自己的任务标题「E2E 返回手势测试任务」 |

**踩到的坑（值得记）**：收尾脚本里把正则写成 `/>\{"..."\}</g`，结尾那个想当字面量的 `/` 被当成正则定界符吃掉了，
于是把 65 处 `>{"X"}</p>` 改成了 `>X<//p>`。`tsc` 立刻报 TS1003/TS1382 抓到了，
用 `<//` → `</` 全量修回（JSX 里 `<//` 不可能是合法内容）。**写正则字面量时含 `/` 必须写成 `<\/`。**

**未完成（需要真机）**：`adb devices` 为空（没连手机），所以「升级后逐个页面肉眼确认 + 番茄钟到点通知标题为
`Pomodoro` + 系统通知渠道名（新装才生效）」还没做。见 scratchpad。

---

## 7. 二次复核：用真实产物验证时抓到的一个漏网（2026-10-05 续）

用户要求「用真实测试验证结果」，于是不只跑源码级检查，还**解包了真机 APK** 去验。
这一验就抓到一个 §1.6 清单里没有的东西：

**漏网**：`src-tauri/src/pomo_background.rs` —— **番茄钟前台服务常驻通知**的文案。
它的中文全部写成 `\u{XXXX}` 转义（`TITLE = "\u{756a}\u{8304}\u{949f}"` = 番茄钟、
`"\u{5df2}\u{6682}\u{505c}"` = 已暂停、`"\u{5df2}\u{505c}\u{6b62}"` = 已停止、
`"\u{1f345} \u{4e13}\u{6ce8}\u{5b8c}\u{6210}\u{ff01}"` = 🍅 专注完成！、`剩余 {}`），
**普通 grep `[\u4e00-\u9fff]` 抓不到转义形式**，所以第一轮扫描（和计划里那份清单）整个漏了它。

**怎么抓到的**：`python3` 在 APK 里逐个 ABI 数 `libexp1_lib.so` 的字节，
`番茄钟/已暂停/已停止/专注完成` 在四个 ABI 里都还在 → 反查源码 → 定位到 `pomo_background.rs`。

**修法**（除了英文化，还顺手把文案集中成可测的）：
- 新增 `pomo_timer.rs`：`pub const NOTIFICATION_TITLE = "Pomodoro"` +
  `pub fn state_body(state, is_completed, mode) -> Option<&'static str>`（前台服务通知正文，
  从 `pomo_background.rs` 的 `run()` 里提出来，`None` = 该状态不单独更新通知）。
- `pomo_background.rs` / `pomo_native.rs` 都改用 `NOTIFICATION_TITLE`（一处定义，前台服务与到点提醒共用）。
- 文案：`Remaining {}` / `Paused` / `Stopped` / `🍅 Focus complete!` / `☕ Break over`。
- `report_error` 的 8 条 payload 也一并英译（用户的决定是「Rust 通知**与报错**」，它们会经
  `pomo:native-error` 事件到前端，虽然只进 console）。
- `src/docs/pomo.md` 里引用的运行期文案（`番茄钟 25:00` / `已暂停` / `🍅 专注完成！` / `已停止` / `剩余 15:32`）
  同步改成英文 —— 文档正文仍是中文，只改被引用的字符串，否则文档就写错了。

**新增 4 个 Rust 单测**（`cargo test` 7 → 11 例，全部在 host 上真跑）：
`pomo_timer::notification_title_is_english`、`pomo_timer::state_body_is_english`、
`pomo_timer::running_state_does_not_push_a_one_off_update`、`pomo_native::completion_text_is_english`。
它们断言文案等于具体英文串，并且**逐字符断言不含 CJK**（`('\u{4e00}'..='\u{9fff}')`）——
正是为「中文被转义藏起来」这类回归准备的。
> 注意：`pomo_background.rs` 是 `#[cfg(target_os = "android")]`，它的测试在 host 上**不会被执行**，
> 所以文案与 `state_body` 特意放在非 gated 的 `pomo_timer.rs`，否则「有测试但从不跑」等于没有。

**变异验证**（证明测试真的能拦住）：把 `state_body` 的 `"Paused"` 临时改回 `"\u{5df2}\u{6682}\u{505c}"`，
`state_body_is_english` 立刻 FAILED（10 passed / 1 failed），改回后 11 全绿。

**产物级复核（重新构建 APK 后解包，四个 ABI 全查）**：
| 字符串 | arm64-v8a | armeabi-v7a | x86 | x86_64 |
|---|---|---|---|---|
| `番茄钟` / `已暂停` / `已停止` / `专注完成` | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| `Remaining ` / `Paused` / `Stopped` / `Focus complete!` | 1 / 1 / 1 / 2 | 1 / 1 / 1 / 1 | 1 / 1 / 1 / 1 | 1 / 1 / 1 / 1 |
| `Pomodoro`（标题） | 0 | 0 | 0 | 3 |
| `classes.dex` 里的 `Pomodoro`（通知渠道名） | — | — | — | 1 |

**`Pomodoro` 那三个 0 不是 bug**：arm64 / armv7 / x86 上 LLVM 把这个 8 字节常量
**折成立即数**（`movz w8, #0x6f50` = "Po"、`movk w8, #0x6d6f, lsl 16` = "mo"，
后 4 字节 "doro" 在另一个寄存器），所以 `.rodata` 里没有它，但运行时值就是 `Pomodoro`；
x86_64 走另一条 codegen 留了字面量（3 份）。用 `movz/movk` 的机器码在 arm64 里搜到了这四段立即数来确认。
（前一版标题是 9 字节的中文，折不动，所以以数据形式存在 —— 这也是最初能 grep 到中文的原因。）

**前端在 APK 里 grep 不到**：Tauri 把前端资源 **brotli 压缩**后嵌进 `libexp1_lib.so`
（`.so` 里能搜到 `index.html`、`/assets/index-...js` 这些**路径**，但内容不是明文）。
所以前端只能靠 `vite dev` 逐页冒烟 + `vite build` + vitest 验，没法在 APK 里做字节级检查。
