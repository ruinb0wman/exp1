# Pomo 的 window.confirm() 换成应用内确认框

> 状态：**计划待批准**（当前会话处于 plan 只读模式）。批准后切 build 执行。
> 日期：2026-10-05　分支：`vue-migration`

## 1. 为什么必须改（不是「体验优化」，是功能坏了）

`src/pages/Pomo/index.vue:57-68` 现在用原生 `window.confirm()`：

```ts
// 放弃按钮
function handleStop() {
	if (confirm("Are you sure you want to give up the current timer?")) {
		void pomoStore.stopTimer(false);
	}
}

// 完成按钮（提前完成）
function handleComplete() {
	if (confirm("Complete the current timer early?")) {
		void pomoStore.stopTimer(true);
	}
}
```

两个后果，都实测过（2026-10-05 迁移验证时）：

1. **Android 上按钮等于死的**：Tauri 的 Android WebView 没有 `onJsConfirm` 实现，
   `WebChromeClient` 默认返回 false → `confirm()` **直接返回 false**，什么都不弹。
   于是「放弃 / Complete Early」两个按钮点下去毫无反应。
   （这是既有问题：迁移前的 React 版一模一样。）
2. **能弹的地方会卡死整个渲染进程**：bow（Electron）里 `confirm` 是原生模态，
   主线程被阻塞 → 我用 CDP 自动化时 `Runtime.evaluate` 全部超时、`browser_navigate`
   报「等待加载超时」，**表现完全像无限循环**（当时先去找 watch 环，绕了远路）。
   同一个坑在 `alert()` 上已经踩过一次。

应用内本来就有一套确认框（`useConfirm()` + `ConfirmDialog.vue`，
挂在 `src/App.vue` 全局渲染，`variant` 支持 danger/warning/info，
内部 `useBackButtonHandler` 让 Android 返回手势等于取消），
`TaskDetailPopup` / `Achievements` / `Consumption` / `EditReward` 都在用它。这里只是漏了一处。

## 2. 要改的文件（只有 1 个）

### `src/pages/Pomo/index.vue`

**① 加 import**

```ts
import { useConfirm } from "@/composables/useConfirm";
```

**② setup 里取到确认函数**（`useConfirm()` 返回的是模块级函数，不依赖组件实例，
但放在 setup 里与其它页面写法一致）

```ts
const confirmDialog = useConfirm();
```

**③ 两个 handler 改成 async + 应用内确认**

```ts
// 放弃按钮
async function handleStop() {
	const ok = await confirmDialog({
		title: "Give Up",
		message: "Are you sure you want to give up the current timer?",
		confirmLabel: "Give Up",
		variant: "danger",
	});
	if (!ok) return;

	try {
		await pomoStore.stopTimer(false);
	} catch (error) {
		console.error("Failed to give up pomodoro session:", error);
	}
}

// 完成按钮（提前完成）
async function handleComplete() {
	const ok = await confirmDialog({
		title: "Complete Early",
		message: "Complete the current timer early?",
		confirmLabel: "Complete",
		variant: "info",
	});
	if (!ok) return;

	try {
		await pomoStore.stopTimer(true);
	} catch (error) {
		console.error("Failed to complete pomodoro session early:", error);
	}
}
```

要点：

- `message` **原样保留**原来的问句文案（用户可见文案不变）。
- 补 `title`：应用内确认框总是显示标题，不给就用默认的 "Confirm"，
  与其它调用点（`title: "Delete"` / `"Dismiss All"`）的写法保持一致。
- 顺带把 `void stopTimer()` 换成 `await` + try/catch：原来 DB 写失败是静默的
  unhandled rejection；同类页面（`TaskHistory` / `Consumption`）都是 try/catch + console.error。
- `<template>` 里 `@stop="handleStop"` / `@complete="handleComplete"` **不用动**
  （`ControlButtons` 的 emits 类型不变，Vue 不关心 handler 是否 async）。
- 计时器在弹确认框期间继续跑：真到点了由 `useGlobalPomoTimer` 走完成流程并把
  `currentSessionId` 置空，此时再点确认 → `stopTimer` 开头的 `if (!currentSessionId) return`
  会安全早退。不需要额外加锁。

## 3. 验证

1. `bunx vue-tsc --noEmit` → 0 错
2. `bunx vitest run` → 25 文件 / 319 例仍全绿（本次不碰测试）
3. `bunx vite build` → 通过
4. **真浏览器手测**（这次能自动化了，因为不再有原生模态框）：
   - `/pomo` → 点开始 → 点「放弃」→ **页面内弹出 Give Up 确认框**（含 Cancel / Give Up）
     → 点 Cancel：计时继续、`pomoSessions` 无新记录
   - 再点「放弃」→ 点 Give Up：计时停止，库里那条会话 `status = "aborted"`
   - 点开始 → 点「Complete Early」→ 确认 → 会话 `status = "completed"`、
     `todayCount +1`、若选了 time 类任务则任务进度前进
   - 控制台 0 报错
5. 真机上「按钮有反应」留待真机验证（`adb devices` 当前为空），已与其它真机项一起记在 scratchpad。

## 4. 顺带发现：同类的 `alert()` 还有 6 处（**本次不做，等你决定**）

同一个根因（原生模态框），在 Android 上同样是**静默失效**（错误提示看不到）：

| 位置 | 用途 |
|---|---|
| `src/pages/EditTask.vue:218` | `alert("User not initialized")` |
| `src/pages/EditTask.vue:291` | 保存任务失败 |
| `src/pages/EditReward.vue:141` | 单件金额非法 |
| `src/pages/EditReward.vue:187` | 保存奖励失败 |
| `src/pages/EditReward.vue:221` | 删除奖励失败 |
| `src/pages/DataImportExport.vue:59` | 导出失败 |

它们比 `confirm()` 轻（只是「错误看不见」，不会让按钮变死），但 `alert()` 在 bow 里
会**阻塞渲染进程**——迁移验证时正是它把页面卡住、让我误判成死循环，所以自动化调试时它是个真障碍。

改法有两条路，需要你选（**我没有自作主张做掉**）：

- **A（改动最小）**：加 `useAlert()`，复用 `ConfirmDialog` 加一个「只显示一个按钮」的模式
  （约 15 行：`ConfirmOptions` 加 `alertOnly?: boolean`，`ConfirmDialog` 里 `v-if` 掉 Cancel），
  6 处 `alert(msg)` → `void alertDialog({ title: "Error", message: msg })`。
- **B（更贴合表单场景）**：这 6 处里 4 处是表单提交失败，改成把错误写进各页已有的
  `error` ref、在按钮上方内联显示（不需要新组件），只有 DataImportExport 的导出失败用 A。

我倾向 **A**：一次把「原生模态框」这个坑彻底清掉，且新增代码最少。

## 5. 风险

- 确认框期间计时器继续走 → 上面已论证安全（后端按截止时间戳算，前端只做收尾）。
- `variant: "info"` 的确认按钮是 `bg-primary`（与其它按钮同色）——
  「Complete Early」不是破坏性操作，用 info 合适；如果你希望更醒目可改 `warning`。

---

# 执行记录（2026-10-05）

按 §2 改完，只动了 `src/pages/Pomo/index.vue`。

## 验证结果

| 项 | 结果 |
|---|---|
| `bunx vue-tsc --noEmit` | 0 错 |
| `bunx vitest run` | 25 文件 / 319 例全绿（未碰测试） |
| `bunx vite build` | 通过 |
| 真浏览器：Cancel 路径 | 点开始 → 「25:00 Focusing」→ 点停止 → **页内弹「Give Up / Are you sure you want to give up the current timer? / Cancel / Give Up」** → 点 Cancel → 弹窗消失、计时**仍在跑** |
| 真浏览器：放弃路径 | 点停止 → 点 Give Up → 标签从 Focusing 回到 Focus（已停），`pomoSessions` 新增一条 `status = "aborted"` |
| 真浏览器：提前完成路径 | 点开始 → 点 Complete Early → 页内弹「Complete Early / Complete the current timer early? / Cancel / Complete」→ 点 Complete → **「1 completed today」**，`pomoSessions` 新增一条 `status = "completed"` |
| 控制台 | 除「无 Tauri 宿主时 invoke 失败」这条预期报错外 0 报错 |

实测落库（IndexedDB `pomoSessions`）：

```
[{id:1, status:"aborted",   actualDuration:81, interruptions:1},   // 迁移验证时留下的旧记录
 {id:2, status:"aborted",   actualDuration:0,  interruptions:0},   // 本次「放弃」
 {id:3, status:"completed", actualDuration:0,  interruptions:0}]   // 本次「提前完成」
```

**这次能自动化验证，本身就是修复的副产品**：原生 `confirm()` 会阻塞渲染进程，之前这两条路径
根本没法用 CDP 点；换成应用内确认框后可以完整点通。

`grep -rn "confirm(" src` 现在只剩 Pomo 里那行解释性注释，没有真实的原生调用。

## 未做

- §4 里另外 6 处 `alert()`：**等用户选 A/B**，本次没动。
- 真机上「按钮有反应」：`adb devices` 仍为空，已与其它真机项一起记在 scratchpad。
