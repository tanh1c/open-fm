# Matchday Broadcast Modal Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the Go to the field modal into a more football-broadcast-style match card and abbreviate multi-word team names for compact display.

**Architecture:** Keep changes local to `src/components/dashboard/DashboardMatchConfirmModal.tsx`. Add a pure helper for broadcast team names and adjust the existing modal JSX/classes without changing props, confirm/cancel behavior, or match mode logic.

**Tech Stack:** React, TypeScript, Tailwind CSS app tokens, existing TeamLogo component, Vitest/TypeScript verification.

---

### Task 1: Add broadcast team-name formatter

**Files:**
- Modify: `src/components/dashboard/DashboardMatchConfirmModal.tsx`

**Step 1: Add helper**

Add a local helper near the bottom of the file:

```ts
function formatBroadcastTeamName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  return `${parts.slice(0, -1).map((part) => `${part[0]}.`).join(" ")} ${parts[parts.length - 1]}`;
}
```

**Step 2: Use helper for home/away display names**

Replace direct `homeName`/`awayName` display in team blocks with formatted names.

**Step 3: Verify typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

---

### Task 2: Improve football broadcast visual style

**Files:**
- Modify: `src/components/dashboard/DashboardMatchConfirmModal.tsx`

**Step 1: Restyle match card**

Make the fixture card more scoreboard-like:

- darker `bg-black/20` / `bg-app-bg` layered surface.
- larger logos.
- centered `VS` badge.
- clearer `HOME`/`AWAY` labels.
- balanced spacing.

**Step 2: Keep behavior intact**

Do not change:

- `onCancel`
- `onConfirm`
- `matchMode === "delegate"` warning
- `todayMatchFixture` fallback behavior
- `modeMeta` icon/label/desc usage

**Step 3: Verify dashboard checks**

Run:

```bash
npx tsc --noEmit
npx vitest run src/components/dashboard/DashboardWorkspaceContent.test.tsx src/pages/Dashboard.test.tsx
```

Expected: PASS.

**Step 4: Commit only if requested**

Do not commit unless explicitly requested.
