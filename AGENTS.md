# AGENTS.md

本文件为 AI 编程助手提供此代码库的工作指南。

## 项目概述

这是一个 Tauri v2 + React 19 + TypeScript 桌面/移动端应用，使用 Bun 作为包管理器。
- **前端**: React + Vite + Tailwind CSS v4 + Zustand
- **后端**: Rust (Tauri v2)
- **数据库**: Dexie.js (IndexedDB)

## 常用命令

### 开发
```bash
# 仅启动前端开发服务器
bun run dev

# 启动桌面端开发模式（推荐）
bun run dev:pc

# 启动 Android 开发模式
bun run dev:android
```

### 构建
```bash
# 构建前端
bun run build

# 构建桌面端应用
bun run build:pc

# 构建 Android 应用
bun run build:android
```

### 类型检查
```bash
# TypeScript 类型检查
bunx tsc --noEmit

# Rust 代码检查
cd src-tauri && cargo check
```

### 测试
**注意**: 当前项目未配置测试框架。
- 如需添加前端测试，建议使用 Vitest
- Rust 测试: `cd src-tauri && cargo test`
- 运行单个 Rust 测试: `cargo test <test_name>`

## 代码风格指南

### TypeScript/React

#### 文件命名
- 组件文件: PascalCase (如 `TaskCard.tsx`, `HomeHeader.tsx`)
- 工具函数/钩子: camelCase (如 `useTasks.ts`, `formatDate.ts`)
- 类型定义文件: camelCase (如 `task.ts`, `user.ts`)

#### 导入顺序
1. React 内置钩子
2. 第三方库
3. 类型导入 (`import type {...}`)
4. 本地组件
5. 本地 hooks/utils
6. 样式文件

```typescript
import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import type { TaskInstance } from "@/db/types";
import { TaskCard } from "@/components/TaskCard";
import { useTasks } from "@/hooks/useTasks";
```

#### 组件规范
- 使用函数组件，返回类型由 TypeScript 推断
- Props 接口命名为 `{ComponentName}Props`
- 使用 `@/` 路径别名引用 src 目录下的模块

```typescript
interface TaskCardProps {
  id: number;
  title: string;
  onClick: () => void;
}

export function TaskCard({ id, title, onClick }: TaskCardProps) {
  // ...
}
```

#### 命名规范
- 组件: PascalCase (`TaskCard`, `HomeHeader`)
- Hooks: camelCase 且以 `use` 开头 (`useTasks`, `useConfirm`)
- 类型/接口: PascalCase (`TaskInstance`, `RepeatMode`)
- 工具函数: camelCase (`filterPendingTasks`, `calculateTaskStats`)
- 常量: UPPER_SNAKE_CASE

#### 状态管理
- 使用 Zustand 进行全局状态管理
- Store 文件放在 `src/store/` 目录
- Store 命名: `{feature}Store.ts` (如 `userStore.ts`, `taskStore.ts`)

#### 自定义 Hooks
- 放在 `src/hooks/` 目录
- 必须以 `use` 开头
- 返回对象或数组，便于解构

### CSS/Tailwind

#### 主题颜色
项目使用自定义主题，优先使用以下颜色变量：
- `--color-primary`: #f56565 (主色调 - 红色)
- `--color-background`: #1b1b1f (背景色)
- `--color-surface`: #202127 (卡片背景)
- `--color-text-primary`: #ffffff (主要文字)
- `--color-text-secondary`: #a0a0a0 (次要文字)

#### Tailwind 类名顺序
1. 布局 (flex, grid, block)
2. 尺寸 (w-, h-, min-h-)
3. 间距 (p-, m-, gap-)
4. 背景 (bg-)
5. 边框 (border-, rounded-)
6. 文字 (text-, font-)
7. 交互 (hover:, focus:, disabled:)
8. 动画 (transition-, animate-)

### Rust

#### 命名规范
- 函数/变量: snake_case
- 类型/结构体: PascalCase
- 常量: UPPER_SNAKE_CASE

#### 命令函数
使用 `#[tauri::command]` 暴露给前端：
```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

#### 平台特定代码
使用条件编译处理平台差异：
```rust
#[cfg(desktop)]
// 仅桌面端代码

#[cfg(mobile)]
// 仅移动端代码
```

### 错误处理

#### TypeScript
- 使用 try-catch 处理异步操作
- 在 catch 块中检查 error 类型
- Store 中的错误应设置到 state 中

```typescript
try {
  await someAsyncOperation();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  set({ error: message });
}
```

#### Rust
- 使用 `Result` 类型
- 在命令函数中使用 `?` 操作符传播错误

## 项目结构

```
src/
├── components/     # 可复用 UI 组件
├── pages/         # 页面组件
├── hooks/         # 自定义 React Hooks
├── store/         # Zustand 状态管理
├── db/            # 数据库相关
│   ├── types/     # TypeScript 类型定义
│   ├── services/  # 数据库服务层
│   └── migrations/# 数据库迁移
├── libs/          # 工具库
└── index.css      # 全局样式

src-tauri/
├── src/
│   ├── main.rs    # 入口
│   └── lib.rs     # 主库代码
└── Cargo.toml
```

## 注意事项

1. **移动端适配**: 使用 `pt-safe`, `pb-safe` 等安全区域类名处理刘海屏
2. **深色主题**: 项目使用深色主题，避免使用浅色背景
3. **滚动条**: 全局隐藏滚动条 (`::-webkit-scrollbar { display: none }`)
4. **路径别名**: 始终使用 `@/` 别名而非相对路径 `../`
5. **类型严格**: TypeScript 启用严格模式，确保类型安全
