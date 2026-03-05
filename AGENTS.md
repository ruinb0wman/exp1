# hello-tauri - Project Documentation for AI Agents

## Project Overview

This is a **gamified task management application** (任务+积分工具) designed to motivate users to build habits through a reward system. Users can create recurring tasks, track completions via a calendar view, earn experience points (exp), and redeem rewards.

The project uses a hybrid architecture with a **Tauri v2** backend and a **React + TypeScript** frontend. It supports both desktop and mobile platforms (Android).

### Core Features

- **Task Management** - Create recurring tasks with daily/weekly/monthly cycles
- **Calendar View** - Visualize task completion status
- **Reward System** - Exchange experience points for custom rewards
- **Inventory System** - Manage redeemed reward items
- **Statistics** - Track task progress and points history
- **Data Backup** - Import/export data in JSON format

### Planned Technology Stack

Per README.md, the following are planned but **not yet implemented**:
- Routing: react-router
- Database: dexie.js (IndexedDB wrapper)
- State Management: Zustand

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | React | ^19.1.0 |
| Frontend Language | TypeScript | ~5.8.3 |
| Build Tool | Vite | ^7.0.4 |
| Backend Framework | Tauri | v2 |
| Backend Language | Rust | Edition 2021 |
| Package Manager | Bun | (lockfile: bun.lock) |

---

## Project Structure

```
hello-tauri/
├── src/                          # Frontend source (React + TypeScript)
│   ├── App.tsx                   # Main React component (currently default template)
│   ├── App.css                   # Component styles
│   ├── main.tsx                  # React app entry point
│   ├── vite-env.d.ts             # Vite type declarations
│   └── assets/                   # Static assets (images, etc.)
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

The default dev server IP is incorrect for Android. You **must** specify the host machine's IP address:

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

### Tauri Configuration (`src-tauri/tauri.conf.json`)

- **App ID**: `com.ruinb0w.hello-tauri`
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

### Rust

- Edition 2021
- Standard Tauri patterns with command handlers

### CSS/Design Conventions

From the design mockups, the app follows a **minimalist dark theme**:

- **Primary Color**: `#2b8cee` (blue)
- **Background Dark**: `#101922`
- **Background Light**: `#f6f7f8`
- **Card Background (dark)**: `#202127`
- **Text (dark)**: `#1a1a1a`
- **Accent**: `#f56565` (red/coral)
- **Icons**: Material Symbols Outlined or Lucide (1.5px stroke)
- **Border Radius**: 6px (small), 12px (large)

---

## Current Development State

⚠️ **Important**: This is a template/starter project that has not yet been customized.

- The `src/App.tsx` still contains the default Tauri + React template (greeting form)
- The design mockups in `design/` folder represent the target UI but are not yet implemented
- Planned dependencies (react-router, dexie.js, zustand) are not in package.json

### Next Steps for Development

1. Install planned dependencies:
   ```bash
   bun add react-router dexie zustand
   ```

2. Replace `src/App.tsx` with actual application code based on design mockups

3. Implement the tab navigation (Home, Shop, Stats, Settings)

4. Set up dexie.js for local IndexedDB storage

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

## Resources

- [Tauri Documentation](https://tauri.app/develop/)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- Design mockups are in the `design/` folder for reference
