# Plan: Remove minDate restriction from DatePickers in EditTask.tsx

## Problem
Two `DatePicker` components in `src/pages/EditTask.tsx` have `minDate={new Date()}` set, which prevents users from selecting any date before today (the current date). This is overly restrictive — users should be able to schedule tasks with past start dates or end dates (e.g., for backdated tasks, historical tracking, or editing existing scheduled tasks).

## Affected Code

### Location 1 — "Start from" DatePicker (Schedule section)
- **File:** `src/pages/EditTask.tsx`
- **Line:** 651
- **Code:** `minDate={new Date()}`
- **Context:**
```tsx
                  placeholder="Today (default)"
                  minDate={new Date()}       // <-- REMOVE THIS LINE
                />
```

### Location 2 — "End Date" DatePicker (Repeat/End Condition section)
- **File:** `src/pages/EditTask.tsx`
- **Line:** 789
- **Code:** `minDate={new Date()}`
- **Context:**
```tsx
                      placeholder="Select end date"
                      minDate={new Date()}   // <-- REMOVE THIS LINE
                    />
```

## Changes

Two targeted edits:

1. **Remove `minDate={new Date()}` from the "Start from" DatePicker (line 651)**  
   Delete the line `minDate={new Date()}` and the trailing newline so the closing `/>` moves up.

2. **Remove `minDate={new Date()}` from the "End Date" DatePicker (line 789)**  
   Delete the line `minDate={new Date()}` and the trailing newline so the closing `/>` moves up.

After changes, the components will look like:

```tsx
// Location 1 (Start from)
                  placeholder="Today (default)"
                />

// Location 2 (End Date)
                      placeholder="Select end date"
                    />
```

## Rationale
- `minDate` is an **optional** prop on `DatePicker`. Removing it means no lower bound is enforced, allowing selection of any past, present, or future date.
- The `DatePicker.tsx` component itself is **not** modified — only the call site in `EditTask.tsx`.
- The `DatePicker` component already handles null/undefined `minDate` gracefully (no restriction applied).

## Verification
- Run `npx tsc --noEmit` from the project root (`~/Workspace/aict1`) to confirm no TypeScript errors.
- The `minDate` prop is typed as `Date | undefined` (optional), so removing it will not cause any type errors.

## Risk Assessment
- **Low risk.** The change only removes a constraint; it does not alter any logic, state management, or data flow.
- If business logic later requires a minDate, it can be added back or made configurable (e.g., via a prop or feature flag).
