# Match Hybrid Dashboard Redesign Implementation Plan

> **For Claude:** Implement task-by-task in this session without subagents unless the user explicitly changes that instruction.

**Goal:** Rework `/match` into a docs-aligned dashboard page with a persistent header/back actions and a hybrid broadcast match surface inside the shared Football Manager-style shell.

**Architecture:** Keep match routing, engine calls, stage transitions, team talks, substitutions, and finish behavior unchanged. Replace the current full-screen/broadcast-only treatment with a reusable match dashboard shell: top page header, fixed-height workspace, left context rail, center broadcast surface, right action rail. Apply the shell consistently across prematch, live, halftime, and postmatch stages.

**Tech Stack:** React, TypeScript, Tailwind CSS app tokens, existing match components, existing TeamLogo component, existing tests.

---

### Task 1: Build a docs-aligned match page shell

**Files:**
- Modify: `src/components/match/MatchScreenLayout.tsx`
- Modify: `src/pages/MatchSimulation.tsx`

**Steps:**
1. Extend `MatchScreenLayout` so it can render a dashboard-style page header above its current match header/content area.
2. Add optional props for:
   - `pageTitle`
   - `pageSubtitle`
   - `pageActions`
3. Style the page shell according to `docs/dashboard-page-design.md`:
   - outer content: `mx-auto flex min-h-max max-w-[1700px] flex-col gap-4 px-4 py-4 sm:px-6`
   - page title: `text-xl font-bold tracking-tight text-app-text`
   - subtitle: `text-sm text-app-text-muted`
   - actions: wrapping row on the right.
4. Add a real back/dashboard action at the `/match` orchestration level:
   - Use `useNavigate` in `MatchSimulation.tsx` to provide a dashboard/back action through child props or a shared callback.
   - Do not interrupt match engine state; this is a UI navigation action only.
5. Keep loading state app-styled.

**Expected result:** Every match stage can show a docs-style header with actions like Back/Dashboard and status chips.

---

### Task 2: Rework PreMatch into hybrid dashboard workspace

**Files:**
- Modify: `src/components/match/PreMatchSetup.tsx`

**Steps:**
1. Use `MatchScreenLayout` with:
   - `pageTitle="MATCHDAY"`
   - subtitle based on fixture label and stage.
   - page actions: `Back`, `Dashboard`, `Start Match`.
2. Build fixed-height workspace: `h-[800px] xl:h-[750px]`.
3. Use 3-zone layout:
   - left rail `xl:w-[280px]`: fixture info, teams, formation/play style snapshot.
   - center `flex-1 min-w-0 h-full`: broadcast matchup card with logos, VS, and lineup/pitch tab.
   - right rail `xl:w-[360px]`: formation, play style, set pieces, auto select.
4. Keep current tab behavior (`lineup`/`setpieces`) and all command handlers.
5. Preserve `onStart`, `onUpdateSnapshot`, swaps, auto-select, and set-piece calls unchanged.

**Expected result:** Prematch looks like a dashboard page with a broadcast match card in the center rather than a standalone modal-like screen.

---

### Task 3: Rework Live Match into hybrid dashboard workspace

**Files:**
- Modify: `src/components/match/MatchLive.tsx`

**Steps:**
1. Use the docs-aligned page header:
   - title `MATCH LIVE`
   - subtitle phase/minute/fixture context.
   - actions: Back/Dashboard, speed/status chips.
2. Build fixed-height 3-zone workspace:
   - left rail `xl:w-[280px]`: live status, possession, key stats summary, recent key events.
   - center `flex-1 min-w-0 h-full`: broadcast scoreboard at top, then EventFeed/Stats/Lineups tabs in a scrollable card.
   - right rail `xl:w-[360px]`: sim speed, team controls, substitutions, tactical controls.
3. Keep all simulation timing and `step_live_match` logic unchanged.
4. Ensure panels scroll internally with `custom-scrollbar`, not full-page overflow.

**Expected result:** Live match has the same dashboard shape as Tournaments/Scouting while retaining a strong football broadcast center.

---

### Task 4: Rework HalfTime and PostMatch shells

**Files:**
- Modify: `src/components/match/HalfTimeBreak.tsx`
- Modify: `src/components/match/PostMatchScreen.tsx`

**Steps:**
1. Replace full-page standalone headers with the same page header/dashboard workspace pattern.
2. HalfTime layout:
   - left rail: first-half events and score summary.
   - center: team talk panel and halftime scoreboard.
   - right rail: tactical changes and substitutions.
3. PostMatch layout:
   - left rail: match events, quick stats, round summary.
   - center: final score broadcast card and post-match team talk.
   - right rail: player ratings, scorers, substitutions.
4. Keep `onResume`, `onPressConference`, `onFinish`, team talk, detail modal, and substitution logic unchanged.
5. Footer actions should be represented as page header/right-rail actions where possible; if footer remains, style it as app-card and keep it inside the dashboard shell.

**Expected result:** All non-live stages feel like the same `/match` page, not separate unrelated screens.

---

### Task 5: Verify and review

**Files:**
- Test existing focused coverage.

**Steps:**
1. Run:
   ```bash
   npx tsc --noEmit
   ```
2. Run:
   ```bash
   npx vitest run src/pages/MatchSimulation.test.tsx src/components/dashboard/DashboardWorkspaceContent.test.tsx src/pages/Dashboard.test.tsx
   ```
3. If the dev server can start, manually inspect `/match` after entering matchday:
   - Header exists with Back/Dashboard actions.
   - Page uses `max-w-[1700px]`, fixed-height workspace, and app-card rails.
   - Center still has a broadcast scoreboard/match surface.
   - Controls still work.

**Commit behavior:** Do not commit this new redesign unless the user explicitly requests it after review.
