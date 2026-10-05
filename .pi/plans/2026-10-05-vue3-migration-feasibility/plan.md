# exp1 迁移 Vue 3 + Vite 可行性评估

> 状态：**评估完成，未动任何代码**（用户明确选择"先出可行性评估"）。
> 本文件是评估报告 + 迁移路线，不是已批准的执行计划。用户决定迁移后再切 `/build` 执行。
> 日期：2026-10-05

## 0. 结论

**可行。** 这是一次"中等规模视图层重写"，不是架构手术：

- 全项目 **189 个 `.ts/.tsx`**：**约 12k 行框架无关代码零改动**，**约 14k 行视图层需要重写**。
- 没有任何 React 生态的第三方 UI 库，也没有 `createPortal` / `forwardRef` / `memo` / `useImperativeHandle` / `useReducer` 这类难移植的 React 特性。
- Rust 后端（`src-tauri/**`）和 Tauri 前端 JS API 全部框架无关，零改动。
- **但功能零收益。** 如果动机只是"觉得 Vue 更现代"，收益接近零；如果动机是团队栈 / 生态 / 维护性，值得做。

| 指标 | 值 |
|---|---|
| React 强耦合依赖 | 5 个（react, react-dom, react-router, lucide-react, zustand） |
| 需要重写的文件 | 89 个 `.tsx` + 20 个 hooks + 5 个 store + `App.tsx`/`main.tsx` |
| 需要重写的代码量 | ≈ 14,000 行 |
| 原样复用的代码量 | ≈ 12,000 行（db / libs / services / 类型 / 纯逻辑测试 / Tailwind / Rust） |
| 路由数 | 18 |
| `useEffect` 调用点 | 58 |
| zustand 调用点 | 82 |
| Dexie `liveQuery` 订阅点 | 8 |
| React Context | 1（`useConfirm`） |
| 组件测试（需重写） | 3 / 25 个测试文件 |

## 1. 依赖面：干净得出乎意料

`package.json` 里与 React 强耦合的依赖只有 5 个：

| 依赖 | 版本 | 迁移去向 | 说明 |
|---|---|---|---|
| `react` / `react-dom` | ^19.1.0 | 删除 | 换成 `vue` ^3.5 |
| `react-router` | ^7.13.1 | `vue-router` ^4 | 18 条路由，`Routes/Route/Outlet/useNavigate/useParams/NavLink` 逐个对应 |
| `lucide-react` | ^0.577.0 | `lucide-vue-next` | 68 处引用；组件名相同，`className`→`class`，`size/strokeWidth` 语义一致 |
| `zustand` | ^5.0.11 | `pinia`（已选定） | 5 个 store，逻辑可整段搬 |
| `@vitejs/plugin-react` / `@types/react(-dom)` | dev | `@vitejs/plugin-vue` / `vue-tsc` | 构建与类型检查 |

**关键利好**：没有 Radix / MUI / antd / framer-motion / react-query / react-hook-form —— 迁移里最常见的致命坑（"这个库没有 Vue 版"）在这个项目里不存在。所有 UI 组件都是自研的。

## 2. 零改动清单（约占一半代码、绝大部分复杂度）

| 目录 | 内容 | 是否改动 |
|---|---|---|
| `src/db/services/**` | Dexie 服务层（reward/task/pomo/achievement/report/user/exportImport） | 否 |
| `src/db/types/**` | 全部 TS 类型 | 否 |
| `src/db/migrations/**` | 迁移 + 迁移测试 | 否 |
| `src/db/middleware/**` | Dexie 中间件 | 否 |
| `src/db/index.ts` | Dexie 实例 | 否 |
| `src/libs/**` | time / task / reward / numberInput / achievement / report（含大量测试） | 否 |
| `src/services/**` | `achievementGenerator` / `llmService` | 否 |
| `src/index.css` | Tailwind v4 | 否（`@tailwindcss/vite` 对 Vue 完全兼容） |
| `public/`、`design/` | 静态资源 / 设计稿 | 否 |
| `src-tauri/**` | Rust 后端、Android 配置、`tauri.conf.json` | 否 |
| `vitest.config.ts` | 只用了 jsdom + alias，**没挂 React 插件** | 否 |

这些代码是项目 90% 的"业务复杂度"（积分经济、任务生成、成就判定、报告聚合、v9 迁移）。它们不碰 React，所以迁移的真正风险不在业务逻辑，只在视图层。

Tauri 前端 API 也全是框架无关的 JS：
`@tauri-apps/api/core`(`invoke`/`listen`/`isTauri`)、`plugin-notification`、`plugin-dialog`、`plugin-fs`、`tauri-plugin-background-service`。

## 3. 需要重写清单（视图层 ≈ 14k 行）

| 模块 | 文件 | 行数 | 迁移方式 |
|---|---|---|---|
| `src/components/layouts/**` | 3 | 75 | `Outlet` → `<RouterView />` + `<slot />` |
| `src/components/**`（基础组件） | ~30 | ~4,300 | SFC 重写；`Popup`/`Calendar`/`DatePicker`/`TimePicker`/`NumberInput`/`Slider` 为高交互组件，重点验证 |
| `src/pages/**` | 56 | ~6,200 | SFC 重写；`EditTask.tsx`(824) / `EditReward.tsx`(486) / `DataImportExport.tsx`(348) / `Achievements/index.tsx`(347) 是最大的四个 |
| `src/hooks/**` | 20 | ~2,600 | hook → composable；31 个导出的 hook 逐个翻译 |
| `src/store/**` | 5 | 645 | → Pinia store |
| `src/App.tsx` + `src/main.tsx` | 2 | 73 | `createWebHashHistory` + `createApp` + router 表 |
| `src/hooks/useConfirm.tsx` | 1 | 92 | 唯一的 React Context → `provide/inject` 或 Pinia |
| 组件测试 | 3 | 439 | → `@vue/test-utils`（`DynamicIcon`/`NumberInput`/`Popup`） |
| `tsconfig.json` | — | — | `"jsx": "react-jsx"` 移除，改由 `vue-tsc` 检查 |
| `vite.config.ts` | — | — | `react()` → `vue()` |
| `package.json` scripts | — | — | `tsc && vite build` → `vue-tsc --noEmit && vite build` |
| `AGENTS.md` | — | — | React 约定整段改写为 Vue 约定 |

## 4. 等价映射表（迁移时的对照速查）

| React | Vue 3 (`<script setup>`) |
|---|---|
| `useState` | `ref` / `reactive` |
| `useMemo` | `computed` |
| `useCallback` | 普通函数（无需 memo） |
| `useEffect(fn, [])` 挂载 | `onMounted(fn)` |
| `useEffect(fn, [deps])` | `watch(deps, fn)` / `watchEffect` |
| `useEffect` 清理函数 | `onUnmounted` / `onScopeDispose` |
| `useRef` 存 DOM | `ref` + 模板 `ref` |
| `useRef` 存可变值 | `ref`（`.value`）或普通闭包变量 |
| props（受控组件） | `defineProps` + `defineEmits` + `v-model` |
| `children` / `headerRight` 等 slot props | `<slot />` / 具名插槽 |
| `createContext` + `useContext` | `provide` / `inject` |
| `React.memo` | 无需（Vue 细粒度响应式） |
| `BrowserRouter` / `Routes` / `Route` | `createRouter` + `createWebHashHistory` |
| `useNavigate()` | `useRouter()` |
| `useParams()` | `useRoute().params` |
| `NavLink` | `RouterLink` |
| `Outlet` | `<RouterView />` |
| zustand `create<T>()` | `defineStore` + `setup()` 写法 |
| `store.getState()` | `useXxxStore()`（Pinia 实例） |
| `React.ReactNode` | `VNode` / `Slot` / `defineSlots` |
| `React.CSSProperties` | `CSSProperties`（from `vue`） |

**Dexie `liveQuery` 包装**（8 处，统一成一个 composable 即可）：

```ts
// composables/useLiveQuery.ts（示意）
export function useLiveQuery<T>(querier: () => T | Promise<T>, deps: WatchSource[] = []) {
  const data = shallowRef<T>();
  const error = shallowRef<unknown>();
  let sub: Subscription | undefined;
  const start = () => {
    sub = liveQuery(querier).subscribe({
      next: (v) => { data.value = v; error.value = undefined; },
      error: (e) => { error.value = e; },
    });
  };
  watch(deps, () => { sub?.unsubscribe(); start(); }, { immediate: true });
  onScopeDispose(() => sub?.unsubscribe());
  return { data, error };
}
```

## 5. 风险清单（按严重度）

1. **`useEffect` 语义等价（58 处）** —— 最大风险面。React 的 deps 数组 vs Vue 的显式 `watch`/`watchEffect`，容易漏"清理"或漏"依赖变化重跑"。`useGlobalPomoTimer`(373) / `useTasks`(304) / `useTaskInstanceGenerator`(202) 是重灾区。
2. **Zustand → Pinia 响应式模型差异（82 处调用点）** —— zustand selector 是"函数式取片"，Pinia 是"解构会丢响应性"（需 `storeToRefs`）。这是最容易产生"数据不更新"的地方。
3. **受控组件 → `v-model` 语义** —— `NumberInput`（有 `isTextAllowed`/`blur` 归一化逻辑）、`Slider`、`DatePicker`、`TimePicker`、`MultiSelectGrid`。这些交互密集，需逐一手动回归。
4. **`Popup` 的动画状态机** —— `entering/entered/exiting/exited` + `setTimeout` + 300ms 退出，用 Vue 的 `<Transition>` 重写时最容易出"关不掉/闪一下"。
5. **Android 返回手势** —— `useBackButtonHandler`（`onBackButtonPress`）必须保证遮挡层注册/注销与 React 版一致，否则返回键行为回归。
6. **构建/类型检查链路切换** —— `vue-tsc --noEmit` 替代 `tsc`；`tsconfig` 的 `noUnusedLocals`/`noUnusedParameters` 在 SFC 里由 `vue-tsc` 强制执行，可能一次性冒出大量报错，需要容错节奏。
7. **APK 打包** —— `build:android:all` 依赖 vite 产物目录与 Tauri 前端配置；Vue 插件切换后要重新验证四个 ABI 出包。
8. **文档漂移** —— `AGENTS.md`、`README.md`、`src/docs/pomo.md` 里所有 React 约定都要同步，否则下一次会话的 AI 会按过时约定写代码。

## 6. 已选定的迁移路线（待用户批准才执行）

**策略：新分支 `vue-migration` 原地全量重写，一次切换；状态层用 Pinia。**

不做 React/Vue 混合共存（`veaury` 桥接会引入双运行时、双构建、props/事件语义对齐成本，对 14k 行的项目得不偿失）。

### 阶段 0：基建切换（可独立验证）
分支 `vue-migration`；
`package.json`：删 react/react-dom/react-router/lucide-react/zustand/@vitejs/plugin-react/@types/react*，加 `vue`/`vue-router`/`pinia`/`lucide-vue-next`/`@vitejs/plugin-vue`/`vue-tsc`/`@vue/test-utils`；
`vite.config.ts`：`react()` → `vue()`；
`tsconfig.json`：移除 `jsx`，加 `vite/client` 类型；
`package.json` scripts：`tsc` → `vue-tsc --noEmit`。
**验证**：`bun install` 通过；`vue-tsc --noEmit` 在"只剩旧 tsx"状态下会大量报错 —— 这一步的验证点是"配置本身没错"，用最小 `main.ts` + 一个空 `App.vue` 起 `vite dev` 确认能跑。

### 阶段 1：逻辑层不动，先搭壳
`main.ts`（`createApp` + `pinia` + `router`）、`router/index.ts`（18 条路由，对应现有 `App.tsx`）、`layouts/*.vue`（3 个，`RouterView` + 底部导航）。
**验证**：`vite dev` 能打开空白页，路由跳转正常。

### 阶段 2：stores → Pinia（5 个，645 行）
`taskStore`(120) / `userStore`(213) / `pomoStore`(281) / `achievementStore`(31) / `index.ts`。
`liveQuery` 统一走 `useLiveQuery` composable。
**验证**：写 1~2 个 Pinia store 单测；`vue-tsc` 在这几个文件上零报错。

### 阶段 3：hooks → composables（20 个，2600 行）
按依赖顺序：纯逻辑 hook（`useSafeAreaInsets`/`usePageInitializer`/`useAppInitializer`）→ 数据 hook（`useTasks`/`useRewards`/`useRewardPurchases`/`usePointsHistory`/`useTaskHistory`/`useReport`/`useAchievements`/`useProfileStats`）→ 副作用 hook（`useAppBootstrap`/`useBackButtonHandler`/`useExpiredTaskChecker`/`useTaskInstanceGenerator`/`useAchievementWatcher`/`useGlobalPomoTimer`）→ `useConfirm`。
**验证**：`vue-tsc` 零报错；纯逻辑部分（`computed` 派生）补单测。

### 阶段 4：基础组件（~30 个，4300 行）
顺序：`LoadingState`/`EmptyState`/`ErrorState`/`Progress`/`Header`/`FilterTabs`/`BottomNav`/`RadioGroup` → `Popup`（重点）→ `NumberInput`/`Slider`/`MultiSelectGrid` → `Calendar`/`DatePicker`/`TimePicker`/`IconPicker`/`DynamicIcon` → `TaskCard`/`TaskTemplateCard`/`TaskList`/`TaskInstanceCard`/`TaskContributionGraph`/`PointsHistoryCard`/`PomoTimer`/`TaskDetailPopup`/`AiSettingsSection`/`ConfirmDialog`。
**验证**：3 个组件测试改写成 `@vue/test-utils`；`vite dev` 逐组件目视。

### 阶段 5：页面（56 个，6200 行）
按路由顺序，每页重写后立刻在 `vite dev` 冒烟：`Home` → `AllTasks` → `EditTask` → `Store` → `EditReward` → `Stats` → `Profile` → `Pomo` → `PointsHistory` → `Consumption` → `TaskHistory` → `Reports` → `ReplenishmentHistory` → `Achievements` → `Settings` → `DataImportExport`。
**验证**：每页做完跑 `vue-tsc --noEmit`；全部做完做一次全路由冒烟。

### 阶段 6：收尾与验证
1. `vue-tsc --noEmit` 全绿
2. `bunx vitest` —— 22 个纯逻辑测试文件必须**一例不改地全绿**（这是"逻辑层没被碰坏"的硬证据），3 个组件测试用新写法
3. `vite build`
4. `cargo test`（11 例）—— 证明 Rust 侧没受影响
5. `build:android:all` 出四 ABI APK
6. 真机验证：后台通知 / 到点闹钟 / Android 返回手势 / 底部导航 / 计时器 / 数据读写
7. 文档：`AGENTS.md`（React 约定 → Vue 约定）、`README.md`、`src/docs/pomo.md`

### 阶段 7：合并
`vue-migration` → 主干；旧 React 文件在同一次提交里删除（避免留下死代码）。

## 7. 验证策略（为什么"重写"也可能安全）

这个项目的测试结构对迁移非常友好：

- **25 个测试文件里 22 个是纯逻辑**（db services、migrations、libs、pages 的 `lib.ts`），它们不 import React。迁移后应该 **一例不改、全绿**。任何一条变红都说明逻辑层被误伤了 —— 这是最强的回归护栏。
- 只有 3 个组件测试需要改写。
- 已有的"逐页冒烟"实践（去 i18n 那轮做过 15 条路由全英文冒烟）可以直接复用；这次换成"逐页视觉与交互冒烟"。
- 后端有 11 个 Rust 单测兜底，且 `src-tauri` 完全不碰。

## 8. 代价与工作量（定性）

- 本体是**把同一个 App 用另一个框架重敲一遍**：14k 行视图层。
- 用 AI 辅助按"基建 → store → hooks → 组件 → 页面"顺序推进是现实可行的，每一阶段都能独立验证。
- **成本重心在验证，不在翻译**：翻译 14k 行是机械的；真正花时间的是 58 处 `useEffect` 的语义对齐、82 处 store 调用点的响应性、以及受控组件的交互回归。
- 参照本项目已有的大规模重构节奏（去 i18n 那轮 102 文件 / 518 处 `t()`），这次量级更大（89 tsx + 20 hooks + 5 store），但同样属于"可分段 + 可验证"的形态。

## 9. 什么情况下**不建议**做

- 动机只是"Vue 看起来更现代" → 收益接近零，风险是实打实的 14k 行重写。建议不做。
- 项目近期还有大量功能需求要排 → 迁移期间的功能开发会产生双份改动成本（除非期间冻结功能）。
- 缺少真机验证条件（现在 `adb devices` 经常是空的）→ 通知、闹钟、返回手势这些 Android 侧行为只能靠代码审查，风险上升。

## 10. 未知项 / 待确认

- 用户实际动机（团队栈？维护性？性能？）—— 未说明，会影响是否值得做的判断。
- 是否允许迁移期间冻结功能开发（影响分支策略）。
- 是否需要保留 React 版本可回退（分支保留即可，无需同仓库共存）。
- `vue-tsc` 在开启 `noUnusedLocals`/`noUnusedParameters` 时对现有代码的首次报错量未实测（预估会有若干，属正常）。

---

# 执行记录（分支 vue-migration，2026-10-05）

用户确认「开始迁移」后按 §6 路线执行完毕。以下是**与计划的偏差**和**实际抓到的 bug**，
比计划本身更值得回看。

## 最终形态

- 依赖：`vue` / `vue-router@5` / `pinia@4` / `lucide-vue-next` + dev：`@vitejs/plugin-vue` / `vue-tsc` / `@vue/test-utils`。
  已移除 `react` / `react-dom` / `react-router` / `lucide-react` / `zustand` / `@vitejs/plugin-react` / `@types/react(-dom)`。
- 新增：`src/composables/**`（20 个）、`src/router/index.ts`、`src/App.vue`、`src/main.ts`、`src/libs/plain.ts`。
- 删除：`src/hooks/**`、全部 `.tsx`（含 3 个组件测试，已用 `@vue/test-utils` 重写为 `.test.ts`）。
- `src/db/**`、`src/libs/**`（除 `TaskInstanceCard/lib.ts` 与 `Profile/lib.ts` 的图标 import）、
  `src/services/**`、`src-tauri/**` 逻辑零改动。

## 与计划的偏差

1. **路由用 hash 而不是 history**：React 版是 `BrowserRouter`，Vue 版换成
   `createWebHashHistory()`。Tauri WebView 里没有服务端路由，hash 模式免去 `#` 外的 404/刷新问题。
2. **两个父路由共用 `path: "/"`**（MainLayout / SimpleLayout，各带自己的 children），
   对应 React 版两个无 path 的 `<Route element>`。vue-router 按顺序匹配 children，工作正常。
3. **没保留 React/Vue 共存**：计划里写「react() 插件仅在迁移期间保留」，实际到了收尾就一起删了，
   中途也没真的跑过 React 版对照（`vue-tsc` + 真浏览器冒烟已足够定位问题）。
4. **`src/components/TaskCard.tsx` 直接没移植**：全仓库无人引用，是死代码（迁移时发现的）。
5. `src/pages/Pomo/lib.ts` 是 0 字节空文件，顺手删了。

## 实际抓到的 bug（计划里没预见）

### ① Vue 的响应式 Proxy 直接进 Dexie → `DataCloneError`

最严重的一个，且**类型检查和单测都抓不到**：

```
Failed to execute 'add' on 'IDBObjectStore': [object Object] could not be cloned.
DataCloneError
```

`ref([])` 出来的是 Proxy，Dexie 写库走 structured-clone，遇到 Proxy 直接抛错。
凡是「把表单状态直接写库」的地方都会中招，实际受影响的是：

- `EditTask.vue`（`stages` / `subtasks` / `pointsPerSubtask` / `repeatDaysOf*` 都是响应式数组）
- `EditReward.vue`（`repeatDaysOfWeek` / `repeatDaysOfMonth`）
- `DataImportExport.vue`（`ref(JSON.parse(...))` 也是深响应式）

修法：`src/libs/plain.ts` 的 `toPlain()`（JSON 深拷贝），在这三处写库前过一道。
**教训**：`vue-tsc` 与 vitest 都全绿的情况下，这类问题只有真跑一遍写库才暴露。

### ② `alert()` 把渲染进程整个卡死（排查过程的坑）

上面的 `DataCloneError` 被 catch 成 `alert("Failed to save task: ...")`，
在 bow 里 `alert` 是原生模态 → 主线程被阻塞 → **CDP 的 `Runtime.evaluate` 全部超时**，
表现完全像「页面死循环」。一开始我误判成无限循环去找 watch 环，绕了远路。

**教训**：自动化里看到 eval 超时，先想「有没有原生模态框」（`alert` / `confirm`），再想死循环。

### ③ `vue-tsc` 通过但 `vite build` 失败：SFC 编译期限制

`DatePicker.vue` 在 `withDefaults` 的默认值里引用局部变量 `defaultFormat`：

> `defineProps()` in `<script setup>` cannot reference locally declared variables
> because it will be hoisted outside of the setup() function.

`vue-tsc` 不报，只有 SFC 编译器报。**教训**：`vue-tsc` 不是 `vite build` 的替代品，两个都要跑。

### ④ `@vue/test-utils` 下「非法字符」用例会失败 —— 真实行为回归

React 的受控 `<input value={text}>` 会在事件后把 DOM 值恢复成 state，所以「输入非法字符被忽略」
在界面上表现为「字符没进去」。Vue 用 `:value="text"` 时，如果 handler 提前 return（state 没变），
**Vue 不会重新渲染，非法字符就留在输入框里了**。

修法：`NumberInput.vue` 的拒绝分支显式 `target.value = text.value` 回滚 DOM。
这个 bug 是移植测试时被原测试用例抓出来的 —— **把 React 的测试原样移植过来是有价值的**。

## 验证结果

| 项 | 结果 |
|---|---|
| `bunx vue-tsc --noEmit` | 0 错 |
| `bunx vitest run` | 25 文件 / **319 例全绿**（与迁移前完全一致：22 个纯逻辑测试一例未改） |
| `bunx vite build` | ✓（dist 536 KB / gzip 167 KB） |
| `cargo test` | 11 例全绿（Rust 未动） |
| 真浏览器逐路由冒烟 | **19 条路由**（含 `/tasks/:id`、`/rewards/:id`、`/replenishment/:templateId`）全部渲染，0 应用报错 |
| 真实写入流程 | 建任务（simple + count/阶段）→ 首页显示 → 详情弹窗 → 完成 → 计数/进度刷新 |
| 奖励流程 | 建奖励（0 积分 / ¥100）→ 商店 → 详情弹窗 → 购买 → 消费页出现（¥100、100%、1 items） |
| 番茄钟 | 开始 → 暂停（interruptions=1）→ 放弃，会话落库为 `aborted` |
| 设置 | TimePicker 滚轮选 06:00 → 保存 → 库里 `dayEndTime=06:00`，UI 显示「Morning 06:00」 |
| 成就 | 无 LLM 配置 → 回退弹窗 → 内置建议生成 6 条 → 接受一条 → Proposed(5)/In Progress(1) |
| 报告 | 有真实数据时聚合正确（Completion rate 50%、Completed 1/2） |

**未做（环境不允许）**：Android 真机（`adb devices` 空）、APK 打包、
原生通知文案、Android 返回手势真机行为。

## 已知的既有问题（不是本次迁移引入，未改）

- `Pomo/index.vue` 的放弃/提前完成用 `window.confirm()`。Tauri Android WebView 里
  `confirm` 没有原生实现，真机上这两条路径很可能**无反应**（React 版同样如此）。
  若要修，应换成 `useConfirm()`（应用内确认框）。
- `Achievements` / 其它页面在浏览器（非 Tauri）里会显示
  「Cannot read properties of undefined」之类的 AI 设置报错，属预期（无 Tauri 宿主）。
