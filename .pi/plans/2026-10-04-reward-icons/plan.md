# 奖励商店新增三个预设图标：宠物 / 网络 / 日用品

日期：2026-10-04
范围：`src/db/types/reward.ts`（`REWARD_ICONS` 列表）、`src/components/DynamicIcon.tsx`（lucide 注册表）
不涉及：UI 组件改动、i18n（图标无文字标签）、DB 字段/迁移、Rust / tauri、**不新增依赖**
（三个图标都在已装的 `lucide-react@0.577.0` 里）

---

## 1. 目标与前提

1. 奖励商店的「选择图标」面板（`IconPicker`）里多出三个可选图标：
   - `PawPrint` → 宠物（猫粮、猫砂、宠物用品等）
   - `Wifi` → 网络（宽带、上网时长等）
   - `SoapDispenserDroplet` → 日用品（洗发水、纸巾、洗护耗材等）
2. 已确认每个品类各加一个图标（用户选择：三项 Recommended）。

前提：用户要的是**图标选择器里的预设项**，不是给商店预置三条商品模板 —— 全仓库没有默认奖励种子
（`grep -rln "rewardTemplates.bulkAdd|createDefaultReward|seedReward" src` 无命中），
奖励模板只能由用户手动创建。

---

## 2. 现状（已读代码）

### 2.1 预设图标是「一个字符串数组 + 一张组件注册表」两处对齐

`src/db/types/reward.ts:4-35`（当前 28 个）：

```ts
// 预设图标名称列表
export const REWARD_ICONS = [
  'Gift', 'Coffee', 'Beer', ... 'Trophy', 'Crown',
] as const;

export type RewardIconName = (typeof REWARD_ICONS)[number];
```

`src/components/DynamicIcon.tsx:48-90` 维护 `iconMap`（奖励图标 ∪ 成就图标的合并注册表），
`DynamicIcon` 查不到名字时**静默回退 Trophy**：

```ts
const IconComponent = iconMap[name];
if (!IconComponent) {
  // 如果找不到图标，返回默认的 Trophy 图标
  return <Trophy color={color} {...props} />;
}
```

⇒ 只加数组、不加注册表 = 图标选择器里出现一个「点进去永远是奖杯」的坏项。**两处必须同时改**。

### 2.2 选择器直接渲染这个数组，无分组、无 i18n

`src/components/IconPicker.tsx:32-33`：`REWARD_ICONS.filter(icon => icon.toLowerCase().includes(q))`，
`grid-cols-6` 平铺，搜索框匹配的是**英文组件名**。图标只按组件名展示，不涉及任何文案。

### 2.3 图标名是存进 DB 的裸字符串

`RewardTemplate.icon: RewardIconName`，消费快照 `RewardPurchaseSnapshot.icon: RewardIconName`，
`RewardsGrid.tsx:52-56` / `RewardDetailPopup.tsx:50-54` / `Consumption/*` 全部走
`<DynamicIcon name={template.icon} color={...} />`。所以：

- 新增图标**不需要迁移**、不影响已有数据（旧值仍在合法集合内）；
- 三个新图标一旦选中，商店卡片、详情弹窗、消费明细都会自动生效，无需改这些文件。

### 2.4 可用的 lucide 导出（已在本机校验）

`node_modules/lucide-react/dist/lucide-react.d.ts` 中确认存在并导出：
`PawPrint`、`Wifi`、`SoapDispenserDroplet`（对应文件 `paw-print.js`、`wifi.js`、
`soap-dispenser-droplet.js`）。

### 2.5 没有测试锚定这张表

`grep -rn "REWARD_ICONS" src --include=*.test.*` 无命中；也没有测试遍历 `REWARD_ICONS` 检查
`DynamicIcon` 是否注册（即「数组/注册表不一致」目前没有测试兜底）。本次不新增测试，靠类型 + 人工核对。

---

## 3. 改动清单

| 文件 | 改什么 |
| --- | --- |
| `src/db/types/reward.ts` | `REWARD_ICONS` 末尾追加 `'PawPrint'`、`'Wifi'`、`'SoapDispenserDroplet'`（`RewardIconName` 联合类型自动扩展） |
| `src/components/DynamicIcon.tsx` | `import { ... } from 'lucide-react'` 加这 3 个组件名；`iconMap` 同步加 3 个条目 |

追加到末尾而不是插到主题相近的位置：现有选择器网格的顺序会保持不变，diff 最小。

---

## 4. 步骤（每步可独立验证）

1. **加类型** —— `src/db/types/reward.ts`：在 `REWARD_ICONS` 的 `'Crown',` 后追加
   `'PawPrint',` `'Wifi',` `'SoapDispenserDroplet',`。
   验证：`bunx tsc --noEmit` 此时会报错（IconPicker 的 `filter`/`onSelect` 与 `DynamicIcon`
   对新值仍兼容，理论上不报；若报错说明 union 被别处穷举，需一并处理）。
2. **注册组件** —— `src/components/DynamicIcon.tsx`：import 列表（第 3-45 行之间，按现有随意顺序）
   加 `PawPrint,` `Wifi,` `SoapDispenserDroplet,`；`iconMap`（第 48-90 行）同样加三个短属性
   `PawPrint,` `Wifi,` `SoapDispenserDroplet,`。
   验证：`bunx tsc --noEmit` 与 `bun run build` 通过。
3. **回归** —— `bunx vitest` 全绿（预期无测试受影响）。
4. **人工确认（模拟器/真机）** —— Store → 新建奖励 → 点图标卡打开选择器：
   - 网格里能看到爪印 / WiFi / 洗护三个图标（不是奖杯）；
   - 搜索 `Paw`、`Wifi`、`Soap` 能各过滤出唯一一项；
   - 选中「爪印」+ 某颜色 → 保存 → 商店卡片、点开的详情弹窗显示的是爪印；
   - 兑换一次后到消费明细/报表里核对同一图标（走快照链路）。

---

## 5. 风险与未知

- **类型与注册表漂移**：`DynamicIcon` 的 `name` 是 `RewardIconName | AchievementIconName | (string & {})`，
  漏改 `iconMap` 不会编译报错，只会静默显示奖杯 —— 上面第 4 步就是为此设的人工兜底。
  本次不新增自动校验（若要加，可写一个「遍历 `REWARD_ICONS` + 成就图标名，断言 `DynamicIcon`
  渲染出的 `svg` class 不等于 Trophy」的测试，但那需要导出 `iconMap`，属额外重构，未列入本计划）。
- **图标顺序/观感**：追加在末尾，新图标出现在 28 个旧图标之后，需要滚动一下才能看到；如果希望
  它们更靠前，可改为插到 `Dumbbell`/`Tv`/`Package` 等相近位置，代价是选择器顺序整体位移。
- **`(string & {})` 逃逸口**：任何字符串都能传给 `DynamicIcon`（未知则回退 Trophy），
  本次不收紧。
- 未确定项：是否需要同时把这三个图标加进**成就图标**列表 `AchievementIconName` ——
  用户说的「奖品商店」只对应奖励，故默认不加。

---

## 6. 实施结果（2026-10-04）

- 两个文件按计划改动完成（`REWARD_ICONS` 末尾三项、`DynamicIcon` import + `iconMap` 各三项）。
- **超出原计划新增了一个测试**：`src/components/DynamicIcon.test.tsx`（用户要求用真实测试验证）。
  它遍历 `REWARD_ICONS ∪ ACHIEVEMENT_ICONS`，把 `DynamicIcon` 渲染出的 `<svg>` outerHTML 与
  `lucide-react` 同名导出的 outerHTML 逐字节比较 —— 正是原计划里「本次不新增」的漂移兜底，
  以后任何「只改白名单忘了改注册表」都会红。另含：未知名字回退 Trophy、白名单含三个新图标。
  已验证该测试真能抓到问题（临时从 `iconMap` 删掉 `PawPrint` → 2 例失败 → 还原）。
- 验证：`bunx tsc --noEmit` 通过；`bunx vitest run` 25 文件 / 331 例全绿（原 24/284，+47 例）；
  `bun run build` 通过。
- 真实 UI 验证（vite dev + bow 浏览器 agent 窗口，验完已删测试数据、已停 dev server）：
  `/rewards/new` 点「点击更换图标」→ 选择器 31 个格子（28+3），三个新图标全部渲染成
  `lucide-paw-print` / `lucide-wifi` / `lucide-soap-dispenser-droplet`（不是奖杯）；
  搜「Paw」过滤出唯一一项；选中→确定→表单图标卡变爪印；
  保存后 IndexedDB `exp-v7.rewardTemplates` 里 `icon: 'PawPrint'`、`iconColor: '#f56565'`；
  `/store` 卡片显示爪印 + 标题「宠物零食」。

---

## 7. 增补：再加「汽车 / 住房」两个图标 + 重新打包安装（2026-10-04）

### 7.1 目标

在已有 31 个预设图标后再加两个：**`Car`（汽车）**、**`House`（住房）**，
然后重新打 release APK 并用 adb 装到 `192.168.1.3:38999`。

### 7.2 现状（已核实）

- 两个图标本机已装：`node_modules/lucide-react/dist/esm/icons/{car,house}.js` 存在
  （备选：汽车 `CarFront` / `Truck`；住房 `Building2` / `KeyRound`。默认取最通用的 `Car` / `House`）。
- **已经跑完过一次 APK 构建**（在本节之前）：
  `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`，
  但那份产物的前端 dist 是在加 `Car`/`House` **之前**编译的，因此**必须重打**。
- 设备已连上（`adb connect 192.168.1.3:38999` → `device`）：vivo **V2536A / Android 16**；
  已装两个包 `com.ruinb0w.exp1`（release，versionCode 1000 / versionName 0.1.0，signature `a595b394`）
  和 `com.ruinb0w.exp1.debug`。签名 `~/.android/debug.keystore`（`app/build.gradle.kts:32`），
  与已装 release 包一致 ⇒ 可以直接 `install -r` 原地升级（**保留数据**）。

### 7.3 改动清单（与上次完全同构）

| 文件 | 改什么 |
| --- | --- |
| `src/db/types/reward.ts` | `REWARD_ICONS` 末尾再追加 `'Car'`、`'House'` |
| `src/components/DynamicIcon.tsx` | import 与 `iconMap` 各加 `Car`、`House` |

`src/components/DynamicIcon.test.tsx` **不需要改**：它遍历 `REWARD_ICONS ∪ ACHIEVEMENT_ICONS`，
新名字会自动纳入「渲染结果必须与 lucide-react 同名导出一致」的校验。

### 7.4 步骤

1. 改上述两个文件（各 +2 行 / +4 行）。
2. `bunx tsc --noEmit`、`bunx vitest run`（预期 25 文件 / 333 例，`DynamicIcon.test.tsx` 自动 +2）、
   `bun run build`。
3. `bun run build:android`（= `tauri android build --target aarch64 --apk`）—— 前台跑或后台 + 轮询
   `/tmp/android-build.log`，产物同上路径。
4. `adb -s 192.168.1.3:38999 install -r <apk>`；失败时看是不是签名不符
   （`INSTALL_FAILED_UPDATE_INCOMPATIBLE`）或 `INSTALL_FAILED_VERSION_DOWNGRADE`。
5. 真机确认：图标选择器应变成 **33 格**（28+5），能搜到 `Car` / `House` 且不是奖杯图标；
   顺便看启动到首页的时间（`-r` 升级保留数据，会跑一遍迁移链路）。

### 7.5 风险

- 重打包耗时（Rust release 编译）：上一次约 2 分钟（依赖已缓存）。
- `House` 与底部导航「首页」用的 `lucide-house` 是同一个字形（只是视觉重复，不影响功能）。
- `install -r` 不卸载、不丢数据；若真要全新安装才用 `-r -d` / 先 `uninstall`（**不需要**）。
