# hello-tauri - AI Agent Documentation

## Project Overview

This is a **gamified task management application** (任务+积分工具) designed to motivate users to build habits through a reward system. Users create recurring tasks, track completions, earn experience points (积分), redeem rewards from a virtual shop, and use a Pomodoro timer for focus sessions.

The project uses a **Tauri v2** backend with a **React + TypeScript** frontend. It supports both desktop (Windows/macOS/Linux) and mobile platforms (Android/iOS).

### Core Features

- **Task Management** - Create recurring tasks with daily/weekly/monthly cycles, subtasks, end conditions, and completion rules (time-based or count-based)
- **Calendar View** - Visualize task completion status on a calendar
- **Reward System** - Exchange experience points for custom rewards with customizable icons
- **Inventory System** - Manage redeemed reward items (backpack)
- **Pomodoro Timer** - Focus timer with configurable durations for work sessions and breaks
- **Statistics** - Track task progress and points history
- **Data Import/Export** - Backup and restore data via JSON files
- **Data Persistence** - Local IndexedDB storage via Dexie.js
- **Custom Day End Time** - Configure when a "day" ends (e.g., 02:00 instead of 00:00)

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
│   ├── index.css                 # Global styles with Tailwind v4 @theme
│   ├── vite-env.d.ts             # Vite type declarations
│   │
│   ├── components/               # Reusable UI components
│   │   ├── BottomNav.tsx         # Bottom tab navigation (5 tabs: 首页, 专注, 商店, 统计, 我的)
│   │   ├── Calendar.tsx          # Calendar view component
│   │   ├── DatePicker.tsx        # Date picker component
│   │   ├── DynamicIcon.tsx       # Dynamic Lucide icon renderer for rewards
│   │   ├── Header.tsx            # Page header component
│   │   ├── HomeHeader.tsx        # Home page header with greeting
│   │   ├── IconPicker.tsx        # Icon selection component
│   │   ├── MultiSelectGrid.tsx   # Multi-select grid (days/weeks)
│   │   ├── PomoTimer.tsx         # Pomodoro timer component
│   │   ├── Popup.tsx             # Modal/popup with animations
│   │   ├── Progress.tsx          # Progress indicator
│   │   ├── RadioGroup.tsx        # Radio button group
│   │   ├── TaskList.tsx          # Task list display component
│   │   └── TimePicker.tsx        # Time picker component
│   │
│   ├── pages/                    # Page components
│   │   ├── Home.tsx              # Home page with today's tasks
│   │   ├── AllTasks.tsx          # All tasks view
│   │   ├── EditTask.tsx          # Create/edit task form
│   │   ├── Store.tsx             # Reward shop page
│   │   ├── EditReward.tsx        # Create/edit reward form
│   │   ├── Stats.tsx             # Statistics page
│   │   ├── Profile.tsx           # User profile page
│   │   ├── Pomo.tsx              # Pomodoro timer page
│   │   ├── PointsHistory.tsx     # Points transaction history
│   │   ├── Backpack.tsx          # Inventory of redeemed rewards
│   │   ├── TaskHistory.tsx       # Historical task instances
│   │   ├── Settings.tsx          # App settings page
│   │   └── DataImportExport.tsx  # Data backup/restore page
│   │
│   ├── db/                       # Database layer (Dexie.js)
│   │   ├── index.ts              # Database initialization (singleton pattern)
│   │   ├── types/                # TypeScript type definitions
│   │   │   ├── index.ts          # DB interface & exports
│   │   │   ├── task.ts           # Task types (TaskTemplate, TaskInstance)
│   │   │   ├── reward.ts         # Reward types with icon/color presets
│   │   │   ├── user.ts           # User and PointsHistory types
│   │   │   └── pomo.ts           # Pomodoro session and settings types
│   │   ├── migrations/           # Database migrations
│   │   │   └── index.ts          # Schema v1-v5 definitions
│   │   └── services/             # Database service layer
│   │       ├── index.ts          # Service exports
│   │       ├── userService.ts    # User & points operations
│   │       ├── taskService.ts    # Task CRUD & queries
│   │       ├── rewardService.ts  # Reward CRUD & operations
│   │       ├── pomoService.ts    # Pomodoro session operations
│   │       ├── pointsHistoryService.ts # Points history queries
│   │       └── exportImportService.ts  # Data export/import functionality
│   │
│   ├── hooks/                    # React custom hooks
│   │   ├── useTasks.ts           # Task data fetching hooks
│   │   ├── useTaskInstanceGenerator.ts # Task instance generation hook
│   │   ├── useRewards.ts         # Reward data hooks
│   │   ├── usePointsHistory.ts   # Points history with pagination
│   │   ├── useTaskHistory.ts     # Task history hooks
│   │   ├── useProfileStats.ts    # Profile statistics hooks
│   │   └── usePomo.ts            # Pomodoro timer hooks
│   │
│   ├── libs/                     # Utility libraries
│   │   ├── task.ts               # Task generation logic & date utilities
│   │   └── time.ts               # Time handling with dayEndTime support
│   │
│   └── store/                    # Zustand state management
│       ├── index.ts              # Store exports
│       ├── userStore.ts          # User state & points management
│       └── pomoStore.ts          # Pomodoro timer state
│
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Rust binary entry point
│   │   └── lib.rs                # Library with Tauri commands and plugin init
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri application configuration
│   ├── capabilities/
│   │   └── default.json          # Tauri permissions
│   ├── icons/                    # App icons for various platforms
│   └── gen/android/              # Auto-generated Android project files
│       └── app/
│           └── build.gradle.kts  # Android build configuration
│
├── design/                       # UI/UX design prototypes (HTML mockups)
├── public/                       # Public static assets
├── index.html                    # Vite HTML entry point
├── vite.config.ts                # Vite configuration (Tauri-optimized)
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.node.json            # TypeScript config for Node tooling
├── package.json                  # Node.js dependencies
└── bun.lock                      # Bun lockfile
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
- **Host**: '0.0.0.0' (allows external connections for mobile dev)
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
- **CSP**: Currently set to `null` (development mode)

### Android Configuration (`src-tauri/gen/android/app/build.gradle.kts`)

- **Compile SDK**: 36
- **Min SDK**: 24
- **Target SDK**: 36
- **Namespace**: `com.ruinb0w.hello_tauri`
- **Kotlin JVM Target**: 1.8

---

## Code Style Guidelines

### TypeScript Conventions

Based on `tsconfig.json`:

- Target: ES2020
- Module: ESNext with Bundler resolution
- JSX: react-jsx transform
- Strict mode enabled
- Unused locals and parameters are **errors** (not warnings)
- Use path alias `@/` for imports from `src/`
- **Comments are in Chinese** - maintain this convention for consistency

### Rust Conventions

- Edition 2021
- Standard Tauri patterns with command handlers
- Currently minimal Rust code (frontend-heavy app)
- Plugins initialized in `lib.rs`

### CSS/Styling Conventions

The app follows a **minimalist dark theme** using Tailwind CSS v4:

**Color Palette (defined in `src/index.css` with `@theme`):**

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#f56565` | Coral/red - primary actions |
| `--color-primary-light` | `#fc8181` | Light primary |
| `--color-primary-dark` | `#e53e3e` | Dark primary |
| `--color-background` | `#1b1b1f` | Main background |
| `--color-surface` | `#202127` | Card backgrounds |
| `--color-surface-light` | `#2a2a30` | Elevated surfaces |
| `--color-text-primary` | `#ffffff` | Primary text |
| `--color-text-secondary` | `#a0a0a0` | Secondary text |
| `--color-text-muted` | `#6b6b6b` | Muted text |
| `--color-border` | `#2a2a30` | Borders/dividers |

**Design Patterns:**

- Icons: Lucide with 1.5px stroke width
- Border Radius: 6px (small elements), 12px (large elements/cards)
- Safe area insets: Use `pt-safe`, `pb-safe` classes for mobile notches
- Scrollbar: Hidden by default (`::-webkit-scrollbar` width/height: 0)

---

## Database Architecture

### IndexedDB with Dexie.js

The application uses **Dexie.js** as a wrapper around the browser's IndexedDB for local data persistence.

### Database Schema (Current: v5)

Defined in `src/db/migrations/index.ts`:

| Table | Primary Key | Indexes |
|-------|-------------|---------|
| `taskTemplates` | `++id` (auto-increment) | `userId`, `repeatMode`, `enabled`, `*subtasks`, `[userId+enabled]` |
| `taskInstances` | `++id` | `userId`, `templateId`, `startAt`, `status`, `[templateId+startAt]` |
| `rewardTemplates` | `++id` | `userId`, `replenishmentMode`, `enabled` |
| `rewardInstances` | `++id` | `templateId`, `userId`, `status`, `expiresAt` |
| `users` | `++id` | `name` |
| `pointsHistory` | `++id` | `userId`, `type`, `createdAt`, `[userId+createdAt]` |
| `pomoSessions` | `++id` | `userId`, `taskId`, `mode`, `status`, `startedAt` |

### Key Types

**Task Types (`src/db/types/task.ts`):**

```typescript
type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
type EndCondition = 'times' | 'date' | 'manual';
type TaskStatus = 'pending' | 'completed' | 'skipped';
type CompleteRule = 'time' | 'count';

interface TaskTemplate {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  rewardPoints: number;
  repeatMode: RepeatMode;
  repeatInterval?: number;
  repeatDaysOfWeek?: number[]; // 0-6
  repeatDaysOfMonth?: number[]; // 1-31
  endCondition: EndCondition;
  endValue?: string;
  enabled: boolean;
  subtasks: string[];
  isRandomSubtask: boolean;
  createdAt: string;
  updatedAt: string;
  // Completion rule fields (v5)
  completeRule?: CompleteRule; // 'time' (minutes) or 'count'
  completeTarget?: number; // Target value (minutes or count)
  completeExpireDays?: number; // Expiration days (0 = no expiration)
}

interface TaskInstance {
  id?: number;
  userId: number;
  templateId: number;
  status: TaskStatus;
  rewardPoints: number;
  subtasks: string[];
  startAt?: string;
  createdAt: string;
  completedAt?: string;
  // Progress fields (v5)
  completeProgress?: number; // Current progress
  expiredAt?: string; // Expiration timestamp
}
```

**Reward Types (`src/db/types/reward.ts`):**

```typescript
type RewardStatus = 'available' | 'used' | 'expired';
type ReplenishmentMode = 'none' | 'daily' | 'weekly' | 'monthly';

// 27 preset icons from Lucide
const REWARD_ICONS = ['Gift', 'Coffee', 'Gamepad2', ...] as const;
const REWARD_ICON_COLORS = ['#f56565', '#fc8181', '#ed8936', ...] as const;

interface RewardTemplate {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  pointsCost: number;
  validDuration: number; // seconds, 0 = no expiration
  enabled: boolean;
  replenishmentMode: ReplenishmentMode;
  // ... schedule fields
  icon: RewardIconName;
  iconColor?: RewardIconColor;
}

interface RewardInstance {
  id?: number;
  templateId: number;
  userId: number;
  status: RewardStatus;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string;
}
```

**User Types (`src/db/types/user.ts`):**

```typescript
type PointsHistoryType = 'task_reward' | 'task_undo' | 'reward_exchange' | 'admin_adjustment';

interface User {
  id: number;
  createdAt: string;
  name: string;
  dayEndTime?: string; // "HH:mm" format, default "00:00"
}

interface PointsHistory {
  id?: number;
  userId: number;
  amount: number; // positive for income, negative for expense
  type: PointsHistoryType;
  relatedEntityId?: number;
  createdAt: string;
}
```

**Pomodoro Types (`src/db/types/pomo.ts`):**

```typescript
type PomoMode = 'focus' | 'shortBreak' | 'longBreak';
type PomoStatus = 'running' | 'paused' | 'completed' | 'aborted';

interface PomoSession {
  id?: number;
  userId: number;
  taskId?: number; // Associated task instance ID
  mode: PomoMode;
  duration: number; // Planned duration (seconds)
  actualDuration: number; // Actual focus duration (seconds)
  status: PomoStatus;
  startedAt: string;
  endedAt?: string;
  interruptions: number;
}

interface PomoSettings {
  focusDuration: number; // Default 25 minutes
  shortBreakDuration: number; // Default 5 minutes
  longBreakDuration: number; // Default 15 minutes
  longBreakInterval: number; // Long break after N pomos (default 4)
  autoStartBreaks: boolean;
  autoStartPomos: boolean;
  soundEnabled: boolean;
}
```

### State Management (Zustand)

**User Store (`src/store/userStore.ts`):**

- User initialization and refresh
- Points management (add/spend) - calculated from pointsHistory
- Points history tracking
- Loading and error states

**Pomodoro Store (`src/store/pomoStore.ts`):**

- Timer state management
- Settings management
- Session tracking

### Database Access Pattern

```typescript
// Database uses singleton pattern via getDB()
import { getDB } from '@/db';

const db = getDB();

// Access tables
const templates = await db.taskTemplates.toArray();

// Use service layer for complex operations
import { getTodayTaskInstances, createTaskTemplate } from '@/db/services';
```

---

## Routing Structure

Defined in `src/App.tsx` using react-router v7:

**Layout with Bottom Navigation (5 tabs):**

- `/` - Home (today's tasks)
- `/pomo` - Pomodoro timer
- `/store` - Reward shop
- `/stats` - Statistics
- `/profile` - User profile

**Simple Layout (no navigation):**

- `/tasks` - All tasks view
- `/tasks/new` - Create new task
- `/tasks/:id` - Edit existing task
- `/rewards/new` - Create new reward
- `/rewards/:id` - Edit existing reward
- `/points-history` - Points transaction history
- `/backpack` - Redeemed rewards inventory
- `/task-history` - Historical task instances
- `/settings` - App settings
- `/data-import-export` - Data backup/restore

---

## Key Business Logic

### Task Instance Generation

Task instances are automatically generated based on `TaskTemplate` recurrence rules:

1. **None**: One-time tasks, only one instance ever created
2. **Daily**: Every N days (controlled by `repeatInterval`)
3. **Weekly**: On specified days of week (0-6), every N weeks
4. **Monthly**: On specified days of month (1-31), every N months

Generation logic is in `src/libs/task.ts`:

- `shouldGenerateInstanceOnDate()` - Determines if instance should be created on a specific date
- `filterTemplatesNeedingInstancesOnDate()` - Filters templates needing instances
- `generateTaskInstance()` - Creates instance data from template

Instances are generated via `useTaskInstanceGenerator` hook in `Home.tsx`.

### Task Completion Rules (v5)

Tasks can have completion rules for gradual progress:

1. **Simple**: Mark as complete/incomplete
2. **Time-based** (`completeRule: 'time'`): Track minutes spent (e.g., read for 30 minutes)
3. **Count-based** (`completeRule: 'count'`): Track repetitions (e.g., drink water 8 times)

Progress can be updated manually or automatically via Pomodoro sessions.

### Custom Day End Time

Users can configure when their "day" ends (default 00:00). This affects:

- Which tasks appear as "today's tasks"
- Task instance generation timing
- Statistics calculation

Implemented in `src/libs/time.ts`:

- `getUserStartOfDay()` / `getUserEndOfDay()` - Calculate day boundaries
- `getUserCurrentDate()` - Get the effective "today" based on dayEndTime

### Time Handling Design Principles

All time-related operations in the app follow a strict **UTC for storage/calculation, local time for display** principle:

#### Core Rules

| Operation | Format | Method | Example |
|-----------|--------|--------|---------|
| **Storage** | UTC ISO 8601 | `new Date().toISOString()` | `2026-03-07T15:30:00.000Z` |
| **Calculation** | UTC | `Date.UTC()`, `getUTCFullYear()`, etc. | `Date.UTC(2026, 2, 7)` |
| **Display** | Local time | `toLocaleDateString()`, `getFullYear()` | `2026/3/7` |

#### Key Functions (`src/libs/time.ts`)

**UTC Time Generation:**
```typescript
// Get current UTC timestamp
getUTCTimestamp(): string  // Returns: "2026-03-07T15:30:00.000Z"

// Create UTC start/end of day
createUTCStartOfDay(year, month, day): Date
createUTCEndOfDay(year, month, day): Date

// Get today's UTC range
getTodayUTCRange(): [string, string]  // [startOfDayUTC, endOfDayUTC]
```

**UTC Calculations:**
```typescript
// Date differences using UTC
daysBetweenUTC(date1, date2): number
weeksBetweenUTC(date1, date2): number
monthsBetweenUTC(date1, date2): number

// Check if same UTC day
isSameUTCDay(date1, date2): boolean

// Calculate expiration (UTC-based)
calculateExpiredAt(startAtUTC: string, expireDays: number): string

// Check expiration (compares UTC times)
isExpired(expiredAtUTC?: string): boolean
```

**Local Time Formatting (for display only):**
```typescript
// Format UTC to local date string
formatLocalDate(date: Date | string): string  // "2026-03-07"
formatLocalDateTime(date: Date | string): string  // "2026-03-07 15:30"

// Get relative time text
getExpireTimeText(expiredAtUTC?: string): string  // "2小时后过期"
```

#### Usage Examples

**Storing timestamps (Service Layer):**
```typescript
// Always use toISOString() for storage
const now = new Date().toISOString();  // UTC time
await db.taskInstances.update(id, {
  completedAt: now,
});
```

**Querying by date range:**
```typescript
// Use UTC boundaries for queries
const [startUTC, endUTC] = getTodayUTCRange();
const sessions = await db.pomoSessions
  .where('startedAt')
  .between(startUTC, endUTC)
  .toArray();
```

**Displaying to users:**
```typescript
// Convert UTC to local time for display
const completedAt = instance.completedAt;  // "2026-03-07T15:30:00.000Z"
const displayDate = formatLocalDate(completedAt);  // "2026-03-07"
const displayTime = new Date(completedAt).toLocaleTimeString('zh-CN');
```

#### Special Case: dayEndTime

The `dayEndTime` setting (e.g., "02:00") is a **local time concept** that affects when a "day" starts/ends for the user:

```typescript
// When generating task instances, combine local dayEndTime with UTC storage
const startOfDayUTC = getUserStartOfDay(localDate, dayEndTime);
// Returns UTC ISO string representing the local day boundary
```

#### Common Pitfalls to Avoid

❌ **Don't use local time methods for storage:**
```typescript
// WRONG - stores local time without timezone info
const wrong = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
```

✅ **Do use UTC methods for storage:**
```typescript
// CORRECT - stores UTC time
const correct = new Date().toISOString();
```

❌ **Don't compare dates using local time:**
```typescript
// WRONG - local time comparison
if (new Date(date1).getDate() === new Date(date2).getDate())
```

✅ **Do use UTC for comparisons:**
```typescript
// CORRECT - UTC comparison
if (isSameUTCDay(date1, date2))
```

### Points System

Points flow:

1. **Earn**: Complete task → `addPoints(amount, 'task_reward', instanceId)`
2. **Undo**: Reset completed task → `spendPoints(amount, 'task_undo', instanceId)`
3. **Spend**: Redeem reward → `spendPoints(cost, 'reward_exchange', rewardId)`
4. **Adjust**: Admin adjustments → `addPoints/spendPoints(amount, 'admin_adjustment')`

All point changes are recorded in `pointsHistory` table. Current points are calculated on-demand from history.

### Pomodoro Timer

Focus timer implementation:

- **Modes**: Focus (default 25min), Short Break (5min), Long Break (15min)
- **Auto-start options**: Automatically start breaks/pomodoros
- **Sound**: Configurable sound notifications
- **Task Integration**: Can be linked to task instances for automatic progress update

### Data Import/Export

The app supports JSON-based data backup/restore via `exportImportService.ts`:

- **Export**: Exports all database tables to a JSON file
- **Import Strategies**:
  - `overwrite`: Clears all existing data and imports
  - `merge`: Intelligently merges data, avoiding duplicates

---

## Security Considerations

### Tauri Capabilities (`src-tauri/capabilities/default.json`)

Currently allows:

- `core:default` - Basic Tauri APIs
- `opener:default` - URL opening functionality
- `dialog:default` - Native dialog APIs
- `fs:allow-write-text-file` - Write files for data export
- `fs:allow-read-text-file` - Read files for data import

### Content Security Policy

Currently set to `null` in `tauri.conf.json` (development mode). For production, define appropriate CSP restrictions.

---

## Testing

**No testing framework is currently configured.** Consider adding:

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

## Mobile-First Design

The app is designed with mobile-first principles:

- Uses safe area insets (`pt-safe`, `pb-safe`) for notched devices
- Bottom navigation fixed at bottom with safe area padding
- Touch-friendly tap targets
- Responsive layouts using Tailwind CSS
- Viewport meta: `viewport-fit=cover` for edge-to-edge display

---

## Development Patterns

### Custom Hooks Pattern

Data fetching follows this pattern (see `src/hooks/useTasks.ts`):

```typescript
export function useTodayTasks(userId: number) {
  const [tasks, setTasks] = useState<TaskWithTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTodayTaskInstances(userId);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) refresh();
  }, [refresh, userId]);

  return { tasks, isLoading, error, refresh };
}
```

### Service Layer Pattern

Database operations are encapsulated in services (`src/db/services/`):

```typescript
// Service functions are async and use the DB singleton
export async function createTaskTemplate(
  template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const db = getDB();
  
  const now = new Date().toISOString();
  const newTemplate: TaskTemplate = {
    ...template,
    createdAt: now,
    updatedAt: now,
  };
  
  return db.taskTemplates.add(newTemplate);
}
```

### Component Patterns

**Popup/Modal Usage:**

```typescript
import { Popup } from '@/components/Popup';

<Popup
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  position="bottom" // or "center"
  title="Popup Title"
  maskClosable={true}
>
  {/* Content */}
</Popup>
```

**Safe Area Handling:**

```typescript
// Use safe area utility classes from index.css
<div className="min-h-screen-safe pt-safe pb-safe">
  {/* Content */}
</div>
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

---

## Notes for AI Agents

- **Comments**: Code comments are in Chinese - maintain this convention
- **Date Handling**: The app uses local timezone for date comparisons (not UTC)
- **Task Instance Generation**: Only one instance per template per day is generated
- **User Model**: Currently single-user; user ID is always 1
- **Points**: Stored as integers in history, calculated on-demand for current balance
- **Pomodoro**: Timer state is managed in Zustand store, sessions are persisted to DB
- **Progress**: Tasks with `completeRule` track progress; Pomodoro can auto-update progress
