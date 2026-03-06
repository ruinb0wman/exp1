# hello-tauri - Project Documentation for AI Agents

## Project Overview

This is a **gamified task management application** (任务+积分工具) designed to motivate users to build habits through a reward system. Users can create recurring tasks, track completions, earn experience points (exp), and redeem rewards.

The project uses a hybrid architecture with a **Tauri v2** backend and a **React + TypeScript** frontend. It supports both desktop and mobile platforms (Android).

### Core Features

- **Task Management** - Create recurring tasks with daily/weekly/monthly cycles
- **Calendar View** - Visualize task completion status
- **Reward System** - Exchange experience points for custom rewards
- **Inventory System** - Manage redeemed reward items (backpack)
- **Statistics** - Track task progress and points history
- **Data Backup** - Import/export data in JSON format

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | React | ^19.1.0 |
| Frontend Language | TypeScript | ~5.8.3 |
| Build Tool | Vite | ^7.0.4 |
| Styling | Tailwind CSS | ^4.2.1 |
| Routing | react-router | ^7.13.1 |
| Database | Dexie.js (IndexedDB) | ^4.3.0 |
| State Management | Zustand | ^5.0.11 |
| Icons | lucide-react | ^0.577.0 |
| Backend Framework | Tauri | v2 |
| Backend Language | Rust | Edition 2021 |
| Package Manager | Bun | (lockfile: bun.lock) |

---

## Project Structure

```
hello-tauri/
├── src/                          # Frontend source (React + TypeScript)
│   ├── App.tsx                   # Main React component with routing
│   ├── main.tsx                  # React app entry point
│   ├── index.css                 # Global styles with Tailwind v4
│   ├── vite-env.d.ts             # Vite type declarations
│   │
│   ├── components/               # Reusable UI components
│   │   ├── BottomNav.tsx         # Bottom tab navigation
│   │   ├── Calendar.tsx          # Calendar view component
│   │   ├── DatePicker.tsx        # Date picker component
│   │   ├── Header.tsx            # Page header component
│   │   ├── MultiSelectGrid.tsx   # Multi-select grid (days/weeks)
│   │   ├── Popup.tsx             # Modal/popup component
│   │   └── RadioGroup.tsx        # Radio button group
│   │
│   ├── pages/                    # Page components
│   │   ├── Home.tsx              # Home/task list page
│   │   ├── AllTasks.tsx          # All tasks view
│   │   ├── EditTask.tsx          # Create/edit task form
│   │   ├── Store.tsx             # Reward shop page
│   │   ├── EditReward.tsx        # Create/edit reward form
│   │   ├── Stats.tsx             # Statistics page
│   │   └── Profile.tsx           # User profile page
│   │
│   ├── db/                       # Database layer (Dexie.js)
│   │   ├── index.ts              # Database initialization
│   │   ├── types/                # TypeScript type definitions
│   │   │   ├── index.ts          # DB interface & exports
│   │   │   ├── task.ts           # Task types (TaskTemplate, TaskInstance)
│   │   │   ├── reward.ts         # Reward types (RewardTemplate, RewardInstance)
│   │   │   └── user.ts           # User and PointsHistory types
│   │   ├── migrations/           # Database migrations
│   │   │   └── index.ts          # Schema v1 definition
│   │   └── services/             # Database service layer
│   │       ├── index.ts          # Service exports
│   │       └── userService.ts    # User-related DB operations
│   │
│   └── store/                    # Zustand state management
│       ├── index.ts              # Store exports
│       └── userStore.ts          # User state & points management
│
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Rust binary entry point
│   │   └── lib.rs                # Library with Tauri commands
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri application configuration
│   ├── capabilities/
│   │   └── default.json          # Tauri permissions/capabilities
│   ├── icons/                    # App icons for various platforms
│   └── gen/android/              # Auto-generated Android project files
│       └── app/
│           └── build.gradle.kts  # Android build configuration
│
├── design/                       # UI/UX design prototypes (HTML mockups)
│   ├── (tabs)/                   # Tab page designs
│   │   ├── index.html            # Home/Task list design
│   │   ├── calendar.html         # Calendar view design
│   │   ├── shop.html             # Reward shop design
│   │   └── profile.html          # Profile/settings design
│   ├── components/               # Component designs
│   │   └── taskDetail.html       # Task detail modal design
│   └── pages/                    # Page designs
│       ├── editTask.html         # Task editing page
│       └── editRewards.html      # Reward editing page
│
├── public/                       # Public static assets
├── index.html                    # Vite HTML entry point
├── vite.config.ts                # Vite configuration (Tauri-optimized)
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.node.json            # TypeScript config for Node tooling
└── package.json                  # Node.js dependencies
```

---

## Build and Development Commands

All commands should be run from the project root using Bun:

```bash
# Frontend development only (Vite dev server)
bun run dev

# Full Tauri development (desktop)
bun run dev:pc
# or
bun run tauri dev

# Android development (IMPORTANT: requires --host flag with your machine's IP)
bun run dev:android
# which expands to: tauri android dev --host 192.168.1.5
# Adjust IP in package.json if your network differs

# Production build (TypeScript compile + Vite build)
bun run build

# Preview production build
bun run preview

# Tauri CLI commands
bun run tauri -- <command>
```

### Important Notes for Android Development

The default dev server IP may not work for Android. You **must** specify the host machine's IP address:

```bash
# If the pre-configured IP doesn't work, manually specify:
bun run tauri android dev -- --host <YOUR_MACHINE_IP>
```

---

## Configuration Details

### Vite Configuration (`vite.config.ts`)

- **Port**: Fixed at 1420 (Tauri expects this)
- **HMR Port**: 1421 (for mobile development)
- **Watch**: Ignores `src-tauri/**` to prevent rebuild loops
- **Clear Screen**: Disabled to preserve Rust error visibility
- **Path Alias**: `@/` maps to `src/`

### TypeScript Configuration (`tsconfig.json`)

- **Target**: ES2020
- **Module**: ESNext with Bundler resolution
- **JSX**: react-jsx transform
- **Strict mode**: Enabled
- **Unused locals/parameters**: Errors (not warnings)
- **Path Alias**: `@/*` maps to `src/*`

### Tauri Configuration (`src-tauri/tauri.conf.json`)

- **App ID**: `com.ruinb0w.hello-tauri`
- **Product Name**: `hello-tauri`
- **Dev URL**: `http://localhost:1420`
- **Frontend Dist**: `../dist` (Vite output directory)
- **Window Defaults**: 800x600, title "hello-tauri"

### Android Configuration (`src-tauri/gen/android/app/build.gradle.kts`)

- **Compile SDK**: 36
- **Min SDK**: 24
- **Target SDK**: 36
- **Namespace**: `com.ruinb0w.hello_tauri`

---

## Code Style Guidelines

### TypeScript

Based on `tsconfig.json`:

- Target: ES2020
- Module: ESNext with Bundler resolution
- JSX: react-jsx transform
- Strict mode enabled
- Unused locals and parameters are errors (not warnings)
- Use path alias `@/` for imports from `src/`

### Rust

- Edition 2021
- Standard Tauri patterns with command handlers

### CSS/Styling Conventions

The app follows a **minimalist dark theme** using Tailwind CSS v4:

**Color Palette (defined in `src/index.css`):**
- **Primary Color**: `#f56565` (coral/red)
- **Primary Light**: `#fc8181`
- **Primary Dark**: `#e53e3e`
- **Background**: `#1b1b1f`
- **Surface**: `#202127` (card backgrounds)
- **Surface Light**: `#2a2a30`
- **Text Primary**: `#ffffff`
- **Text Secondary**: `#a0a0a0`
- **Text Muted**: `#6b6b6b`
- **Border**: `#2a2a30`

**Design Patterns:**
- Icons: Lucide with 1.5px stroke width
- Border Radius: 6px (small elements), 12px (large elements/cards)
- Safe area insets: Use `pt-safe`, `pb-safe` classes for mobile notches
- Scrollbar: Hidden by default

---

## Database Architecture

### IndexedDB with Dexie.js

The application uses **Dexie.js** as a wrapper around the browser's IndexedDB for local data persistence.

### Database Schema (v1)

Defined in `src/db/migrations/index.ts`:

| Table | Primary Key | Indexes |
|-------|-------------|---------|
| `taskTemplates` | `++id` (auto-increment) | `userId`, `repeatMode`, `enabled`, `*subtasks` |
| `taskInstances` | `++id` | `userId`, `templateId`, `scheduledDate`, `status`, `[templateId+startAt]` |
| `rewardTemplates` | `++id` | `userId`, `replenishmentMode`, `enabled` |
| `rewardInstances` | `++id` | `templateId`, `userId`, `status`, `expiresAt` |
| `users` | `++id` | `name` |
| `pointsHistory` | `++id` | `userId`, `type`, `createdAt`, `[userId+createdAt]` |

### Key Types

**Task Types (`src/db/types/task.ts`):**
- `RepeatMode`: 'none' | 'daily' | 'weekly' | 'monthly'
- `EndCondition`: 'times' | 'date' | 'manual'
- `TaskStatus`: 'pending' | 'completed' | 'skipped'
- `TaskTemplate`: Task definition with recurrence rules
- `TaskInstance`: Generated task occurrence

**Reward Types (`src/db/types/reward.ts`):**
- `RewardStatus`: 'available' | 'used' | 'expired'
- `ReplenishmentMode`: 'none' | 'daily' | 'weekly' | 'monthly'
- `RewardTemplate`: Reward definition with restocking rules
- `RewardInstance`: Redeemed reward item

**User Types (`src/db/types/user.ts`):**
- `PointsHistoryType`: 'task_reward' | 'reward_exchange' | 'admin_adjustment'
- `User`: User profile with current points
- `PointsHistory`: Points transaction log

### State Management (Zustand)

The `userStore` (`src/store/userStore.ts`) provides:
- User initialization and refresh
- Points management (add/spend)
- Points history tracking
- Loading and error states

---

## Routing Structure

Defined in `src/App.tsx` using react-router v7:

**Layout with Bottom Navigation:**
- `/` - Home (today's tasks)
- `/store` - Reward shop
- `/stats` - Statistics
- `/profile` - User profile

**Simple Layout (no navigation):**
- `/tasks` - All tasks view
- `/tasks/new` - Create new task
- `/tasks/:id` - Edit existing task
- `/rewards/new` - Create new reward
- `/rewards/:id` - Edit existing reward

---

## Security Considerations

### Tauri Capabilities (`src-tauri/capabilities/default.json`)

Currently allows:
- `core:default` - Basic Tauri APIs
- `opener:default` - URL opening functionality

### Content Security Policy

Currently set to `null` in `tauri.conf.json` (development mode). For production, define appropriate CSP restrictions.

---

## Testing

No testing framework is currently configured. Consider adding:

- **Frontend**: Vitest (works well with Vite)
- **Rust**: Built-in `cargo test`

---

## Deployment

### Desktop Builds

```bash
bun run tauri build
```

Outputs to `src-tauri/target/release/bundle/`

### Android Builds

```bash
bun run tauri android build
```

Requires Android SDK and NDK configured.

---

## Development Notes

### Mobile-First Design

The app is designed with mobile-first principles:
- Uses safe area insets (`pt-safe`, `pb-safe`) for notched devices
- Bottom navigation fixed at bottom with safe area padding
- Touch-friendly tap targets
- Responsive layouts using Tailwind CSS

### Database Access Pattern

```typescript
// Use the database hook
import { useDB } from '@/db';

const { getDB } = useDB();
const db = getDB();

// Access tables
const templates = await db.taskTemplates.toArray();
```

### State Store Pattern

```typescript
// Use Zustand store
import { useUserStore } from '@/store';

const { user, initUser, addPoints } = useUserStore();
```

---

## Resources

- [Tauri Documentation](https://tauri.app/develop/)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Dexie.js Documentation](https://dexie.org/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- Design mockups are in the `design/` folder for reference
