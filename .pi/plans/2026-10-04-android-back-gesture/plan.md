# Android 返回手势：弹窗优先关闭 + tab 页不进历史

日期：2026-10-04
模式：plan → build

## 1. 目标

1. **弹窗响应返回手势**：Android 返回手势/返回键在浮层（弹窗、确认框、选择器）打开时，先把最上层浮层关掉，而不是穿透到底层路由。
2. **底部 tab 页不参与返回**：`BottomNav` 的 5 个 tab 页之间切换（以及弹窗里跳 tab 页）不再往历史里塞记录；在 tab 页按返回 = 退出到系统后台，而不是回到上一个 tab 页。

用户拍板的两条口径：
- 返回手势遇到 `maskClosable={false}` 的弹窗（如成就解锁弹窗）→ **等同 Esc，直接关闭**（`onClose` 照常执行）。
- 任务详情弹窗里的「使用番茄钟」跳 `/pomo`（tab 页）→ **用 `replace`**。

假设：只处理 Android（项目本身 Android-only），不引入新的 Rust 依赖/命令、不改 `capabilities/default.json`。

## 2. 现状（已读代码）

### 2.1 Android 返回键的真实链路

`src-tauri/gen/android/.../generated/TauriActivity.kt:15`

```kotlin
override val handleBackNavigation: Boolean = false
```

`handleBackNavigation=false` 让 wry 自带的 `WryActivity` 回调（`WryActivity.kt:25-38`）不注册，改由 Tauri 核心的 `AppPlugin` 接管 —— `~/.cargo/registry/.../tauri-2.10.3/mobile/android/src/main/java/app/tauri/AppPlugin.kt:28-47`：

```kotlin
val callback = object : OnBackPressedCallback(true) {
  override fun handleOnBackPressed() {
    if (!hasListener(BACK_BUTTON_EVENT)) {              // JS 没有注册监听时
      if (webView?.canGoBack() == true) webView!!.goBack()   // ① 走 WebView 历史
      else { isEnabled = false; activity.onBackPressed(); isEnabled = true }  // ② activity 默认返回
    } else {
      trigger(BACK_BUTTON_EVENT, data)                  // ③ 只把事件发给 JS，不自己处理
    }
  }
}
```

三条结论：
- **弹窗不做任何事**，返回手势会走 ①，于是弹出弹窗时按返回 = 路由回退（用户遇到的现象）。
- **路由回退靠 WebView 历史**：`①` 的 `webView.goBack()` 会触发 `popstate`，React Router（`BrowserRouter`，`src/App.tsx:38`）跟着回退。所以「tab 页不能回退」= 让 tab 切换不进 WebView 历史。
- **一旦 JS 注册了监听（③），系统默认返回就完全不可达**。所以不能常驻注册：JS 侧没有可用的「退出应用」API（`core:app` 权限表里没有 `exit`，`core:app:allow-exit` 不存在；也没装 `@tauri-apps/plugin-process`），真退出必须交回 `②` 的 `activity.onBackPressed()`，它的语义正是 Android 期望的「退到后台」（进程不杀，番茄钟前台服务不受影响）。

已验证 `onBackButtonPress` 在本项目的 `@tauri-apps/api` 里可用（`node_modules/@tauri-apps/api/app.d.ts:219`，内部是 `addPluginListener('app','back-button',handler)`），权限 `core:app:allow-register-listener` 已由 `core:default` 覆盖（`src-tauri/capabilities/default.json` 已有 `"core:default"`），**无需改 capability**。Kotlin 侧 `hasListener`/`removeListener`（`Plugin.kt:172-201`）确认注销后 `hasListener` 变回 false，默认返回恢复。

### 2.2 现在的浮层盘点

| 组件 | 结构 | 备注 |
| --- | --- | --- |
| `src/components/Popup.tsx` | 自带遮罩 + Esc 关闭 | **主入口**，被 TaskDetailPopup / RewardDetailPopup / DatePicker / Store / Stats / Home / DataImportExport / Pomo 的 SettingsPopup+TaskSelector / AchievementUnlockDialog 等复用 |
| `src/components/ConfirmDialog.tsx` | 自带遮罩 + Esc 取消（`onCancel`） | 由 `useConfirm` provider 渲染，可能叠在 Popup 之上（任务详情 → 删除确认） |
| `src/components/IconPicker.tsx` | 自带遮罩，`fixed inset-0 z-[100]` | 只有 X / 遮罩 → `handleCancel`（**会重置 temp 选中态**），无 Esc |
| `src/components/TimePicker.tsx` | 自带遮罩，`fixed inset-0 z-50` | 遮罩/X → `onClose`，无 Esc |
| `src/pages/PointsHistory/components/DateRangePicker.tsx` | 内联小下拉（`fixed inset-0 z-40` 透明遮罩） | 不是「弹窗」，可选 |

现有 Esc 实现（保持一致的行为基线）：
- `Popup.tsx:58-62`：`if (e.key === 'Escape' && isOpen && animationState === 'entered') onClose()` —— **不区分 `maskClosable`**。
- `ConfirmDialog.tsx:28-37`：`if (e.key === 'Escape') onCancel()`。

### 2.3 tab 导航现状

`src/components/BottomNav.tsx:12-30`：`<NavLink to={to} className={...}>`，**没有 `replace`** → 每次点 tab 都 `pushState`。于是 Home → Profile 后，WebView `canGoBack()` 为 true，返回手势走 ① → 回到 Home。

另有一处「弹窗里跳 tab 页」：`src/components/TaskDetailPopup.tsx:434-437`

```ts
usePomoStore.getState().setSelectedTask(instance.id!);
navigate('/pomo');
```

其余 `navigate(...)` 全部指向非 tab 页（SimpleLayout），或 `navigate(-1)`，不受影响。

## 3. 方案

### 3.1 新增 `src/hooks/useBackButtonHandler.ts`（模块级 LIFO 栈 + 惰性注册）

```ts
import { useEffect, useRef } from "react";
import type { PluginListener } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { onBackButtonPress } from "@tauri-apps/api/app";

/** 按「打开顺序」排列的返回手势处理器，栈顶 = 最上层浮层 */
const stack: Array<() => void> = [];
let listener: PluginListener | null = null;
let attaching: Promise<void> | null = null;

/** 只在栈非空时占用返回手势。栈空 → 注销 → Tauri 回落到系统默认返回
 *  （② activity.onBackPressed = 退到后台），这是 JS 无法自己触发的行为 */
function attach() {
  if (listener || attaching) return;
  attaching = onBackButtonPress(() => stack[stack.length - 1]?.())
    .then((l) => {
      // 极端竞态：await 期间浮层全关了 → 立刻注销，别把返回手势永久吞掉
      if (stack.length === 0) void l.unregister();
      else listener = l;
    })
    .catch((e) => console.warn("注册返回手势监听失败", e))
    .finally(() => { attaching = null; });
}

async function detach() {
  const l = listener;
  listener = null;
  if (l) await l.unregister().catch(() => {});
}

export function useBackButtonHandler(enabled: boolean, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });   // 不依赖 handler 身份，避免每渲染重注册

  useEffect(() => {
    if (!enabled || !isTauri()) return;                 // 浏览器 dev / vitest 下自动跳过
    const entry = () => handlerRef.current();
    stack.push(entry);
    attach();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) void detach();
    };
  }, [enabled]);
}
```

为什么用模块级栈而不是「每个浮层各注册一个监听」：Kotlin 的 `trigger` 会发给**所有**已注册 channel，各管各的会导致任务详情 + 删除确认被同一次返回一起关掉。栈保证只关最上面那层。

为什么惰性注册（而不是常驻 + 自己实现「退出」）：见 §2.1 第三条，JS 没有退出 API，只能把控制权交回系统。

### 3.2 四处接入（各 1~2 行）

- `src/components/Popup.tsx`：与 `handleKeyDown` 同一个 effect 区，加
  `useBackButtonHandler(isOpen && animationState === "entered", onClose);`
  （与 Esc 完全同构，含 `maskClosable={false}` 也关闭 —— 已确认口径）
- `src/components/ConfirmDialog.tsx`：加 `useBackButtonHandler(isOpen, onCancel);`（在 `if (!isOpen) return null;` **之前**调用）
- `src/components/IconPicker.tsx`：加 `useBackButtonHandler(isOpen, handleCancel);`（用 `handleCancel`，因为它要重置 `tempIcon/tempColor/searchQuery`，别用裸 `onClose`）
- `src/components/TimePicker.tsx`：加 `useBackButtonHandler(isOpen, onClose);`

### 3.3 路由：tab 页用 `replace`

- `src/components/BottomNav.tsx`：`NavItem` 里的 `<NavLink to={to} replace ...>`（在 `NavItem` 内改一处即可，5 个 tab 全覆盖；竖屏底部栏与横屏 `SimpleLayout` 侧栏是同一个组件）。
- `src/components/TaskDetailPopup.tsx:437`：`navigate('/pomo')` → `navigate('/pomo', { replace: true })`。

效果：history 里永远只有一条 tab 记录，`canGoBack()` 为 false → 系统默认 ② → 退到后台/退出应用（番茄钟前台服务不受影响）。

## 4. 步骤（每步可独立验证）

1. **新增 `src/hooks/useBackButtonHandler.ts`**（§3.1 的代码，中文注释）→ `bunx tsc --noEmit` 通过。
2. **`src/components/Popup.tsx` + `src/components/ConfirmDialog.tsx` 接入**（§3.2）。验证：新增测试文件 `src/components/Popup.test.tsx`（见步骤 5）。
3. **`src/components/IconPicker.tsx` + `src/components/TimePicker.tsx` 接入**（§3.2）。验证：`bun run build` 绿 + 手测（编辑奖励 → 换图标 → 返回键关掉选择器且 temp 选中态被重置）。
4. **`src/components/BottomNav.tsx` 加 `replace`；`src/components/TaskDetailPopup.tsx` 的 `/pomo` 跳转改 `replace`**。验证：`bun run build` 绿。
5. **新增 `src/components/Popup.test.tsx`**（沿用 `src/components/NumberInput.test.tsx` 的 `createRoot` + `act` + `IS_REACT_ACT_ENVIRONMENT` 写法）：
   - `vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }))`，`vi.mock("@tauri-apps/api/app")` 捕获回调并暴露 `unregister` spy；
   - 用例 A：单个 `Popup isOpen` → 触发捕获到的回调 → `onClose` 被调用；
   - 用例 B：先开 Popup、再开 Popup/ConfirmDialog（模拟任务详情 + 删除确认）→ 触发回调 → **只有最上层**被关；
   - 用例 C：浮层全关后（`unmount` + `await act(async () => {})` 刷微任务）→ `unregister` 被调用（栈空即归还返回手势）。
   每个用例结束 `root.unmount()`，保证模块级栈回到空，用例之间不串。
6. **全量验证**：`bunx tsc --noEmit`、`bunx vitest run`（注意：`bun test` 会跑 Bun 自带 runner 而挂死，必须 `bun run test` / `bunx vitest run`）、`bun run build` 全绿。
7. **真机验证（需要 Android 设备，用户协助）**：`bun run build:android:debug && bun run launch:android:debug`，然后
   `adb shell input keyevent 4`（等价返回手势）：
   - Home 点开任务卡片（弹窗）→ 返回键 → 弹窗关；再按 → 退出到系统桌面/后台（**不杀进程**，番茄钟继续跑）；
   - Home 底部切到 Profile → 返回键 → 直接退到后台，**不再回到 Home**；
   - Home →「全部任务」→ 返回键 → 回到 Home；再按 → 退到后台；
   - Profile → 设置 → 返回键 → 回 Profile；
   - 任务详情弹窗 → 删除 → 返回键 → 只关掉确认框，任务详情还在。

## 5. 风险 / 未知

- **注册竞态窗口**：`onBackButtonPress` 是异步 IPC（通常 < 5ms），而 `Popup` 打开到 `entered` 有 50ms、动画 300ms，真人不可能在那之前按返回；反之关闭瞬间注销也有毫秒级窗口（此时按返回会被吞掉一次）。已用「`await` 后重新检查栈是否为空」兜住极端情况，不额外加锁。
- **React StrictMode 双调用**（`src/main.tsx` 用了 `<React.StrictMode>`）：effect 会 mount→unmount→mount，模块级 `attach/detach` 的 `attaching`/`listener` 幂等设计能正确处理（重复 `attach` 早返回，挂起的那个在 resolve 时以当时的栈为准）。
- **横屏残留历史**：从二级页（如 `/tasks`）在横屏侧栏点 tab 时，`replace` 只替换栈顶，于是 `/` 仍留在历史里 → 那次返回会回到 Home。这是「没法用 Web 历史 API 清空栈」的固有限制；竖屏下二级页不显示 tab 栏，影响面很小。若后续要彻底解决，需要改成内存路由 + 常驻监听（得先有可用的退出 API），不在本次范围。
- **浏览器 dev 与测试环境无关注册**：`bun run dev` 在浏览器里 `isTauri()` 为 false，返回手势不生效（浏览器后退仍会离开当前路由），弹窗不响应 —— 属预期，真机才验证。
- **`DateRangePicker` 内联下拉未接入**（可选加分项）：它关掉后返回手势会照常走路由回退。若需要，加一行 `useBackButtonHandler(isOpen, () => setIsOpen(false))` 即可（该状态在页面组件里）。
- **Esc 与返回手势语义统一在 `maskClosable=false` 弹窗上「能关」**：成就解锁弹窗按返回 = 推进到下一个（`shiftUnlock`），与现有 Esc 行为一致；如果之后觉得不妥，改 `Popup` 那一行传 `maskClosable ? onClose : noop` 即可。
- 文档（`README.md` / `AGENTS.md` / `src/docs/`）本次无需改；`AGENTS.md` 的「Header / i18n」约定不涉及浮层行为。

## 6. 实现结果（2026-10-04 build 阶段）

改动（新增 2 个文件，修改 6 个）：

- 新增 `src/hooks/useBackButtonHandler.ts`（§3.1，`Popup` 那处按 §5 的风险说明改成 `enabled = isOpen`，避免开关动画里注册-注销来回抖）。
- 新增 `src/components/Popup.test.tsx`（3 例：单弹窗关闭 / 嵌套只关最上层 / 全关后 `unregister`）。
- `src/components/Popup.tsx`、`ConfirmDialog.tsx`、`IconPicker.tsx`（用 `handleCancel`）、`TimePicker.tsx` 各接一行 hook。
- `src/components/BottomNav.tsx`：`NavLink` 加 `replace`。
- `src/components/TaskDetailPopup.tsx`：`navigate('/pomo', { replace: true })`。

验证：`bunx tsc --noEmit` 0 错误；`bunx vitest run` **26 文件 / 336 例全绿**（含新增 3 例）；`bun run build` 绿。

另核实：`tauri-2.10.3/src/manager/webview.rs:162` 给主 frame 注入了 `window.isTauri = true`，所以 `isTauri()` 在 Android WebView 里为真（hook 不会静默失效）。

**待用户真机验证**（本机 `adb devices` 显示 `192.168.1.3:38999 offline`／`adb connect` 也被拒，且没有已构建的 APK）：`bun run build:android:debug && bun run launch:android:debug`，再按 §4 第 7 步逐条用 `adb shell input keyevent 4` 走一遍。

### 6.1 浏览器端「真渲染层」E2E（无真机时的替代验证，已跑通）

做法：`bunx vite --host --port 1420` + bow 浏览器，在页面上装一个**假 Tauri IPC**（`window.isTauri = true` + `__TAURI_INTERNALS__` 的 `transformCallback` / `invoke` 桩，按 `@tauri-apps/api/core.js` 的 Channel 协议真发 `back-button` 事件），这样跑的是**真实的 React 组件 + 真实的 hook + 真实的 `addPluginListener`/Channel 代码**，只有 Android 原生那一层是假的。

实测结果（全部通过）：

| 场景 | 结果 |
| --- | --- |
| 新开页面 `/`（history.length=1）→ 点 Profile tab | `history.length` 仍为 1；`history.back()` 不动 → 真机即 `canGoBack=false` → 退到后台（**用户报的 bug 已修**） |
| `/profile` → 设置（push，length=2）→ `history.back()` | 回到 `/profile`；tab 页上再按一次原地不动 |
| Home 任务卡片 → 任务详情弹窗（`Popup`） | 打开时注册监听（`plugin:app|register_listener` 恰 1 次，StrictMode 下也没重复） |
| 弹窗内「删除」→ 确认框（嵌套） | 第 1 次返回只关确认框、详情弹窗仍在、监听保留；第 2 次返回关详情弹窗、监听注销；第 3 次返回 → `NO_LISTENER`（交回系统默认） |
| 编辑奖励页 `IconPicker` / 设置页 `TimePicker` | 返回手势关闭浮层，且返回时 `canGoBack=true` 也**不产生路由变化**（停留在 `/rewards/new`、`/settings`） |
| 正常路径回归 | 真实点「删除 → 确认」仍能删掉任务并关弹窗 |
| 全程 IPC 日志 | 9 次 register / 9 次 remove 完全配平，无泄漏 |

