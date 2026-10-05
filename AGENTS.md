# AGENTS.md

AI coding assistant guidelines for this Tauri v2 + Vue 3 + TypeScript project.

## Project Overview

- **Frontend**: Vue 3 (`<script setup lang="ts">` SFC) + Vite + Vue Router + Pinia + Tailwind CSS v4
- **Backend**: Rust (Tauri v2)
- **Target**: Android only (无桌面端支持)
- **Database**: Dexie.js (IndexedDB wrapper)
- **Package Manager**: bun
- **TypeScript**: Strict mode enabled

## Build Commands

```bash
# Development
bun run dev              # Frontend only
bun run dev:android      # Android (with host IP)

# Build
bun run build            # Frontend production build
bun run build:android    # Android production build

# Type Checking
bun run typecheck       # vue-tsc --noEmit（.vue 也会被检查）
bun run build           # vue-tsc --noEmit && vite build

# Testing
bunx vitest              # Run all tests
bunx vitest [pattern]    # Run tests matching pattern
bunx vitest src/db/services/taskService.test.ts  # Run single test file
bunx vitest --reporter=verbose  # Verbose output

# Rust (in src-tauri/)
cd src-tauri && cargo check
cd src-tauri && cargo build
cd src-tauri && cargo test [test_name]  # Run single test
```

## Code Style Guidelines

### File Naming
- **Components**: PascalCase `.vue`（如 `TaskCard.vue`、`HomeHeader.vue`）
- **Composables**: camelCase with `use` prefix（如 `useTasks.ts`、`useConfirm.ts`）
- **Stores**: camelCase（如 `taskStore.ts`）
- **Utils/Libs**: camelCase (e.g., `time.ts`, `task.ts`)
- **Types**: camelCase (e.g., `task.ts`, `user.ts`)

### Import Order
1. Vue
2. Third-party libraries
3. Type imports (`import type {...}`)
4. Local components
5. Local composables/utils
6. Styles

```typescript
import { computed, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import type { TaskInstance } from "@/db/types";
import TaskCard from "@/components/TaskCard.vue";
import { useTasks } from "@/composables/useTasks";
```

> 导入 `.vue` 必须写全扩展名（`@/components/TaskCard.vue`）：Vite 的
> `resolve.extensions` 不含 `.vue`，省略扩展名解析不到。

### Naming Conventions
- **Components**: PascalCase (`TaskCard`, `HomeHeader`)
- **Composables**: camelCase with `use` prefix (`useTasks`, `useConfirm`)
- **Types/Interfaces**: PascalCase (`TaskInstance`, `RepeatMode`)
- **Functions**: camelCase (`filterPendingTasks`, `calculateTaskStats`)
- **Constants**: UPPER_SNAKE_CASE

### Component Patterns
- 一律 `<script setup lang="ts">` + `<template>`，不用 Options API
- props 用 `defineProps<{...}>()`，事件用 `defineEmits<{ evt: [args] }>()`
- 表单类组件用 `modelValue` + `update:modelValue`，父组件写 `v-model`
- 具名插槽替代 React 的「传一坨 JSX」的 props
- 用 `@/` path alias；缩进用 tab

```vue
<script setup lang="ts">
const props = defineProps<{
  title: string;
  enabled: boolean;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button :disabled="!props.enabled" @click="emit('click')">{{ props.title }}</button>
</template>
```

### Formatting
- **Indentation**: Tabs (observed in existing codebase)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required
- **Line width**: ~100 characters

### State Management
- Use Pinia for global state（`defineStore(id, setup)` 写法：state 用 `ref`，getter 用 `computed`，action 用普通函数）
- Store files in `src/store/` as `{feature}Store.ts`
- **组件里解构 state 必须用 `storeToRefs(store)`**，否则丢响应性；action 可直接解构
- 组件级状态用 `ref` / `reactive`
- Use Dexie `liveQuery` for reactive database subscriptions（包在 composable 里，`onScopeDispose` 退订）

### ⚠️ 写库前必须 `toPlain()`
`ref`/`reactive` 里的对象是 **Proxy**，Dexie 写库走 structured-clone，遇到 Proxy 会抛
`DataCloneError: could not be cloned`。凡是「把表单 / 响应式状态直接写库」的地方，
都要先过 `toPlain()`（`src/libs/plain.ts`）。已用于 `EditTask` / `EditReward` / `DataImportExport`。

### Error Handling
- Wrap async operations in try-catch
- Type check errors: `error instanceof Error`
- Store errors in state for UI display

```typescript
try {
  await someAsyncOperation();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  error.value = message;
}
```

### TypeScript Types
- Use strict types, avoid `any`
- Export types from `src/db/types/`
- Use `type` for unions, `interface` for objects
- Mark optional fields with `?`

### Tailwind CSS
- Use custom theme colors: `primary`, `background`, `surface`, `text-primary`, `text-secondary`
- Class order: layout → sizing → spacing → background → border → text → interactive → animation
- Use `pt-safe`, `pb-safe` for mobile safe areas
- Global scrollbar hidden with `::-webkit-scrollbar { display: none }`

### Rust (src-tauri/)
- Functions/variables: `snake_case`
- Types/structs: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Use `#[tauri::command]` to expose to frontend
- Platform-specific: `#[cfg(mobile)]`

## Project Structure

```
src/
├── components/      # Reusable UI components (.vue)
├── pages/          # Route components (.vue)
├── composables/    # Custom composables (useXxx.ts)
├── store/          # Pinia stores
├── router/         # vue-router 路由表
├── db/             # Database layer
│   ├── types/      # TypeScript types
│   ├── services/   # DB operations
│   └── migrations/ # Schema migrations
├── services/       # Business logic (sync, etc.)
├── libs/           # Utility functions
├── docs/           # System design & architecture docs
├── App.vue         # 应用外壳（RouterView + 全局弹窗）
├── main.ts         # createApp + pinia + router 挂载
└── index.css       # Global styles + Tailwind

src-tauri/
├── src/
│   ├── main.rs     # Entry point
│   ├── lib.rs      # Commands + setup
│   ├── pomo_timer.rs
│   └── sync/
└── Cargo.toml
```

## Key Conventions

- **Dark theme only** - never use light backgrounds
- **Path alias** - always use `@/` not relative `../`
- **UTC timestamps** - store as ISO strings, convert for display only
- **Database** - Dexie.js with transactions for consistency
- **Tests** - Vitest with jsdom environment, co-located with source files
- **Comments** - Codebase uses Chinese comments; follow existing patterns
- **Header** - 页面标题栏统一使用 `src/components/Header.vue`（槽位图标按钮用 `HeaderActionButton.vue`）；`Home`/`Pomo` 的个性化头部（问候语 / 计时器控制）为唯一例外
- **Language** - English only: there is no i18n layer, so write every user-facing string (UI, notifications, DB-written descriptions, error messages) inline in English. Comments and `console.*` logs may stay Chinese.
