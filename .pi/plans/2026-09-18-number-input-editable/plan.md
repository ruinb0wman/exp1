# NumberInput：聚焦时可清空全部内容，失焦兜底 0 / min

日期：2026-09-18
范围：`src/components/NumberInput.tsx`（重写输入层）、`src/libs/numberInput.ts`（新增纯逻辑 + 单测）、`src/pages/EditTask.tsx`（3 处内联 `type="number"` 迁移到 `NumberInput`）

---

## 1. 目标

1. 聚焦时可以把内容**删到空**再重新输入，而不是卡在最后一位删不掉。
2. 失焦时如果内容为空：**兜底为 0；若 `min` 存在且 `0 < min`，则兜底为 `min`**（其余情况按既有 min/max 夹取）。

隐含前提（你的选择已确认）：输入框改为 `type="text" + inputMode="numeric|decimal"`，由组件内部文本态驱动显示；EditTask 的 3 处内联数字输入框统一迁到 `NumberInput`，以后只维护 `NumberInput` 一处。

---

## 2. 现状（已读代码）

`src/components/NumberInput.tsx:75-88`：

```ts
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (disabled) return;
  const inputValue = e.target.value;
  // 允许空值，但不做处理
  if (inputValue === "") return;          // ← 清空不进入 state
  const num = allowDecimal ? parseFloat(inputValue) : parseInt(inputValue, 10);
  if (isNaN(num)) return;
  const clampedValue = Math.max(min, Math.min(max, num));
  onChange(allowDecimal ? roundTo(clampedValue, DECIMAL_PLACES) : clampedValue);
};
```

输入框是 `value={value}`（number 直驱）。从 `10` 删最后一位 → `"1"` → `Math.max(min, 1)` → 回写 state → 显示又变回 `1`；再删 → `""` 直接 return，state 不变，React 下次渲染又写回旧值 → **最后一位永远删不掉**。

EditTask 里还有 3 处手写的同样结构（`type="number"` + 自定义 `+/-` 按钮），且各自重复了不同的夹取逻辑：

- `EditTask.tsx:667-679` `completeExpireDays`（min 0，输入框 `w-14`，`parseInt || 0`）
- `EditTask.tsx:718-730` `repeatInterval`（min 1，输入框 `w-10`，`parseInt || 1`）
- `EditTask.tsx:806-816` `endValue`（times 模式，min 1，输入框 `w-12`，**`onChange` 完全不夹取**，能存下 `""`/`0`/负数）

已确认的周边事实：全仓库无 `<form>`（没有原生校验依赖）；`src/index.css` 里没有针对 `input[type=number]` 的样式；`Store/lib.ts:40` 的 `getMaxQuantity` 保证 `max ≥ 1`；`NumberInput` 现有 4 个页面 15 个调用点。

---

## 3. 改法

### 3.1 新增 `src/libs/numberInput.ts`（纯逻辑，可单测）

把「字符过滤 / 文本→数字 / 夹取 / 失焦兜底」抽成纯函数，组件只做编排，规则可以脱离 React 测。

```ts
/** 小数模式下保留的位数 */
export const DECIMAL_PLACES = 2;

export function roundTo(value: number, places = DECIMAL_PLACES): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** 数字 → 输入框文本；非有限值（NaN/Infinity）回退空串 */
export function valueToText(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

/** 该文本是否可接受（拒绝非法字符；含 "-"、"1." 这类中间态） */
export function isTextAllowed(text: string, allowDecimal: boolean, allowNegative: boolean): boolean {
  if (text === "") return true;
  const pattern = allowDecimal
    ? allowNegative ? /^-\d*\.?\d*$/ : /^\d*\.?\d*$/
    : allowNegative ? /^-\d*$/ : /^\d*$/;
  return pattern.test(text);
}

/** 文本 → 数字；"" / "-" / "." / "-." 这类中间态返回 null（此时不写回父组件） */
export function textToNumber(text: string, allowDecimal: boolean): number | null {
  if (text === "" || text === "-" || text === "." || text === "-.") return null;
  const num = allowDecimal ? parseFloat(text) : parseInt(text, 10);
  return Number.isFinite(num) ? num : null;
}

/** 夹到 [min, max]，小数模式再按 2 位归整（与原实现同序：先夹后 round 的等价写法） */
export function applyBounds(value: number, min: number, max: number, allowDecimal: boolean): number {
  const clamped = Math.min(max, Math.max(min, value));
  return allowDecimal ? roundTo(clamped, DECIMAL_PLACES) : clamped;
}

/** 失焦兜底：能解析就用解析值，空/中间态用 0 —— 而 clamp(0, min, max) 天然等于「0 < min 时取 min」 */
export function resolveBlurValue(text: string, min: number, max: number, allowDecimal: boolean): number {
  const parsed = textToNumber(text, allowDecimal);
  return applyBounds(parsed ?? 0, min, max, allowDecimal);
}
```

> 兜底规则正好是 `applyBounds(0, min, max, …)`：`min = 0` 得 0，`min = 1` 得 1，`min = 5` 得 5，不会出现 `min > max` 时的越界反直觉（此时按旧实现的「max 优先」结果一致）。

### 3.2 重写 `src/components/NumberInput.tsx` 的输入层

props 接口、`sizeConfig`、`+/-` 的 class 全部保持不变，只替换状态与 input 元素：

```tsx
export function NumberInput({ value, onChange, min = 0, max = Infinity, step = 1, ... }: NumberInputProps) {
  const config = sizeConfig[size];
  const [text, setText] = useState(() => valueToText(value));
  const isFocusedRef = useRef(false);

  // 外部 value 变化时同步文本；聚焦中不同步，避免打断正在进行的输入
  useEffect(() => {
    if (!isFocusedRef.current) setText(valueToText(value));
  }, [value]);

  const commit = (next: number) => onChange(applyBounds(next, min, max, allowDecimal));

  const handleDecrease = () => { if (!disabled) commit(value - step); };
  const handleIncrease = () => { if (!disabled) commit(value + step); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    // 小数键盘在部分区域设置下输出逗号，先归一为点
    const raw = allowDecimal ? e.target.value.replace(",", ".") : e.target.value;
    if (!isTextAllowed(raw, allowDecimal, min < 0)) return;  // 非法字符：忽略本次输入，保留上一次文本
    setText(raw);
    const num = textToNumber(raw, allowDecimal);
    if (num !== null) commit(num);   // 中间态（"" / "-" / "."）只改文本，不写回父组件 ← 关键
  };

  const handleFocus = () => { isFocusedRef.current = true; };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const next = resolveBlurValue(text, min, max, allowDecimal);
    setText(valueToText(next));
    commit(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.currentTarget.blur(); return; }   // 移动端「完成」键兜底提交
    if (e.key === "ArrowUp") { e.preventDefault(); handleIncrease(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); handleDecrease(); }
  };

  const isMinReached = value <= min;
  const isMaxReached = value >= max;

  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      {/* label / 减号按钮 不变 */}
      <input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`${config.input} ${inputWidth || ""} p-0 text-center bg-transparent focus:outline-none focus:ring-0 border-none text-text-primary font-medium disabled:opacity-50`}
      />
      {/* 加号按钮 / suffix 不变 */}
    </div>
  );
}
```

要点：

- `type` 从 `number` 改 `text`，同时**去掉** `min` / `max` / `step` 属性与 `[appearance:textfield] [&::-webkit-inner-spin-button]…` 这些只在 number 类型下有效的 class（属性在 text 上无效；仓库无 form，无原生校验依赖）。`step` 仍由 `+/-` 按钮使用。
- 键盘类型靠 `inputMode`：整数 `numeric`、小数 `decimal`，Android 数码键盘照旧。顺带补回 number 类型原本自带的 `↑/↓` 步进（text 类型不再有）与 Enter 提交。
- 组件内部 `roundTo` / `DECIMAL_PLACES` 移到 `@/libs/numberInput.ts`，导入即可。
- 显示与提交的时序：键入合法值 → 立刻 `commit`（父组件实时更新，如商品总价、积分预览）；键入中间态 → 只更新本地文本；失焦 → 归一化并提交。因此「清空后失焦写入 0/min」只在真正离开焦点时发生。

### 3.3 `src/pages/EditTask.tsx` 迁移 3 处内联输入框

只把「按钮 + input」那一层 `<div className="flex items-center gap-2">…</div>` 换成 `<NumberInput>`，外层 `flex items-center gap-4 pt-4 border-t …` 与两侧 `<p>` 文案保持原样（外层 gap-4 + 组件内 gap-2 = 现在的间距，`size="md"` 的按钮 `h-7 w-7` 与输入框 `h-7 text-base` 与现状一致）：

| 位置 | 现在 | 换成 |
| --- | --- | --- |
| `:667-679` Expire after | `min={0}` + `Math.max(0, parseInt \|\| 0)` | `<NumberInput value={completeExpireDays} onChange={setCompleteExpireDays} min={0} size="md" inputWidth="w-14" />` |
| `:718-730` Every | `min={1}` + `Math.max(1, parseInt \|\| 1)` | `<NumberInput value={repeatInterval} onChange={setRepeatInterval} min={1} size="md" inputWidth="w-10" />` |
| `:806-816` After N times | `min={1}`，**无夹取**，state 是 string | `<NumberInput value={parseInt(endValue, 10) \|\| 1} onChange={(v) => setEndValue(String(v))} min={1} size="md" inputWidth="w-12" />` |

`inputWidth` 用来保留原宽度（组件默认 `md` 是 `w-12`）。`endValue` 在 date 模式下是 `YYYY-MM-DD`，times 模式下才是数字，所以用 `parseInt` / `String` 做一次边界转换，state 类型（string）不动，`EditTask.tsx:232` 的存档逻辑也就无需改动。

### 3.4 新增 `src/libs/numberInput.test.ts`

按仓库现有 `src/libs/*.test.ts` 风格（纯函数、无新依赖）至少覆盖：

```
resolveBlurValue("",  0, Infinity, false) === 0      // 空 + min=0
resolveBlurValue("",  1, Infinity, false) === 1      // 空 + 0<min
resolveBlurValue("",  5, Infinity, false) === 5
resolveBlurValue("",  0, 10, false)       === 0
resolveBlurValue("2", 1, Infinity, false) === 2      // 正常值不被兜底覆盖
resolveBlurValue("1.999", 0, Infinity, true) === 2   // 夹取 + 2 位归整
isTextAllowed("12a", false, false) === false         // 非法字符
isTextAllowed("1.2.3", true, false) === false
isTextAllowed(".", true, false) === true             // 中间态放行
isTextAllowed("-", false, false) === false           // min ≥ 0 时负号不放行
textToNumber("", false) === null                     // 中间态不写回
textToNumber("1.", true) === 1
valueToText(Infinity) === ""
applyBounds(99, 0, 10, false) === 10
```

---

## 4. 执行顺序与验证

1. 新增 `src/libs/numberInput.ts` → `bunx vitest run src/libs/numberInput.test.ts`（此时组件还没改，互不影响）。
2. 重写 `src/components/NumberInput.tsx` → `bunx tsc --noEmit`；`bun run dev` 在浏览器里过一遍 15 个调用点。
3. 迁移 `EditTask.tsx` 3 处 → `grep -rn 'type="number"' src` 应为空；`bunx tsc --noEmit`。
4. `bunx vitest` 全量回归（现有测试应全绿）。
5. Android 手工核对（`bun run dev:android`）：
   - `EditReward` Point Cost（step 10）：聚焦 → 全删 → 输入 250 → 失焦 = 250。
   - `EditReward` Money cost（`allowDecimal`）：能输入 `1.5`；输入 `1.` 失焦 = 1；只输入 `.` 失焦 = 0。
   - min = 0 字段（EditTask completionPoints / 阶段积分等）：清空后失焦 = 0。
   - min = 1 字段（Every / Restock amount / Max stock / Store 数量 / 成就奖励积分 / 阶段阈值）：清空后失焦 = 1。
   - 清空后直接点 `+`：先兜底再步进（0→1 或 1→2）。
   - 清空后点别处、按回车、切 tab 都能触发兜底。
   - EditTask 三处（Expire after / Every / After N times）的间距、宽度、字号与新图标目视一致。
   - 小数键盘：`allowDecimal` 字段弹出的数码键盘带小数点。

---

## 5. 风险 / 未知

- **视觉变化**：新迁移的 3 处按钮从字符 `-`/`+` 变成 lucide 图标（`Minus`/`Plus`，`w-4 h-4`），并且到达 `min` 时减号会置灰（`disabled:opacity-30`，旧实现是「可点但无效果」）。需目视确认可接受。
- **行为变化**：EditTask 的 `endValue`（times 模式）从此受 `min=1` 约束，不能再输入 0/负数或留空 —— 这是修 bug，但若曾有模板存了 `0`，编辑时会显示为 `1`（`parseInt(...) || 1`）。
- **刻意保留的不一致**：输入过程中仍实时夹取（如 `max=10` 时键入 `15`，父组件值已是 10，而输入框显示 `15`），失焦后归一为 10。若你希望「输入期间完全不夹取」，需要额外一轮确认（会影响 Store 总价、积分预览的实时性）。
- **聚焦期间外部改 `value` 不回写文本**（例如父组件在别处更新了同一个值）：会以用户当前输入为准，在失焦时提交覆盖。当前 15 个调用点里没有这种写法，暂不加 `lastEmitted` 之类的判定。
- **未知**：Android WebView 的 IME「完成」键是否一定发出 Enter `keydown` 不保证；兜底是「失焦即提交」，不依赖它，因此无功能风险。
- 本次不动：`Slider.tsx` 的 range 输入、EditTask 中非数字的输入框。

---

## 6. 实施结果（2026-09-18）

改动文件：

- 新增 `src/libs/numberInput.ts`（纯逻辑）+ `src/libs/numberInput.test.ts`（15 例，全绿）
- 新增 `src/components/NumberInput.test.tsx`（10 例，jsdom + react-dom/client 真实挂载，全绿）—— 不用 `@testing-library/react`：用 `createRoot` + `act`（React 19 自带）+ 原生 value setter 派发 `input`，`focusin`/`focusout` 手动派发（jsdom 与无焦点文档都不产生这两个事件）
- 重写 `src/components/NumberInput.tsx` 输入层（props 接口、sizeConfig、按钮样式不变）
- `src/pages/EditTask.tsx` 三处内联 `type="number"` 迁移为 `<NumberInput>`（`Expire after` / `Every` / `After N times`），全仓库 `type="number"` 已归零

验证：

- `bunx vitest run` → 19 文件 / 228 用例全绿
- `bun run build`（tsc + vite build）通过
- 真浏览器（用户已在跑的 dev server，`http://localhost:1420`，Chromium）实测：
  - min=0 字段：聚焦全删 → 保持空 → 失焦变 `0`；重新输入 `250` 正常
  - min=1 字段（Reward `Every` / `Restock amount`）：聚焦全删 → 保持空 → 失焦变 `1`；`0` 不写回、失焦归一
  - `allowDecimal` 字段：`1.` 中途态被保留（这一条用 `type="number"` 会直接被打断），继续输入 `1.5` 正常；只输入 `.` 失焦 → `0`；`3.2a` 非法字符被忽略
  - 迁移后的 `Expire after` 实测宽度 56px（`w-14`），`完成获得积分` 48px（`w-12`），Tailwind 规则顺序 `.w-14` 晚于 `.w-12`，`inputWidth` 生效、布局与迁移前一致
  - min 处减号按钮确实 `disabled`（新行为）

