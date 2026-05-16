# Template Home + Chrome Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the `FE_template/untitled` dashboard chrome and Home-page visual style into the existing app while preserving game logic.

**Architecture:** Restyle existing components instead of copying template components wholesale. `Dashboard.tsx` keeps save/continue/search/profile-navigation logic, while `TopbarV2`, `SidebarV2`, shared `Card`, and Home cards adopt the template's teal-on-charcoal visual language and layout. `HomeTab.tsx` keeps its current `gameState` adapters and reorganizes presentation into the template's main-column + right-sidebar structure.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS v4 `@theme`, Vitest/testing-library, lucide-react. No new charting dependencies; existing inline SVG cards remain.

---

## Constraints

- Do not modify Rust/WASM/game-engine logic.
- Do not add mock template data to production UI.
- Do not install `recharts`, `motion`, or other template-only dependencies.
- Keep existing dashboard flows: continue, save, match mode, search, inbox, settings, exit, profile navigation, unemployed state.
- Stage/commit only files touched by this UI port; there are unrelated engine/template files in the working tree.

## Reference Files

- Template shell: `FE_template/untitled/src/App.tsx`
- Template chrome: `FE_template/untitled/src/components/Header.tsx`, `FE_template/untitled/src/components/Sidebar.tsx`
- Template card primitive: `FE_template/untitled/src/components/Card.tsx`
- Template dashboard layout: `FE_template/untitled/src/components/Dashboard.tsx`
- Template widgets: `FE_template/untitled/src/components/widgets/*.tsx`
- Current theme: `src/App.css`
- Current card primitive: `src/components/ui/Card.tsx`
- Current chrome: `src/components/layout/TopbarV2.tsx`, `src/components/layout/SidebarV2.tsx`, `src/pages/Dashboard.tsx`
- Current Home: `src/components/home/HomeTab.tsx`, `src/components/home/HomeTab.cards.ts`, existing Home cards

---

### Task 1: Add template palette aliases to theme tokens

**Files:**
- Modify: `src/App.css:491-544`

**Step 1: Write a failing token smoke test**

There is no CSS unit test harness. Use TypeScript build as the guard after implementation. Before editing, inspect the current token block:

```bash
grep -n "--color-surface-900\|--color-primary-500\|--color-accent-500" src/App.css
```

Expected: current surface/primary/accent tokens exist and no `--color-app-*` aliases yet.

**Step 2: Implement the template aliases**

In the existing `@theme` block in `src/App.css`, add template aliases without removing current tokens:

```css
  /* Template dashboard aliases (FE_template/untitled) */
  --color-app-bg: #11161d;
  --color-app-card: #181f29;
  --color-app-border: #232d3b;
  --color-app-green: #2dd4bf;
  --color-app-red: #f87171;
  --color-app-text: #f1f5f9;
  --color-app-text-muted: #94a3b8;
```

Also update base `body` dark background to use `--color-app-bg` for dark mode while keeping light mode intact:

```css
@layer base {
  body {
    @apply bg-surface-50 text-surface-900 antialiased dark:text-app-text transition-colors duration-300;
    background-color: var(--color-surface-50);
  }

  .dark body {
    background-color: var(--color-app-bg);
  }
}
```

Do not remove the existing `surface-*`, `primary-*`, or `accent-*` tokens; other parts of the app still use them.

**Step 3: Verify**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/App.css
git commit -m "style(theme): add template dashboard palette aliases"
```

---

### Task 2: Restyle shared Card primitive to template card visuals

**Files:**
- Modify: `src/components/ui/Card.tsx:13-66`
- Test: existing component tests using cards, especially Home tests

**Step 1: Write/adjust a focused test if needed**

If `src/components/ui/Card.test.tsx` does not exist, create it with minimal class assertions:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardBody } from "./Card";

describe("Card", () => {
  it("uses template card surface classes", () => {
    render(<Card><span>Card content</span></Card>);
    expect(screen.getByText("Card content").parentElement).toHaveClass("bg-app-card", "rounded-xl", "border-app-border");
  });

  it("renders compact uppercase header", () => {
    render(<CardHeader>League Table</CardHeader>);
    expect(screen.getByRole("heading", { name: "League Table" })).toHaveClass("text-[11px]", "tracking-widest", "uppercase");
  });

  it("keeps body padding slot", () => {
    render(<CardBody>Body</CardBody>);
    expect(screen.getByText("Body")).toHaveClass("p-5");
  });
});
```

Run:

```bash
npx vitest run src/components/ui/Card.test.tsx
```

Expected: FAIL before restyle.

**Step 2: Implement card restyle**

Change `Card` classes from white/surface rounded-md to template style:

```tsx
className={`
  bg-app-card
  border border-app-border
  rounded-xl
  overflow-hidden
  transition-colors duration-200
  ${accentBorder}
  ${className}
`}
```

Adjust `accentBorder` to preserve optional accents without forcing `surface-*` borders:

```tsx
const accentBorder =
  accent === "none"
    ? ""
    : {
        primary: "border-l-2 border-l-app-green",
        accent: "border-l-2 border-l-app-green",
        success: "border-l-2 border-l-success-500",
        danger: "border-l-2 border-l-app-red",
      }[accent];
```

Change `CardHeader` classes to match template:

```tsx
<div className={`px-5 py-4 border-b border-app-border/50 flex items-center justify-between ${className}`}>
  <h3 className="text-[11px] font-bold text-app-text-muted tracking-widest uppercase">
```

Keep `CardBody` default `p-5`.

**Step 3: Verify focused tests**

Run:

```bash
npx vitest run src/components/ui/Card.test.tsx src/components/home
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Card.test.tsx
git commit -m "style(ui): restyle Card with template surface treatment"
```

---

### Task 3: Restyle TopbarV2 to template Header

**Files:**
- Modify: `src/components/layout/TopbarV2.tsx:45-204`
- Test: create or update `src/components/layout/TopbarV2.test.tsx`

**Step 1: Write failing tests**

Create/update tests to assert template chrome classes and interactions:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TopbarV2 } from "./TopbarV2";

describe("TopbarV2", () => {
  const baseProps = {
    seasonLabel: "Season 2030/31",
    seasonDate: "Wed, 14 May 2030",
    reputationLabel: "Continental",
    reputationStars: 4,
    managerName: "Alex Morgan",
    managerRole: "Head Coach",
    unreadCount: 3,
  };

  it("renders template header surface", () => {
    const { container } = render(<TopbarV2 {...baseProps} />);
    expect(container.firstElementChild).toHaveClass("h-20", "border-app-border", "bg-app-bg");
  });

  it("calls search callback", () => {
    const onSearch = vi.fn();
    render(<TopbarV2 {...baseProps} onSearch={onSearch} />);
    fireEvent.change(screen.getByPlaceholderText(/search players/i), { target: { value: "silva" } });
    expect(onSearch).toHaveBeenCalledWith("silva");
  });

  it("shows unread badge on notifications", () => {
    render(<TopbarV2 {...baseProps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
```

Run:

```bash
npx vitest run src/components/layout/TopbarV2.test.tsx
```

Expected: FAIL on class expectations before restyle if existing tests do not already cover this.

**Step 2: Implement template header classes**

Update `TopbarV2`:

- Header root: `h-20 border-b border-app-border bg-app-bg flex items-center justify-between px-6 shrink-0`.
- Left pill group: `flex items-center gap-4`.
- `StatusPill`: `flex items-center gap-3 bg-app-card border border-app-border rounded-xl px-4 py-2`.
- Status primary/secondary typography should match template: primary/label muted small, secondary app text semibold.
- Search box: width `w-80`, `bg-app-card border border-app-border rounded-lg`, teal focus `focus-within:border-app-green/50`.
- Icon buttons: muted text, app-card hover, app-red badge.
- Manager chip: rounded hover app-card, avatar fallback unchanged.

Do not change prop names.

**Step 3: Verify**

Run:

```bash
npx vitest run src/components/layout/TopbarV2.test.tsx src/pages/Dashboard.test.tsx
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/layout/TopbarV2.tsx src/components/layout/TopbarV2.test.tsx
git commit -m "style(layout): match TopbarV2 to template header"
```

---

### Task 4: Restyle SidebarV2 and wire pinned next-match/footer slots

**Files:**
- Modify: `src/components/layout/SidebarV2.tsx:32-80`
- Modify: `src/pages/Dashboard.tsx:418-467`
- Test: `src/components/layout/SidebarV2.test.tsx`, `src/pages/Dashboard.test.tsx`

**Step 1: Write failing SidebarV2 class tests**

Update `SidebarV2.test.tsx`:

```tsx
it("uses template sidebar shell classes", () => {
  const { container } = render(<SidebarV2 items={items} activeId="dashboard" onSelect={vi.fn()} />);
  expect(container.firstElementChild).toHaveClass("w-64", "bg-[#151b23]", "border-app-border");
});

it("marks active item with teal template state", () => {
  render(<SidebarV2 items={items} activeId="dashboard" onSelect={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Dashboard" })).toHaveClass("bg-app-green/10", "text-app-green");
});
```

Run:

```bash
npx vitest run src/components/layout/SidebarV2.test.tsx
```

Expected: FAIL before restyle.

**Step 2: Restyle SidebarV2**

Update root shell:

```tsx
<aside className="w-64 bg-[#151b23] flex flex-col h-full border-r border-app-border shrink-0">
```

Update nav:

```tsx
<nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 scrollbar-thin">
```

Update button classes to match template:

- Base: `flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group`.
- Active: `bg-app-green/10 text-app-green`.
- Inactive: `text-app-text-muted hover:text-app-text hover:bg-white/5`.
- Icon: `w-5 h-5` via `[&>svg]`.
- Active dot: render small `w-1.5 h-1.5 rounded-full bg-app-green` when active and no badge.
- Badge: app-red/app-green based on value is not necessary; use app-red for Inbox badge.

Keep existing `pinned` and `footer` slots, but style section like template (`p-4 shrink-0 px-5`, border top app-border).

**Step 3: Wire slots in Dashboard**

In `src/pages/Dashboard.tsx`, pass:

```tsx
pinned={
  myTeamName ? (
    <div className="...">template-like Next Match compact preview using todayMatchFixture or next fixture helper if already available</div>
  ) : undefined
}
footer={
  <div className="flex flex-col gap-1">
    <button type="button" onClick={handleNavigateSettings}>...</button>
    <button type="button" onClick={() => !isExitingToMenu && setShowExitConfirm(true)}>...</button>
  </div>
}
```

Use existing `handleNavigateSettings`, `setShowExitConfirm`, and `isExitingToMenu`. Do not remove `DashboardOverlays` exit logic.

If there is no safe next fixture helper in `Dashboard.tsx`, make the pinned card title-only with team name and a button-style `Quick Actions`; do not introduce new data fetching.

**Step 4: Verify**

Run:

```bash
npx vitest run src/components/layout/SidebarV2.test.tsx src/pages/Dashboard.test.tsx
npx tsc --noEmit
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/layout/SidebarV2.tsx src/components/layout/SidebarV2.test.tsx src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx
git commit -m "style(layout): match SidebarV2 to template navigation"
```

---

### Task 5: Update Dashboard shell sizing to template App shell

**Files:**
- Modify: `src/pages/Dashboard.tsx:418-538`
- Test: `src/pages/Dashboard.test.tsx`

**Step 1: Add shell class assertion**

In `Dashboard.test.tsx`, add an assertion in the existing render test that the shell has template classes. If current mocks make this hard, add `data-testid="dashboard-shell"` to the root div and test it:

```tsx
expect(screen.getByTestId("dashboard-shell")).toHaveClass("h-screen", "w-full", "overflow-hidden", "bg-app-bg");
```

Run:

```bash
npx vitest run src/pages/Dashboard.test.tsx
```

Expected: FAIL before shell update.

**Step 2: Implement shell classes**

Change Dashboard root from `min-h-screen ...` to:

```tsx
<div data-testid="dashboard-shell" className="flex h-screen w-full overflow-hidden text-app-text selection:bg-app-green selection:text-app-bg bg-app-bg">
```

Since `TopbarV2` is currently above the sidebar/content split, restructure to match template:

```tsx
<div data-testid="dashboard-shell" className="flex h-screen w-full overflow-hidden text-app-text selection:bg-app-green selection:text-app-bg bg-app-bg">
  <SidebarV2 ... />
  <div className="flex flex-col flex-1 min-w-0">
    <TopbarV2 ... />
    <DashboardOverlays ... />
    <FiredModal />
    <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <DashboardHeader ... />
      <DashboardWorkspaceContent ... />
    </main>
  </div>
</div>
```

Keep `DashboardHeader` for action bar; it should sit below TopbarV2.

**Step 3: Verify**

Run:

```bash
npx vitest run src/pages/Dashboard.test.tsx
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Dashboard.test.tsx
git commit -m "style(dashboard): adopt template shell layout"
```

---

### Task 6: Refactor HomeTab layout to main column + 320px right sidebar

**Files:**
- Modify: `src/components/home/HomeTab.tsx:217-409`
- Test: `src/components/home/HomeTab.test.tsx`

**Step 1: Add layout test**

In `HomeTab.test.tsx`, add or update a test to render a team state and assert:

```tsx
expect(screen.getByTestId("home-template-layout")).toHaveClass("xl:flex-row", "gap-4");
expect(screen.getByTestId("home-right-sidebar")).toHaveClass("xl:w-[320px]", "shrink-0");
```

Run:

```bash
npx vitest run src/components/home/HomeTab.test.tsx
```

Expected: FAIL before layout refactor.

**Step 2: Implement layout structure**

Inside `HomeTab`, change root wrapper from max-width centered stack to template style:

```tsx
<div data-testid="home-template-layout" className="flex flex-col xl:flex-row gap-4 min-h-full">
  <div className="flex-1 flex flex-col gap-4 min-w-0">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="col-span-1 min-h-[360px]">Upcoming/next match card</div>
      <div className="col-span-1 lg:col-span-2 min-h-[360px]">TacticsFormationCard</div>
    </div>
    <div className="min-h-[280px]">SquadOverviewTable</div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">FormChartCard, GoalsAnalysisCard, transfer/messages/news card</div>
    Preserve onboarding, board objectives, unavailable players, momentum, recent messages below as needed.
  </div>
  <div data-testid="home-right-sidebar" className="w-full xl:w-[320px] shrink-0 flex flex-col gap-4">
    League position/table card, squad status card, recent results/upcoming fixtures, training overview.
  </div>
</div>
```

Use current cards and data:

- Main top left: existing `Card` with `NextMatchDisplay` or `HomeNextOpponentCard` if it better matches template.
- Main top right: `TacticsFormationCard`.
- Middle: `SquadOverviewTable`.
- Bottom: `FormChartCard`, `GoalsAnalysisCard`, and a current data-backed card (prefer `HomeLatestNewsCard` or `HomeRecentMessagesCard`; do not invent transfer data if unavailable).
- Right sidebar: `HomeLeaguePositionCard`, `HomeSquadOverviewCard`, `HomeRecentResultsCard`, `HomeLeagueDigestCard` or training summary.

Keep unemployed branch (`JobOpportunitiesCard`) intact.

**Step 3: Verify Home tests**

Run:

```bash
npx vitest run src/components/home/HomeTab.test.tsx src/components/home
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/home/HomeTab.tsx src/components/home/HomeTab.test.tsx
git commit -m "style(home): adopt template dashboard layout"
```

---

### Task 7: Restyle TacticsFormationCard to template horizontal pitch

**Files:**
- Modify: `src/components/home/TacticsFormationCard.tsx:40-198`
- Test: `src/components/home/TacticsFormationCard.test.tsx`

**Step 1: Add template style tests**

Update tests to assert:

```tsx
expect(screen.getByLabelText("Football pitch")).toHaveClass("w-full", "h-full");
expect(container.querySelector("[data-jersey]")).toHaveClass("absolute");
expect(container.textContent).toContain("Team Instructions");
```

If class expectations already pass, add a test for horizontal pitch container using `data-testid="tactics-pitch-shell"`.

Run:

```bash
npx vitest run src/components/home/TacticsFormationCard.test.tsx
```

Expected: FAIL if new `data-testid` is not present.

**Step 2: Implement visual restyle**

- Card root remains shared `Card`.
- Inner layout: `flex-1 flex flex-col sm:flex-row min-h-0`.
- Pitch shell: `w-full max-w-[400px] sm:aspect-[4/3] min-h-[300px] bg-[#1a2e25] border-2 border-emerald-900/50 rounded-xl relative overflow-hidden flex shadow-inner` with `data-testid="tactics-pitch-shell"`.
- Player nodes: smaller circular teal/amber number marker plus `bg-app-bg/80 border border-app-border backdrop-blur-sm rounded` nameplate, matching template.
- Keep `PlayerSlot` props and `(x,y)` percentage positioning. If current pitch is vertical, transpose in CSS only if needed to match template orientation; do not change adapter data semantics without updating tests.
- Instructions column: `w-full sm:w-48 shrink-0 sm:border-l border-app-border/50 p-4 flex flex-col gap-4`.

**Step 3: Verify**

Run:

```bash
npx vitest run src/components/home/TacticsFormationCard.test.tsx src/components/home/HomeTab.test.tsx
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/home/TacticsFormationCard.tsx src/components/home/TacticsFormationCard.test.tsx
git commit -m "style(home): match tactics card to template pitch"
```

---

### Task 8: Restyle SquadOverviewTable to template dense table

**Files:**
- Modify: `src/components/home/SquadOverviewTable.tsx:56-145`
- Test: `src/components/home/SquadOverviewTable.test.tsx`

**Step 1: Add style test**

Assert the table uses template sizing/classes:

```tsx
expect(container.querySelector("table")).toHaveClass("text-[11px]", "whitespace-nowrap");
expect(screen.getByText("Overview")).toHaveClass("text-app-green");
```

Run:

```bash
npx vitest run src/components/home/SquadOverviewTable.test.tsx
```

Expected: FAIL before style update.

**Step 2: Implement table restyle**

- Header/tabs wrapper: `px-5 pt-4 flex items-center gap-6 border-b border-app-border/50`.
- Active tab class should be teal underline (`text-app-green border-b-2 border-app-green pb-3 -mb-[2px]`). If the shared `Tabs` component cannot produce this exact look, add a local compact tab row in `SquadOverviewTable` only.
- Table wrapper: `flex-1 p-0 overflow-x-auto min-h-0 min-w-0`.
- Table: `w-full text-left text-[11px] whitespace-nowrap min-w-[600px]`.
- Rows: `border-b border-app-border/20 hover:bg-white/5`.
- Position pills: GK green, defender blue, default muted.
- Condition/morale rings keep inline SVG but use app-green/app-border colors.
- Avg rating cell: `bg-app-bg px-2 py-1 rounded text-app-text font-medium border border-app-border/50` plus existing rating class if useful.

**Step 3: Verify**

Run:

```bash
npx vitest run src/components/home/SquadOverviewTable.test.tsx src/components/home/HomeTab.test.tsx
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/home/SquadOverviewTable.tsx src/components/home/SquadOverviewTable.test.tsx
git commit -m "style(home): match squad overview table to template"
```

---

### Task 9: Restyle FormChartCard and GoalsAnalysisCard to template widgets

**Files:**
- Modify: `src/components/home/FormChartCard.tsx:46-109`
- Modify: `src/components/home/GoalsAnalysisCard.tsx`
- Test: `src/components/home/FormChartCard.test.tsx`, `src/components/home/GoalsAnalysisCard.test.tsx`

**Step 1: Add visual contract tests**

For `FormChartCard`, assert the SVG exists and the footer label `PPG` remains.

For `GoalsAnalysisCard`, assert:

```tsx
expect(container.querySelectorAll("path[data-segment]")).toHaveLength(segments.length);
expect(screen.getByText(/total goals/i)).toBeInTheDocument();
```

Run:

```bash
npx vitest run src/components/home/FormChartCard.test.tsx src/components/home/GoalsAnalysisCard.test.tsx
```

Expected: PASS for behavior, then style updates should keep them green.

**Step 2: Implement visual restyle**

Form chart:

- Use template `p-4 flex-1 flex flex-col justify-between min-h-0`.
- Use app-border grid lines.
- Use `stroke="#2dd4bf"` for line and app-card-filled circles.
- Summary rows: Won teal, Drawn gray/muted, Lost app-red.
- Footer: `border-t border-app-border/50`, label `text-app-text-muted`, PPG bold.

Goals analysis:

- Keep inline SVG donut, no `recharts`.
- Size to template: `w-28 h-28`, center total and `Total Goals` label.
- Legend text `[10px]`, muted labels, values app text.
- Footer button style if existing card supports action; otherwise omit.

**Step 3: Verify**

Run:

```bash
npx vitest run src/components/home/FormChartCard.test.tsx src/components/home/GoalsAnalysisCard.test.tsx src/components/home/HomeTab.test.tsx
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/home/FormChartCard.tsx src/components/home/FormChartCard.test.tsx src/components/home/GoalsAnalysisCard.tsx src/components/home/GoalsAnalysisCard.test.tsx
git commit -m "style(home): match form and goals widgets to template"
```

---

### Task 10: Restyle right-sidebar Home cards to template widgets

**Files:**
- Modify: `src/components/home/HomeLeaguePositionCard.tsx`
- Modify: `src/components/home/HomeSquadOverviewCard.tsx`
- Modify: `src/components/home/HomeRecentResultsCard.tsx`
- Modify: `src/components/home/HomeLeagueDigestCard.tsx` if used in right sidebar
- Tests: corresponding `*.test.tsx`

**Step 1: Run existing focused tests first**

```bash
npx vitest run src/components/home/HomeLeaguePositionCard.test.tsx src/components/home/HomeSquadOverviewCard.test.tsx src/components/home/HomeRecentResultsCard.test.tsx src/components/home/HomeLeagueDigestCard.test.tsx
```

Expected: PASS before restyle.

**Step 2: Implement visual restyle only**

- League card: compact table styling like template `LeagueTableWidget` when standings are available; preserve existing preseason/unemployed behavior.
- Squad status: use template `StatusRow` feel and compact morale/condition ring, but keep current props (`avgCondition`, `avgOvr`, `exhaustedCount`, training schedule/focus).
- Recent results/upcoming fixtures: use compact rows with team shield icon, muted text, app-green positive states.
- League digest/news: use compact sidebar card style if included in sidebar.

Do not change card public props unless tests force it.

**Step 3: Verify**

```bash
npx vitest run src/components/home/HomeLeaguePositionCard.test.tsx src/components/home/HomeSquadOverviewCard.test.tsx src/components/home/HomeRecentResultsCard.test.tsx src/components/home/HomeLeagueDigestCard.test.tsx src/components/home/HomeTab.test.tsx
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/home/HomeLeaguePositionCard.tsx src/components/home/HomeSquadOverviewCard.tsx src/components/home/HomeRecentResultsCard.tsx src/components/home/HomeLeagueDigestCard.tsx
git commit -m "style(home): match right sidebar cards to template"
```

---

### Task 11: Final verification and browser smoke test

**Files:**
- No required source edits unless verification fails.

**Step 1: Full tests**

Run:

```bash
npx tsc --noEmit
npx vitest run
npm run build
```

Expected: all PASS.

**Step 2: Browser smoke test**

Start dev server:

```bash
npm run dev
```

Open the app and verify:

- Dashboard shell uses charcoal background and teal accent.
- Sidebar is 256px with template-like nav, pinned area, footer actions.
- Topbar is 80px and shows season/reputation/search/manager information.
- Home page layout is main column + right sidebar at desktop width.
- Home cards render live game data, not template mock data.
- Sidebar navigation still changes tabs.
- Header search/profile navigation still works.
- Continue/save/match-mode action bar still works.
- Unemployed manager state still shows job opportunities and does not show club-only nav.

**Step 3: Commit fixes if needed**

If verification required fixes:

```bash
git add <specific changed files>
git commit -m "fix(home): polish template chrome integration"
```

**Step 4: Final status**

Run:

```bash
git status --short
git log --oneline -8
```

Report changed UI files and verification results. Do not report unrelated engine/template files as part of this UI port.
