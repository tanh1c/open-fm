# Matchday Confirm Modal Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the matchday confirmation popup shown by `Go to the field` into a broadcast-style matchday modal while preserving the existing confirm/cancel flow.

**Architecture:** Keep behavior in `DashboardMatchConfirmModal.tsx` unchanged and only restyle its presentation. Use `TeamLogo` for home/away teams when `todayMatchFixture` exists, widen `DashboardModalFrame` through its existing `maxWidthClassName` prop, and keep delegate warning logic intact.

**Tech Stack:** React, TypeScript, Tailwind CSS app tokens, existing dashboard modal frame, existing team logo component.

---

### Task 1: Redesign the matchday confirm modal

**Files:**
- Modify: `src/components/dashboard/DashboardMatchConfirmModal.tsx`
- Test: existing dashboard tests if available, otherwise typecheck.

**Step 1: Inspect current component**

Confirm the component receives:

```ts
matchMode: MatchModeType;
modeMeta: DashboardMatchModeMeta;
onCancel: () => void;
onConfirm: () => void;
teams: TeamData[];
todayMatchFixture: FixtureData | null;
```

Do not change these props.

**Step 2: Add TeamLogo import**

Add:

```ts
import TeamLogo from "../common/TeamLogo";
```

**Step 3: Derive home/away teams and names**

Inside the component, after `const { t } = useTranslation();`, add:

```ts
const homeTeam = todayMatchFixture
  ? teams.find((team) => team.id === todayMatchFixture.home_team_id)
  : null;
const awayTeam = todayMatchFixture
  ? teams.find((team) => team.id === todayMatchFixture.away_team_id)
  : null;
const homeName = todayMatchFixture ? getTeamName(teams, todayMatchFixture.home_team_id) : "";
const awayName = todayMatchFixture ? getTeamName(teams, todayMatchFixture.away_team_id) : "";
```

**Step 4: Replace modal body with broadcast-style layout**

Use `DashboardModalFrame maxWidthClassName="max-w-2xl"`.

Structure:

- Header badge `MATCHDAY` and mode icon.
- Match card if `todayMatchFixture` exists:
  - home team block with logo/name/HOME.
  - center fixture label + VS.
  - away team block with logo/name/AWAY.
- Description and delegate warning.
- Cancel and confirm buttons using app styling.

**Step 5: Verify**

Run:

```bash
npx tsc --noEmit
```

Then run focused dashboard tests if available:

```bash
npx vitest run src/components/dashboard/DashboardWorkspaceContent.test.tsx src/pages/Dashboard.test.tsx
```

Expected: PASS.

**Step 6: Commit only if requested**

Do not commit unless explicitly requested.
