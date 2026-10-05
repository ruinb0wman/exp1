# exp1 Vue 迁移：器约定与已完成 API（供移植使用）

> 迁移分支：`vue-migration`。目标：把 React 19 前端整体换成 Vue 3 + Vite。
> 本文件是**当前已完成的 Vue 层 API 清单 + 移植规则**，移植剩余文件时必须遵守。

## 1. 硬性规则

1. **导入 `.vue` 必须写全路径带扩展名**：`import TaskList from "@/components/TaskList.vue"`。
   Vite 的 `resolve.extensions` 不含 `.vue`，`@/components/TaskList` 解析不到 `TaskList.vue`。
2. **写完 `.vue` 后删掉对应的 `.tsx`**，避免同名文件与死代码。
   例外：`src/hooks/**` 整个目录在收尾阶段统一删除，不要逐个删。
3. **不要 import react / react-router / lucide-react / zustand**。图标用 `lucide-vue-next`。
4. `<script setup lang="ts">` + `<template>`；**缩进用 tab**；字符串双引号；必须有分号。
5. 面向用户的文案一律**英文内联**；注释与 `console.*` 可留中文。
6. 逻辑层（`src/db/**`、`src/libs/**`、`src/services/**`、`src/db/types/**`）**一行都不要改**，
   直接 import 复用。
7. 组件 props 用 `defineProps<{...}>()`，事件用 `defineEmits<{ evt: [args] }>()`。
   表单类组件用 `modelValue` + `update:modelValue`（父组件写 `v-model`）。
8. Pinia store 的 state 是 ref：**组件里必须用 `storeToRefs(store)` 解构**，
   否则丢响应性。action 可以直接从 store 解构。
9. 原 React 的 `useEffect(fn, [deps])` → `watch(source, fn, { immediate: true })`；
   `useEffect(fn, [])` 挂载 → `onMounted`；清理 → `onUnmounted` / `onScopeDispose`。
10. 原 React 的 `useCallback` 直接写成普通函数（Vue 不需要 memo 化）。
11. 路由参数：`useRoute().params.id`；跳转：`useRouter().push(...)` / `.back()`。
    `react-router` 的 `NavLink` → `RouterLink`。

## 2. 已完成的 composables（位于 `src/composables/`）

全部接受 `MaybeRefOrGetter<T>`（也接受普通值，用 `toValue()` 读）；返回的是 ref/computed。

```ts
useSafeAreaInsets()                     // → Ref<{top,right,bottom,left}>
useBackButtonHandler(enabled, handler)  // Android 返回手势，浮层用它
useConfirm()                            // → (options) => Promise<boolean>
useLiveQuery(querier, deps?)            // → { data, error, start, stop }

usePageInitializer({ userId, onInitialized?, onError? })   // → { initialize }
useExpiredTaskChecker({ userId, onChecked?, onError? })    // → { isChecking, hasChecked, checkExpiredTasks, resetCheckFlag }
useTaskInstanceGenerator({ userId, onGenerated?, onError? })
// → { isGenerating, hasGenerated, generateToday, generateForDate,
//     getTemplatesForDate, shouldGenerateOnDate, getDisplayTasksForDate, resetGenerationFlag }
useAchievementWatcher(userId)           // 副作用，无返回值
useGlobalPomoTimer()                    // 副作用，无返回值
useAppBootstrap()                       // 副作用，无返回值

// useTasks.ts
useTaskTemplates(userId?)        // → { templates, isLoading, error, refresh }
useTaskTemplate(id)              // → { template, isLoading, error, refresh }
useTaskTemplateActions()         // → { create, update, disable, toggleEnabled, isLoading, error }
useTodayTasks(userId)            // → { tasks, isLoading, error, refresh }
useNoDateTasks(userId)           // → { tasks, isLoading, error, refresh }
useTasksByDate(date, userId?)    // → { instances, isLoading, error, refresh }
useTaskInstanceActions()         // → { complete, skip, reset, remove, isLoading, error }
useTaskStatistics(userId, startDate?, endDate?)  // → { stats, isLoading, error, refresh }

// useRewards.ts
useRewardTemplates(userId?)      // → { templates, isLoading, error, refresh }
useRewardTemplate(id)            // → { template, isLoading, error, refresh }
useRewardTemplateActions()       // → { create, update, remove, toggleEnabled, isLoading, error }
useStoreRewards(userId)          // → { rewards, isLoading, error, refresh }（rewards: {template, availableCount}[]）
useReplenishmentHistory(templateId)  // → { records, isLoading, error, refresh }

// useRewardPurchases.ts
useRewardPurchases(userId)       // → { purchases, isLoading, error, refresh }
useRewardPurchaseActions()       // → { purchase, remove, isLoading, error }
useRewardPurchaseStats({ userId, scope, anchor, customStart, customEnd })
// → { stats, period, isLoading, error, refresh }
export type PurchaseScope = "month" | "year" | "custom"

// usePointsHistory.ts
usePointsHistory({ userId, pageSize?, autoLoad? })
// → { list, stats, hasMore, total, isLoading, isLoadingMore, error,
//     filterType, startDate, endDate, loadMore, refresh,
//     setFilterType, setDateRange, resetFilters }
export { getDefaultDateRange }

// useTaskHistory.ts
useTaskHistory({ userId, pageSize? })
// → { list, stats, hasMore, total, isLoading, isLoadingMore, error,
//     filterStatus, loadMore, setFilterStatus, refresh }
export type TaskStats = { total; completed; pending; skipped }
export type { TaskHistoryFilterStatus }

// useReport.ts
useReport({ userId, scope, anchor, customStart, customEnd })  // → { model, isLoading, error, refresh }

// useProfileStats.ts
useProfileStats(userId)   // → { stats, recentHistory, isLoading, error, refresh }
export type ProfileStats = { totalPointsEarned; tasksCompleted; itemsRedeemed; currentStreak }

// useAchievements.ts
useAchievements(userId)   // → { achievements, isLoading }
```

## 3. 已完成的 Pinia stores（`src/store/`）

**state 全部是 ref，组件里要 `storeToRefs`。**

```ts
useUserStore()  // user, currentPoints, isLoading, error
                // initUser, refreshUser, updateUser, addPoints, spendPoints,
                // calculatePoints, subscribeToPointsChanges, unsubscribeFromPointsChanges
useTaskStore()  // todayTasks, noDateTasks, isLoading, error
                // subscribeToTodayTasks(id), subscribeToNoDateTasks(id),
                // unsubscribeFromTodayTasks(), unsubscribeFromNoDateTasks(),
                // refreshTodayTasks(), refreshNoDateTasks()
                // export type TaskWithTemplate = { instance, template }
usePomoStore()  // mode, timeLeft, totalTime, isRunning, isPaused, selectedTaskId,
                // todayCount, currentSessionId, settings, isSettingsLoaded
                // setMode, setSelectedTask, updateSettings, startTimer, pauseTimer,
                // resumeTimer, stopTimer, tick, loadTodayCount, resetTimer, loadSettings
useAchievementStore()  // pendingUnlocks, pushUnlocks, shiftUnlock, clearUnlocks
```

`src/store/index.ts` 已 `export *` 全部四个 store。

## 4. 已完成的组件（`src/components/`）

**移植页面时必须按这些 API 调用。**

| 文件 | props | emits / 插槽 |
|---|---|---|
| `LoadingState.vue` | `message?`, `size?: "sm"\|"md"\|"lg"` | — |
| `EmptyState.vue` | `title`, `description?` | 默认插槽 = icon |
| `ErrorState.vue` | `title?`, `retryLabel?` | `@retry`（不传则不渲染按钮） |
| `Progress.vue` | `completedCount`, `totalCount`, `earnedPoints?`, `estimatedTotalPoints?` | — |
| `FilterTabs.vue` | `options: readonly T[]`, `activeFilter: T` | `@change="(o) => ..."`；`#label="{ option }"` 自定义文案（无插槽则显示原始值） |
| `RadioGroup.vue` | `list: string[]`, `v-model`（number，下标） | `v-model` |
| `Slider.vue` | `v-model`（number）, `min`, `max`, `step?`, `class?`, `disabled?` | `v-model` |
| `MultiSelectGrid.vue` | `list: {label,value}[]`, `value: number[]`, `maxCol?`, `itemWidth?` | `@change="(v:number) => ..."` |
| `ConfirmDialog.vue` | `isOpen`, `title?`, `message`, `confirmLabel?`, `cancelLabel?`, `variant?` | `@confirm`, `@cancel` |
| `IconPicker.vue` | `isOpen`, `selectedIcon`, `selectedColor` | `@select="(icon,color)"`, `@close` |
| `DynamicIcon.vue` | `name: string`, `color?: string` + 透传 `class`/`size`/`stroke-width` | — |
| `Header.vue` | `title`, `back?` | `#left` / `#right` 插槽；可选 `@back` 覆盖默认 `router.back()` |
| `HeaderActionButton.vue` | `label`, `side?: "start"\|"end"` | `@click`；默认插槽放图标 |
| `HomeHeader.vue` | `user: User\|null`, `currentPoints` | — |
| `BottomNav.vue` | — | — |
| `layouts/BaseLayout.vue` | `showBottomNav?` | 默认插槽（缺省渲染 `<RouterView />`） |
| `layouts/MainLayout.vue` / `SimpleLayout.vue` | — | 内含 `<RouterView />`，路由用 |
| `Popup.vue` | `isOpen`, `position: "bottom"\|"center"`, `maskClosable?`, `title?`, `showCloseButton?`, `hideMask?`, `maxHeight?`, `width?` | `@close`；插槽 `#default` / `#header` / `#headerRight` / `#footer` |
| `NumberInput.vue` | `v-model`, `min?`, `max?`, `step?`, `label?`, `suffix?`, `disabled?`, `size?`, `inputWidth?`, `allowDecimal?` | `v-model` |
| `TaskTemplateCard.vue` | `id`, `title`, `description?`, `level`, `repeatMode`, `enabled`, `completeRule?`, `subtasks`, `isActionLoading` | `@click`, `@toggleEnabled="(e: MouseEvent)"` |
| `TaskInstanceCard/index.vue` | `item?`, `template?`, `instance?`, `isPreview?` | `@click="({template, instance}) => ..."` |
| `TaskList.vue` | `tasks`, `isLoading`, `title?`, `showViewAll?`, `showHistory?`, `emptyMessage?` | `@taskClick="(instance, template) => ..."` |
| `PomoTimer.vue` | — | — |
| `PointsHistoryCard.vue` | `item: PointsHistory` | — |

`DynamicIcon.vue` 的 `iconMap` 与 `PointsHistoryCard.vue` 的图标映射保持原样。

**死代码**：`src/components/TaskCard.tsx` 全仓库无人引用，**不要移植**，直接删。

## 5. 移植时的常见改写对照

| React | Vue |
|---|---|
| `{cond && <X/>}` | `<X v-if="cond" />` |
| `{a ? <X/> : <Y/>}` | `<X v-if="a" />` / `<Y v-else />` |
| `list.map(x => <X key={x.id}/>)` | `<X v-for="x in list" :key="x.id" />` |
| `className={...}` | `:class="\`...\`"` |
| `style={{a: 1}}` | `:style="{ a: 1 }"` |
| `onClick={fn}` | `@click="fn"` |
| `onClick={() => fn(a)}` | `@click="fn(a)"` |
| `props.children` | `<slot />` |
| `<input value={v} onChange={e=>f(e.target.value)} />` | `<input v-model="v" />` 或 `:value` + `@input` |
| `useStore(s => s.x)` | `const store = useXStore(); const { x } = storeToRefs(store)` |
| `xxxRef.current` | 普通闭包变量或 `ref().value` |
| `navigate("/x")` | `router.push("/x")` |
| `<Navigate to="/x" />` | `<RouterLink to="/x">` 或重定向路由 |

## 6. 验证方式

不要在整个仓库跑类型检查（迁移期间旧 `.tsx` 会大量报错，属预期）。只检查你负责的文件：

```bash
bunx vue-tsc --noEmit 2>&1 | grep -E "你改的文件名"
```

你负责的文件里出现 0 条错误即可。模板里的类型错误也会被 vue-tsc 报出来（已验证）。
