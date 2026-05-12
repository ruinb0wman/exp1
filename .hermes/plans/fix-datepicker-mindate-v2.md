# Plan: Fix DatePicker Past-Date Selection in EditTask.tsx (v2)

## Problem Summary
用户报告：在编辑/创建任务的页面中，无法选择前一天的日期（以及任何过去日期）。

## 根因分析 (Root Cause Analysis)

### 根因 1（主要）：`minDate={new Date()}` 硬编码限制

`src/pages/EditTask.tsx` 中两处 DatePicker 都设置了 `minDate={new Date()}`：

| 位置 | 行号 | 用途 | 当前 minDate |
|------|------|------|-------------|
| Schedule > Start from | 651 | 任务开始日期 | `new Date()` |
| Repeat > Ends > On Date | 789 | 重复结束日期 | `new Date()` |

**禁用链路追踪：**

```
EditTask.tsx (line 651/789)
  → minDate={new Date()}
    → DatePicker.tsx (line 154): minDate={minDate} 透传给 Calendar
      → Calendar.tsx (line 230): isDateDisabled(date, minDate, maxDate)
        → Calendar.tsx (line 96-107): isDateDisabled()

function isDateDisabled(date, minDate, maxDate):
  - 将 date 和 minDate 都归一化到当天 00:00:00（去除时间部分）
  - 如果 date < minDate → 返回 true（禁用）
  - 昨天 00:00:00 < 今天 00:00:00 → 昨天被禁用

禁用后的行为：
  - Calendar.tsx line 272: handleDateClick 中 if (isDisabled) return （忽略点击）
  - Calendar.tsx line 432: <button disabled={isDisabled}> （视觉上置灰）
  - DefaultCell: cursor-not-allowed 样式
```

**结论**：`minDate={new Date()}` 是导致无法选择前一天（及任何过去日期）的**唯一直接原因**。Calendar 和 DatePicker 组件本身没有对过去日期做额外限制。

### 根因 2（次要）：缺乏开始/结束日期的差异化业务逻辑

两个 DatePicker 使用完全相同的 `minDate={new Date()}`，未考虑它们在业务上的不同语义：

- **开始日期**：代表任务调度的起始时间。是否应该允许过去日期存在争议——有正反两方面的使用场景。
- **结束日期**：代表重复调度的终止日期。应该受限于「结束日期 >= 开始日期」，而非「结束日期 >= 今天」。当前实现阻止了用户选择任何过去日期作为结束日期，这在编辑已有任务时尤为不便。

### 根因 3（潜在但非阻塞）：Calendar.tsx 中 `today` 被 memoized 且永不更新

```typescript
// Calendar.tsx line 165-168
const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}, []);  // 空依赖 → 组件挂载后永不更新
```

如果用户打开 DatePicker 后跨过午夜，日历中"今天"的高亮仍会停留在旧日期。这不影响选择逻辑，但会在边界情况下造成困惑。**此问题不在本次修复范围内。**

### 时区分析

所有日期比较都使用本地时区，且 `isDateDisabled` 将日期归一化到当天 00:00:00 进行比较，不存在时区偏移导致的误判。`new Date()` 在浏览器中始终返回本地时间，与 `Calendar` 中的 `new Date(year, month-1, day)` 使用的是同一时区。**无时区问题。**

---

## 业务逻辑评估：是否需要区分开始/结束日期？

### 开始日期 (Start Date)

| 场景 | 是否应允许过去日期 |
|------|-------------------|
| 新建任务，计划从明天开始 | 不需要 |
| 新建任务，补录昨天已经开始的任务 | **需要** |
| 编辑已有任务，其开始日期已在过去 | **需要**（修改其他属性时应保留原有日期） |
| 用户错选了日期，想改回更早的日期 | **需要** |

**推荐方案**：移除开始日期的 `minDate` 限制，允许用户自由选择任意日期。如果产品需要限制，可以在验证层面施加约束（如提交时提示），但不应该在日历 UI 层面阻止选择。

### 结束日期 (End Date / Ends On Date)

| 约束需求 | 说明 |
|---------|------|
| 结束日期 >= 开始日期 | 合理：重复任务不应该在开始之前结束 |
| 结束日期 >= 今天 | **不合理**：用户可以设置一个在过去结束的重复任务（如"1月1日到1月15日的每日任务"） |

**推荐方案**：
- 如果 Schedule 已启用且设置了 `startAt`，将 `minDate` 设为 `startAt` 对应的 Date 对象
- 如果 Schedule 未启用，不设 `minDate`（允许任意日期）
- 这样确保「结束日期 >= 开始日期」而不强制「结束日期 >= 今天」

---

## 修复方案

### 修改 1：开始日期 DatePicker — 移除 minDate

**文件**: `src/pages/EditTask.tsx`
**位置**: 第 651 行

**当前代码**:
```tsx
                  placeholder="Today (default)"
                  minDate={new Date()}
                />
```

**修改为**:
```tsx
                  placeholder="Today (default)"
                />
```

### 修改 2：结束日期 DatePicker — 使用 startAt 作为 minDate

**文件**: `src/pages/EditTask.tsx`
**位置**: 第 789 行

**当前代码**:
```tsx
                      placeholder="Select end date"
                      minDate={new Date()}
                    />
```

**修改为**: 根据 Schedule 是否启用及 startAt 是否已设来动态计算 minDate：

```tsx
                      placeholder="Select end date"
                      minDate={
                        isScheduleEnabled && startAt
                          ? (() => {
                              const [y, m, d] = startAt.split('-').map(Number);
                              return new Date(y, m - 1, d);
                            })()
                          : undefined
                      }
                    />
```

**逻辑说明**:
- 如果 Schedule 已启用 **且** 用户设置了开始日期 → 结束日期最小为开始日期
- 如果 Schedule 未启用 → 不设限制，允许任意日期
- `undefined` 传给 Calendar 后，`isDateDisabled` 跳过 minDate 检查

### 不需修改的文件

- `src/components/DatePicker.tsx` — 已正确处理 `minDate` 为 `undefined` 的情况（透传即可）
- `src/components/Calendar.tsx` — 已正确处理 `minDate` 为 `undefined` 的情况（`isDateDisabled` 中跳过检查）

---

## 验证方案

### 类型检查
```bash
cd ~/Workspace/exp1 && npx tsc --noEmit
```
- `DatePickerProps.minDate` 类型为 `Date | undefined`（可选属性）
- `CalendarProps.minDate` 类型为 `Date | undefined`（可选属性）
- 移除或设为 `undefined` 不会产生类型错误

### 功能验证清单

| # | 测试场景 | 预期结果 |
|---|---------|---------|
| 1 | 新建任务，选择昨天的开始日期 | ✅ 可选择昨天 |
| 2 | 新建任务，选择一年前的开始日期 | ✅ 可选择任意过去日期 |
| 3 | 新建任务，设置开始日期为 5月1日，结束日期尝试选 4月30日 | ✅ 4月30日被禁用（因为 < 5月1日） |
| 4 | 新建任务，设置开始日期为 5月1日，结束日期选 5月1日 | ✅ 5月1日可选（>= 开始日期） |
| 5 | 新建任务，未启用 Schedule，设置结束日期为过去 | ✅ 可选择任意日期 |
| 6 | 编辑已有任务（开始日期在 3月），修改结束日期为 2月 | ✅ 日历层面允许选择，但违反业务逻辑（结束 < 开始）；可选方案：提交时增加校验 |
| 7 | 选择未来日期 | ✅ 正常（行为不变） |

### 边界情况

- **startAt 格式异常**: 如果 `startAt` 字符串格式不正确（非 `YYYY-MM-DD`），IIFE 中的 `split('-')` 会返回 NaN → `new Date(NaN, NaN, NaN)` 返回 Invalid Date → Calendar 的 `isDateDisabled` 比较 `d < min` 时，如果 min 是 Invalid Date，`min.getFullYear()` 等返回 NaN → 比较结果不确定。**建议增加 try-catch 保护或使用之前已有的 `formatToDateStr`/`formatToUTCISO` 模式处理。**

  为安全起见，结束日期的 minDate 计算可改为：

  ```tsx
  minDate={
    isScheduleEnabled && startAt
      ? (() => {
          try {
            const [y, m, d] = startAt.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            return isNaN(date.getTime()) ? undefined : date;
          } catch {
            return undefined;
          }
        })()
      : undefined
  }
  ```

---

## 额外建议（非必须，可在后续迭代中考虑）

1. **添加提交前校验**：在 `handleSubmit` 中检查如果同时设置了开始和结束日期，则结束日期必须 >= 开始日期。当前代码没有此校验。

2. **Calendar 组件的 today 更新**：将 `useMemo([], [])` 改为每天更新，或在组件挂载时使用 `useRef` 存储当天日期并设置一个到午夜的 timer。优先级低。

3. **开始日期是否仍需限制**：如果产品要求开始日期不能在过去太远（如 90 天前），可以在提交时校验或设置一个宽松的 minDate（如 `new Date(new Date().setFullYear(new Date().getFullYear() - 1))`）。

---

## 风险评估

- **风险等级**: 低
- **影响范围**: 仅 `EditTask.tsx` 中两处 DatePicker 的 minDate prop
- **回滚方案**: 还原 `minDate={new Date()}` 即可
- **不涉及**: 数据模型、数据库、API、其他页面
