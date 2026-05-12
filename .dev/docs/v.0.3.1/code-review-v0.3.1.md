# Anvilite v0.3.1 Code Review Report

> Reviewed: 2026-04-17
> Reviewer: Claude Code Review Agent
> Scope: Full codebase (`electron/`, `src/stores/`, `src/engines/`, `src/components/`, `src/utils/`, `src/hooks/`)

---

## Overall Verdict: CONDITIONAL PASS

Architecture is clean (Zustand stores + engine pure functions + React components).
4 high-severity issues must be fixed before the next release; 9 medium issues should be addressed in this cycle.

---

## Issue List

### CRIT-01 Electron IPC listener leak on multi-window
- **Severity**: Critical
- **File**: `electron/main.ts` L39-44
- **Description**: `ipcMain.on('window-minimize/maximize/close')` is registered inside `createWindow()`. On macOS the `activate` event (L66-68) can call `createWindow()` again, stacking duplicate listeners and causing memory leaks.
- **Fix**: Move IPC registration outside `createWindow()`, or guard with `ipcMain.removeAllListeners()` before re-registering.

### CRIT-02 `save-file` IPC handler lacks content-size validation
- **Severity**: High
- **File**: `electron/main.ts` L47-57
- **Description**: Renderer can send arbitrarily large strings to be written to disk via `fs.writeFileSync`. No size cap or extension whitelist.
- **Fix**: Add size limit (e.g. 100 MB), validate that `filePath` extension is `.json`.

### CRIT-03 Cross-store task-completion flow is non-atomic
- **Severity**: High
- **Files**: `src/components/tasks/TaskItem.tsx` L96-112, `src/stores/habitStore.ts` L238-274
- **Description**: Task completion touches `taskStore` -> `characterStore` -> `growthEventStore` in sequence. An exception mid-way leaves data inconsistent (XP added but event missing, etc.).
- **Fix**: Wrap the entire flow in try-catch with rollback, or merge into a single transactional action.

### CRIT-04 BadgeChecker runs on every task/habit array mutation
- **Severity**: High
- **File**: `src/components/feedback/FeedbackContext.tsx` L195-229
- **Description**: `useEffect` depends on `tasks` and `habits` array references. Every Zustand update creates a new array reference, triggering a full `checkNewBadges()` recalculation across all tasks, habits, and areas.
- **Fix**: Debounce the check (500 ms), or derive stable summary values and depend on those instead.

### MED-05 `useMemo` used for side-effects in TaskList
- **Severity**: Medium
- **File**: `src/components/tasks/TaskList.tsx` L79-84
- **Description**: `useMemo` calls `setLocalDoing`/`setLocalTodo` (state setters) — a side-effect inside a pure memo.
- **Fix**: Replace with `useEffect`.

### MED-06 GrowthEvent array grows unbounded
- **Severity**: Medium
- **File**: `src/stores/growthEventStore.ts`
- **Description**: Events are prepended forever per spec ("no auto-cleanup"). Over months this will degrade perf and storage.
- **Fix**: Add virtual scrolling for timeline, and warn user via storage monitor when events exceed a threshold.

### MED-07 `handleComplete` useCallback has incomplete deps
- **Severity**: Medium
- **File**: `src/components/tasks/TaskItem.tsx` L69-131
- **Description**: Dependency array misses `t`, context values. Stale closures possible after language switch.
- **Fix**: Add missing deps or use `useRef` for latest values.

### MED-08 `StaleTimerWatcher` useEffect missing deps
- **Severity**: Medium
- **File**: `src/App.tsx` L91-102
- **Description**: Empty `[]` deps but uses `showToast` and `t` from hooks.
- **Fix**: Add `showToast` and `t` to deps array.

### MED-09 `importData` lacks schema validation
- **Severity**: Medium
- **File**: `src/utils/dataExport.ts` L76-122
- **Description**: Only checks top-level keys exist; does not validate value types. Malformed JSON could crash the app or inject bad data.
- **Fix**: Validate that each key's value is an object with expected sub-keys; sanitize string fields.

### MED-10 Infinite loop risk in character XP recalculation
- **Severity**: Medium
- **File**: `src/stores/characterStore.ts` L179-184
- **Description**: `while (true)` with no upper-bound guard. If `totalXP` is NaN or extremely large, loop never breaks.
- **Fix**: Add `lvl > 500` safety break.

### MED-11 Recursive subtask helpers have no depth guard
- **Severity**: Medium
- **File**: `src/utils/subTaskUtils.ts`
- **Description**: `addNestedSubTask` etc. recurse without depth limit. Data corruption could cause stack overflow.
- **Fix**: Pass `depth` parameter and refuse nesting beyond 3.

### MED-12 `FeedbackProvider.triggerFeedback` setTimeout leak
- **Severity**: Medium
- **File**: `src/components/feedback/FeedbackContext.tsx` L70-95
- **Description**: Multiple `setTimeout` calls inside `triggerFeedback` are never cleaned up on unmount.
- **Fix**: Store timer IDs in a `useRef` set and clear on cleanup.

### MED-13 Module-level mutable counter `let _id = 0`
- **Severity**: Medium
- **File**: `src/components/feedback/FeedbackContext.tsx` L58
- **Description**: Module-scoped mutable state. StrictMode double-render causes ID skips; breaks with SSR/multi-instance.
- **Fix**: Replace with `useRef` counter inside the provider.

### LOW-14 TaskList.tsx is 1800+ lines
- **Severity**: Low
- **File**: `src/components/tasks/TaskList.tsx`
- **Description**: Contains 10+ components in one file. Hard to navigate and test.
- **Fix**: Extract `HabitsTab`, `CompletedSection`, `HabitRow`, etc. into separate files.

### LOW-15 Toast setTimeout not cleaned on unmount
- **Severity**: Low
- **File**: `src/components/feedback/Toast.tsx` L29-31
- **Description**: Same pattern as MED-12 — timer not cleaned if provider unmounts.
- **Fix**: Track timer IDs and clear on cleanup.

### LOW-16 Unused `PauseIcon` component
- **Severity**: Low
- **File**: `src/components/tasks/TaskItem.tsx` L663-669
- **Description**: Defined but never referenced.
- **Fix**: Remove dead code.

### LOW-17 Account deletion UUID regex fragile
- **Severity**: Low
- **File**: `src/stores/accountManager.ts` L90
- **Description**: `/^[a-f0-9]{8}-/` assumes UUID always starts with 8 hex chars. Format changes would break cleanup.
- **Fix**: Store account ID list for precise key matching.

### LOW-18 Mixed className + inline style patterns
- **Severity**: Low
- **Files**: Multiple components
- **Description**: Same component uses both `className="flex"` and `style={{ display: 'flex' }}`. Inconsistent.
- **Fix**: Standardize: Tailwind for layout, inline style for theme variables only.

### LOW-19 `getStoragePrefix()` evaluated at module load
- **Severity**: Low
- **Files**: All store files
- **Description**: Storage key prefix is fixed at import time. Account switch requires full page reload.
- **Fix**: Already handled by `switchAccount()` calling `reload()`. Add comment documenting this coupling.

### LOW-20 `getTodayHabits()` excludes completed_today
- **Severity**: Low
- **File**: `src/stores/habitStore.ts` L460-464
- **Description**: Filters only `status === 'active'`, so completed habits vanish from today's dashboard list.
- **Fix**: Confirm product intent; if they should show, add `|| h.status === 'completed_today'`.

---

## Summary Table

| Severity | Count |
|----------|-------|
| Critical / High | 4 |
| Medium | 9 |
| Low | 7 |
| **Total** | **20** |

## Recommended Fix Order

1. CRIT-01, CRIT-02, CRIT-03, CRIT-04
2. MED-05, MED-07, MED-08, MED-10, MED-11
3. MED-09, MED-12, MED-13
4. LOW-14 through LOW-20
