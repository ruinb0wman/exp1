# 验证：release 包的 chrome://inspect 可调试性到底来自哪里

日期：2026-09-18 · 模式：plan（本文件只描述步骤，未改任何源码）

## 0. 结论与假设（待验证）

**假设 H1**：用户观察到「执行完 `bun run dev:android` 之后 release 包也能被 chrome://inspect 调试，似乎不需要改动什么」，
是因为**手机上/工作区里那个 release APK 就是 21:58 用带 `devtools` feature 的 `Cargo.toml` 编出来的**，
而 `src-tauri/Cargo.toml` 是 22:21 才改回 `features = []`。源码回退不会重构已有二进制。

**反假设 H0**：release（无 `devtools` feature）本来就能被调试，即那处 cfg 不是唯一开关。
→ 若 H0 成立，之前记录的「改前 grep = 0」也不成立，需推翻重查。

预期结果：H1 成立（新编 release 的 `.so` 里该字符串计数为 0）。

## 1. 已核实的现状（读代码/读产物得到，非推测）

| 事实 | 证据 |
|---|---|
| adb 只提供传输与发现通道，调试 socket 由 app 进程创建 | Chromium `chrome/browser/devtools/device/android_device_info_query.cc`：发现流程是 `adb shell getprop/dumpsys/wm size/ps -e/cat /proc/net/unix/dumpsys user/dumpsys trust`，target 只认 `/proc/net/unix` 里 `@*_devtools_remote*` 的抽象 socket；`deviceLocked=1` 时 target 被隐藏 |
| 唯一创建该 socket 的调用点被 cfg 包着 | `wry-0.54.2/src/android/main_pipe.rs:162-169`（0.55.1 在 257-264）：`#[cfg(any(debug_assertions, feature = "devtools"))] self.env.call_static_method(… "setWebContentsDebuggingEnabled" …)` |
| 全依赖树里**没有**第二个调用点 | `grep -rln setWebContentsDebuggingEnabled ~/.cargo/registry/src/*/` → 只有 wry 0.54.2 / 0.55.1；app 自己的 `src-tauri/src/`、`gen/android/`（Java/Kotlin/gradle）均无 |
| feature 链 | `src-tauri/Cargo.toml:21`（现为 `features = []`）→ `tauri-2.11.5/Cargo.toml:92` `devtools = ["tauri-runtime/devtools","tauri-runtime-wry?/devtools"]`（**不在默认 feature 列表**）→ `tauri-runtime-wry-2.11.4/Cargo.toml:45` `devtools = ["wry/devtools","tauri-runtime/devtools"]`；调用点 `tauri-runtime-wry-2.11.4/src/lib.rs:5209-5211` 同样被 cfg 包着 |
| `dev:android` 不做任何 adb 侧魔法 | CLI 二进制 `node_modules/@tauri-apps/cli-linux-x64-gnu/cli.linux-x64-gnu.node` 中 `localabstract` / `webview_devtools` / `setprop` 三个字符串均**不存在**，`am start` 只有一处启动 activity 的用法 |
| **旧产物确实带 feature** | `gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`（21:58）`grep -c -a setWebContentsDebuggingEnabled` = **1**；`target/aarch64-linux-android/release/libexp1_lib.so`（21:58）= **1**；`release/.fingerprint/tauri-f9c9294e8bfc4193/lib-tauri.json` 与 `release/.fingerprint/wry-aa90669e8d94de8e/lib-wry.json` 的 features 里都有 `devtools` |
| 时间差 | `src-tauri/Cargo.toml` mtime = 22:21 > APK/.so mtime = 21:58 → 当前的 `features = []` 从未被任何一次 release 构建消费过 |

## 2. 步骤（顺序执行，每步都有可判定输出）

### S0 备份"带 feature"的老产物（先做，否则被覆盖就没了）
`/home/ruinb0w/Workspace/exp1/` 下：
```
cp src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk /tmp/exp1-release-with-devtools.apk
cp src-tauri/target/aarch64-linux-android/release/libexp1_lib.so /tmp/libexp1_lib.so.with-devtools
cp src-tauri/target/aarch64-linux-android/release/.fingerprint/tauri-f9c9294e8bfc4193/lib-tauri.json /tmp/fingerprint-tauri-with-devtools.json
```
判据：三个文件存在，且 `/tmp/exp1-release-with-devtools.apk` 的 `grep -c -a` = 1。

### S1 记录 before（真机对照的基线）
```
adb shell am force-stop com.ruinb0w.exp1
adb shell am force-stop com.ruinb0w.exp1.debug
adb install -r /tmp/exp1-release-with-devtools.apk
adb shell input keyevent KEYCODE_WAKEUP
adb shell monkey -p com.ruinb0w.exp1 -c android.intent.category.LAUNCHER 1
adb shell cat /proc/net/unix | grep devtools
```
判据：能看到 `@webview_devtools_remote_<pidof com.ruinb0w.exp1>`；chrome://inspect 里出现
`WebView in com.ruinb0w.exp1`。**这一步本身就证明"旧 APK 带 feature"**，与 `dev:android` 无关。

### S2 用当前源码（`features = []`）重新构建 release
```
bun run build:android     # = tauri android build --target aarch64 --apk（会先跑 bun run build）
```
改动文件：无（纯构建）。

### S3 二进制判据（主要证据）
```
grep -c -a setWebContentsDebuggingEnabled \
  src-tauri/target/aarch64-linux-android/release/libexp1_lib.so          # 预期 0
grep -c -a setWebContentsDebuggingEnabled \
  src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk  # 预期 0
grep -c -a devtools src-tauri/target/aarch64-linux-android/release/.fingerprint/tauri-*/lib-tauri.json  # 预期全部 0
```
- 全部为 0 → **H1 成立**，进入 S4/S5。
- 出现 1 → **H0 成立，我的推断被推翻**：立刻停止后续步骤，转去查
  ① 是否有未列入白名单的调用点（例如 `tauri-build` 生成的代码、`MainActivity.kt`）；
  ② `[profile.release]` 是否有人打开 `debug-assertions`（现在 `src-tauri/Cargo.toml` 无 profile 段）；
  ③ 是否只是缓存未失效（`cargo clean -p tauri -p wry` 后重编再 grep）。

### S4 真机判据（对照 S1）
```
adb shell am force-stop com.ruinb0w.exp1
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
adb shell input keyevent KEYCODE_WAKEUP
adb shell monkey -p com.ruinb0w.exp1 -c android.intent.category.LAUNCHER 1
adb shell cat /proc/net/unix | grep devtools      # 预期：无输出（只剩 .debug 那条）
```
判据：chrome://inspect 里 `WebView in com.ruinb0w.exp1` 消失，`...exp1.debug` 仍在。
注意：先退两个包、唤醒屏幕（`dumpsys trust` 的 `deviceLocked=1` 会让 Chrome 主动隐藏 target）；包名不同是
`gen/android/app/build.gradle.kts:39` 的 `applicationIdSuffix = ".debug"`。

### S5 收尾：记录与决策（**只有 S3/S4 判据如预期才做**）
1. 写 memory（`mode: "append"`）：
   「验证 release 可调性前先比 `src-tauri/Cargo.toml` 的 mtime 与 APK/.so 的 mtime；源码回退不会重构已有二进制，
   旧产物会伪造『不需要改』的假象。」
2. 把 `.pi/plans/2026-09-18-release-devtools-verify/` 结果补进 daily log。
3. 决策点（三选一，需用户拍板）：
   - **A 永久打开**：`src-tauri/Cargo.toml:21` → `tauri = { version = "2", features = ["devtools"] }`（+ README 一条）。
   - **B 用 `build:android:debug` 当中转**：cargo debug profile（`debug_assertions` on → socket 在）+ CLI 的
     `tauri/custom-protocol`（资源走 `dist/`，不依赖 vite）。**这一条我尚未实测**，S6 专门验证。
   - **C 不改**，正式包永远不带调试 socket。

### S6（仅当倾向 B 时做）验证 `build:android:debug` 是"bundled dist + 可调试"
```
bun run build:android:debug
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
adb shell cat /proc/net/unix | grep devtools        # 预期有
# 断网/关掉 vite 后启动 app，确认界面仍能加载（= 用的是 dist，不是 devUrl）
```
判据：socket 存在 **且** vite 未运行时 app 正常显示 → B 可行。

## 3. 执行结果（2026-09-18 22:33–22:36）—— **H1 成立，H0 被排除**

### S0/S1 基线
- 备份到 `/tmp/exp1-release-with-devtools.apk`、`/tmp/libexp1_lib.so.with-devtools`、`/tmp/fingerprint-tauri-with-devtools.json`，两者 `grep -c -a` 均为 **1**。
- 设备（网络 adb `192.168.1.2:35095`）上 `com.ruinb0w.exp1` 正在运行，pid 23195，`/proc/net/unix` 里有
  `@webview_devtools_remote_23195`。
- **决定性**：`adb shell pm path` + `adb pull` 拿到的 base.apk md5 = `c57c78dd5e23bdb6b45d120199146893`，与 21:58 那份带 feature 的
  APK **逐字节相同**（`lastUpdateTime=2026-09-18 22:00:22`）。
- → **结论：设备上那个可调试的 "release 包"就是带 `devtools` feature 编出来的那份二进制；与 `dev:android` 无关（CLI 里不存在任何 adb 侧调试魔法）。**

### S2/S3 二进制判据（本次重编）
- `bun run build:android` 成功，release profile，39.59s。日志里**没有** `Compiling wry`/`tauri-runtime-wry`——cargo 直接复用了
  09-17 的非 devtools 缓存产物（与 memory 里"改前 grep = 0"一致）。
- 新 `target/aarch64-linux-android/release/libexp1_lib.so`：`grep -c -a setWebContentsDebuggingEnabled` = **0**
- 新 `app-universal-release.apk`（22:35，md5 `d41d564604c64146ea423250eb35ce41`）：**0**
- **fingerprint 判据的坑（本次踩到并修正）**：对 `lib-tauri.json` 直接 `grep devtools` 会命中——JSON 里 `declared_features`
  永远列出该 crate 的全部可选 feature（噪音）。要比的是 `features`：
  - 本次（复用 `tauri-4d3b5b3a7df6ecfe`，mtime 09-17 21:49）：`features` = `["common-controls-v6","compression","custom-protocol","default","dynamic-acl","tauri-runtime-wry","webkit2gtk","webview2-com","wry","x11"]` — **无 devtools** ✓
  - 21:56 那次（`tauri-f9c9294e8bfc4193`）：`features` 里含 `"devtools"` ✓
  - 另外 cargo **不删**旧 fingerprint 目录，必须按 mtime 才能挑出"本次"的那套。

### S4 真机判据
- `adb install -r` 新 APK → 设备侧 md5 `d41d564604c64146ea423250eb35ce41`，与新 APK 一致（`lastUpdateTime=22:36:04`）。
- 拉起后 pid 26970，**`adb shell cat /proc/net/unix | grep devtools` 无输出**（grep exit=1）。
- 截图 `/tmp/exp1-release-after.png` 显示首页任务列表正常渲染 → 排除"其实是崩了/没起来"这一替代解释。
- 与 S1 对照：**同一个包名**，带 feature 的版本 socket 在（`@webview_devtools_remote_23195`），不带 feature 的版本消失。

### 待办（S5/S6）
- [x] 1. 写 memory
- [ ] 2. daily log
- [x] 3. 用户拍板：**A 恢复 `devtools` feature**（与 2026-09-18 22:0x 那次同形）；`.debug` 后缀**保留**（用户理由：开发时不覆盖 release 包，README 已记录 `am start` 错包与 `launch:android:debug` 绕过）
- [ ] S6 仅当倾向 B 时做

## 5. 追加实验（22:37–22:45）：dev server 全停后的**真连** A/B，外加一个额外发现

### 5.1 先修正测试方法（差点被假阳性骗到）
- `curl` 默认走本机代理 `127.0.0.1:7890` → 对**真实 pid** 和**不存在的 pid** 的转发都返回 `502 Bad Gateway` 且 `exit=0`。
  "exit=0 但无输出"就是这个代理造成的假阳性。必须 `curl --noproxy '*'`。
- 加 `--noproxy` 后：socket 不存在 与 "socket 存在但无 devtools 服务" 都是 `exit=52 (Empty reply)`。
  → **单靠 curl 不能判否**，必须配一个正向对照（用带 feature 的包跑通一次），否则“连不上”什么都证明不了。

### 5.2 A/B：同一环境只换二进制（dev server 已全停）
先 kill 掉"用户以为已停、其实还在跑"的两个 dev:android 实例 + vite（pid 725429 / 727501 / 727503 / 726585），确认无残留。

| 设备上装的 APK | `/proc/net/unix` | `curl --noproxy '*' /json/list` |
|---|---|---|
| 新编 `features=[]`（md5 `d41d5646…`） | 无 | `exit=52` 连不上 |
| 21:58 带 `devtools` feature（/tmp 备份） | `@webview_devtools_remote_29227` | **返回真 target**：`任务+积分工具` / `http://tauri.localhost/`；`/json/version` → `"Android-Package":"com.ruinb0w.exp1"` |

→ 同一台设备、同一组命令、dev server 不在跑，**唯一变量是二进制**。可调试性只由构建时的 feature 决定。

### 5.3 额外发现（重要）：`tauri android dev` 拉起的不是 `.debug` 包，而是 identifier 包
- 逐字复现用户场景：装干净的 release 包 → 在后台起 `bun run dev:android`。日志：
  `Starting: Intent { cmp=com.ruinb0w.exp1/.MainActivity }`
- 实测：`.debug` 包 `lastUpdateTime=22:41:45`（确实被 dev:android 装上了，`versionName=0.1.0-debug`），
  **但 `pidof com.ruinb0w.exp1.debug` 240s 内始终为空**；真正在跑的是 `com.ruinb0w.exp1`（pid 30760）
- 且此时 `/proc/net/unix` 里**没有任何 devtools socket** → dev:android 并不会把 release 包变得可调试。
- 根因：CLI 启动步骤用 `tauri.conf.json` 的 `identifier`（`com.ruinb0w.exp1`）拼 `cmp=`，不知道 gradle 侧的
  `applicationIdSuffix = ".debug"`（该行 2026-09-14 由用户加上，commit `c3b6d260`，见 `git blame`；package.json 里的
  `launch:android:debug` 脚本正是为此存在）。
- 解释力："执行完 dev:android 之后 release 包也能被调试" 是**两条独立事实叠加**——
  ① dev:android 顺手把 release 包**拉起来了**（liveness）；② 当时机器上那个 release 包**带 feature**（可调试性）。

### 5.4 收尾状态
- 设备：`com.ruinb0w.exp1` = 干净的 release（22:40:59 装，无 socket），`com.ruinb0w.exp1.debug` = 22:41:45 装的 dev 包（未运行）。
- 本轮起过的 dev:android / vite 已全部 kill。
- 新增待办：`.debug` 后缀 vs CLI `am start` 的错包问题要不要修 → **已拍板：不修**。用户理由保留后缀（开发时不覆盖 release 包），且 `README.md` 的
  「Android 调试包与发布包」一节已经写清楚“`bun run dev:android` 不会自动拉起调试包……请手动跑 `bun run launch:android:debug`”。即这是**已知且已接受的取舍**，不动 gradle。

## 4. 风险与未知

- **gradle 增量缓存**：`gen/android/app/build/intermediates/merged_native_libs/universalRelease/...` 里还留着老 `.so`；
  若 APK 内 `.so` 看起来没更新，以 `target/.../release/libexp1_lib.so` 与 fingerprint 为准，必要时删
  `gen/android/app/build/intermediates/merged_native_libs` 或做一次 clean。
- **S6 的假设未实测**：`tauri android build --debug` 是否真的带 `tauri/custom-protocol` 只有间接证据
  （CLI 二进制里有两处 `custom-protocol` 字符串；tauri 的 `build.rs:257` 用 `dev = !custom_protocol` 切 devUrl）。
- ~~**H0 未被完全排除**~~ → 已排除：S3/S4 均如 H1 预测（0 / 无 socket）。
- 真机步骤依赖 adb 在白名单外（plan 模式跑不了，需切 build 模式）；WSL 下 adb 直连 Windows adb server，注意端口占用问题。

## 6. 分支 A 执行记录（22:48–22:55，已完成）

改动（未提交，仅两个文件）：
- `src-tauri/Cargo.toml:21` → `tauri = { version = "2", features = ["devtools"] }`（`Cargo.lock` 不变）
- `README.md` 「Android 调试包与发布包」一节新增一条 bullet：为什么 release 包需要这个 feature（wry 的 cfg、adb 只负责传输、
  `grep` 判据、删掉即回到只有 debug 可调）

验证（全部通过）：
- `bun run build:android` exit=0，43.70s（复用 21:56 的 devtools 缓存产物，日志无 `Compiling wry`）
- `grep -c -a setWebContentsDebuggingEnabled`：`release/libexp1_lib.so` = **1**；`app-universal-release.apk` = **1**
- fingerprint `tauri-f9c9294e8bfc4193` 的 `features` 含 `devtools`（内容与 21:56 一致，故 cargo 未重写该文件、mtime 仍 21:56）
- 真机：装包后 pid 869，`@webview_devtools_remote_869` 出现；`adb forward` + **CDP 实调**（`/tmp/cdp-check.ts`）
  → websocket 连上（`ws://127.0.0.1:9371/devtools/page/BFF7ABD1…`），`Runtime.evaluate` 返回
  `{"title":"任务+积分工具","href":"http://tauri.localhost/","domNodes":262,"exp":"24 exp"}` → 在 release 包里真的执行了 JS。

未做（因为选了 A 而非 B）：S6 的 `build:android:debug` 验证。以后若改主意再跑。

## 7. 回归与验收（22:51–23:00）

按 `AGENTS.md` 的验证矩阵跑完，全部通过：
- 前端：`bunx vitest --run` → **23 文件 / 255 用例全绿**（5.25s）
- Rust：`cargo check`（宿主 dev）**14.51s 通过**；`cargo check --release`（宿主）**1m01s 通过**
  —— 后者有意义：桌面 release 下 `devtools` feature 是真的会生效的（与 Android 不同），确认开了它不会炸
- Rust 测试：`cargo test` → `llm::tests::normalizes_base_url` **1 passed**（`main.rs` 0 / doc-tests 0）

### 字节级复现（意外但很有力的额外证据）
同一个源 + 同一个 feature 重编出来的东西**逐字节相同**：

| 构建 | APK md5 | `libexp1_lib.so` md5 |
|---|---|---|
| 21:58（旧产物，当时在手机上） | `c57c78dd5e23bdb6b45d120199146893` | `693e405378f37290e53e227899b51afe` |
| 22:49（恢复 feature 后重编，mtime 22:49） | **同上** | **同上** |
| 22:35（`features = []`） | `d41d564604c64146ea423250eb35ce41` | — |

→ “决定因素就是构建时那个 feature” 被铉到字节层面；也反向解释了为什么旧产物会骗人：它跟新产物一模一样。

### 最终真机验收（全新进程）
- pid 4203，APK md5 `c57c78dd…`（与工区产物、设备产物三者一致，`lastUpdateTime=22:49:29`）
- `@webview_devtools_remote_4203` 存在；`curl --noproxy '*' /json/version` → `"Android-Package": "com.ruinb0w.exp1"`
- CDP `Runtime.evaluate` → `{"title":"任务+积分工具","href":"http://tauri.localhost/","domNodes":262,"exp":"24 exp"}`

**计划状态：S0–S5 全部完成；S6 不适用（用户选 A，未选 B）。**
