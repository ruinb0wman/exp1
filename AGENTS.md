# AGENTS.md

AI coding assistant guidelines for this Tauri v2 + React 19 + TypeScript project.

## Project Overview

- **Frontend**: React 19 + Vite + Tailwind CSS v4 + Zustand
- **Backend**: Rust (Tauri v2)
- **Database**: Dexie.js (IndexedDB wrapper)
- **Package Manager**: Bun
- **TypeScript**: Strict mode enabled

## Build Commands

```bash
# Development
bun run dev              # Frontend only
bun run dev:pc           # Desktop (Tauri)
bun run dev:android      # Android (with host IP)

# Build
bun run build            # Frontend production build
bun run build:pc         # Desktop production build
bun run build:android    # Android production build

# Type Checking
bunx tsc --noEmit        # TypeScript check

# Rust (in src-tauri/)
cd src-tauri && cargo check
cd src-tauri && cargo build
cd src-tauri && cargo test [test_name]  # Run single test
```

## Code Style Guidelines

### File Naming
- **Components**: PascalCase (e.g., `TaskCard.tsx`, `HomeHeader.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useTasks.ts`, `useConfirm.tsx`)
- **Utils/Libs**: camelCase (e.g., `time.ts`, `task.ts`)
- **Types**: camelCase (e.g., `task.ts`, `user.ts`)

### Import Order
1. React hooks
2. Third-party libraries
3. Type imports (`import type {...}`)
4. Local components
5. Local hooks/utils
6. Styles

```typescript
import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import type { TaskInstance } from "@/db/types";
import { TaskCard } from "@/components/TaskCard";
import { useTasks } from "@/hooks/useTasks";
```

### Naming Conventions
- **Components**: PascalCase (`TaskCard`, `HomeHeader`)
- **Hooks**: camelCase with `use` prefix (`useTasks`, `useConfirm`)
- **Types/Interfaces**: PascalCase (`TaskInstance`, `RepeatMode`)
- **Functions**: camelCase (`filterPendingTasks`, `calculateTaskStats`)
- **Constants**: UPPER_SNAKE_CASE

### Component Patterns
- Use function components with typed props interface
- Props interface named `{ComponentName}Props`
- Use `@/` path alias for src imports
- Destructure props in function parameters

```typescript
interface TaskCardProps {
  id: number;
  title: string;
  onClick: () => void;
}

export function TaskCard({ id, title, onClick }: TaskCardProps) {
  // Implementation
}
```

### State Management
- Use Zustand for global state
- Store files in `src/store/` as `{feature}Store.ts`
- Local state with `useState` for component-level state

### Error Handling
- Wrap async operations in try-catch
- Type check errors: `error instanceof Error`
- Store errors in state for UI display

```typescript
try {
  await someAsyncOperation();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  set({ error: message });
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
- Platform-specific: `#[cfg(desktop)]` / `#[cfg(mobile)]`

## Project Structure

```
src/
├── components/      # Reusable UI components
├── pages/          # Route components
├── hooks/          # Custom React hooks
├── store/          # Zustand stores
├── db/             # Database layer
│   ├── types/      # TypeScript types
│   ├── services/   # DB operations
│   └── migrations/ # Schema migrations
├── libs/           # Utility functions
└── index.css       # Global styles + Tailwind

src-tauri/
├── src/
│   ├── main.rs     # Entry point
│   └── lib.rs      # Commands + setup
└── Cargo.toml
```

## Key Conventions

- **Dark theme only** - never use light backgrounds
- **Path alias** - always use `@/` not relative `../`
- **UTC timestamps** - store as ISO strings, convert for display only
- **Database** - Dexie.js with transactions for consistency
- **No tests currently** - add Vitest for frontend if needed
