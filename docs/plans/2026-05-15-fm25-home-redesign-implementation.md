# FM25 Home Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Home dashboard to match the Football Manager 2025 reference: full-width topbar (Season + Reputation + Search + user), 210px sidebar with 16 nav items + pinned Next Match card, and a 3-row 4-col Home grid (Upcoming Match, Tactics formation, Squad table, League Table, Form chart, Goals donut, Transfer Activity, Training overview).

**Architecture:** Layered, replacing chrome wholesale and refactoring HomeTab grid. New chrome lives under `src/components/layout/` (extending the FM25 `AppShell` already shipped in v1). New cards go in `src/components/home/`. The 487-line `DashboardHeader` and 331-line `DashboardSidebar` are deleted; logic that lived inside (search overlay, profile navigation, save/exit confirm) ports into the new components or moves up to `Dashboard.tsx`.

**Tech Stack:** Tailwind v4, React 19, TypeScript 6, Vitest, lucide-react. SVGs for the formation pitch and donut chart inline (no chart library — keeps bundle lean and matches the FM25 aesthetic).

**Reference image:** `C:\Users\LG\.claude\image-cache\8560ec47-75c9-420b-aa5f-97a0c3195afa\1.png`

---

## Phase A — Topbar v2

Goal: build a topbar component that matches the reference (logo + 2 status pills + search + 4 right-side icons + user profile).

### Task A.1: TopbarV2 component (TDD)

**Files:**
- Create: `src/components/layout/TopbarV2.tsx`
- Create: `src/components/layout/TopbarV2.test.tsx`
- Modify: `src/components/layout/index.ts`

**Step 1: Write the failing test**

```tsx
// TopbarV2.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopbarV2 } from "./TopbarV2";

describe("TopbarV2", () => {
  const baseProps = {
    seasonLabel: "Season 2030/31",
    seasonDate: "Wed, 14 May 2030",
    reputationLabel: "Continental",
    reputationStars: 4,
    managerName: "Alex Morgan",
    managerRole: "Head Coach",
    unreadCount: 5,
    onSearch: vi.fn(),
    onInbox: vi.fn(),
    onHelp: vi.fn(),
    onNotifications: vi.fn(),
    onLogoClick: vi.fn(),
  };

  it("renders season + date + reputation", () => {
    render(<TopbarV2 {...baseProps} />);
    expect(screen.getByText("Season 2030/31")).toBeInTheDocument();
    expect(screen.getByText("Wed, 14 May 2030")).toBeInTheDocument();
    expect(screen.getByText("Continental")).toBeInTheDocument();
  });

  it("renders manager name + role", () => {
    render(<TopbarV2 {...baseProps} />);
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("Head Coach")).toBeInTheDocument();
  });

  it("invokes onSearch when typing", () => {
    const onSearch = vi.fn();
    render(<TopbarV2 {...baseProps} onSearch={onSearch} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "messi" } });
    expect(onSearch).toHaveBeenLastCalledWith("messi");
  });

  it("shows unread badge on notification icon", () => {
    render(<TopbarV2 {...baseProps} unreadCount={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("hides badge when unreadCount is 0", () => {
    render(<TopbarV2 {...baseProps} unreadCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
```

**Step 2:** `npx vitest run src/components/layout/TopbarV2.test.tsx` — expect FAIL ("Cannot find module").

**Step 3: Implement**

```tsx
// TopbarV2.tsx
import type { ReactNode } from "react";
import { Search, Bell, Mail, HelpCircle, Star } from "lucide-react";

interface TopbarV2Props {
  /** Logo node (icon + brand name). Pre-composed by caller so we don't bake the
   * brand string into a generic component. */
  logo?: ReactNode;
  seasonLabel: string;
  seasonDate: string;
  reputationLabel: string;
  /** 0-5 stars filled. */
  reputationStars: number;
  managerName: string;
  managerRole: string;
  managerAvatar?: ReactNode;
  unreadCount: number;
  onLogoClick?: () => void;
  onSearch?: (query: string) => void;
  onInbox?: () => void;
  onHelp?: () => void;
  onNotifications?: () => void;
}

export function TopbarV2({
  logo,
  seasonLabel,
  seasonDate,
  reputationLabel,
  reputationStars,
  managerName,
  managerRole,
  managerAvatar,
  unreadCount,
  onLogoClick,
  onSearch,
  onInbox,
  onHelp,
  onNotifications,
}: TopbarV2Props) {
  return (
    <header className="h-16 bg-surface-900 border-b border-surface-700/60 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)] flex items-center px-4 gap-4">
      <button
        type="button"
        onClick={onLogoClick}
        className="flex items-center gap-2 font-heading uppercase tracking-wider text-base font-bold text-white hover:text-primary-300 transition-colors"
      >
        {logo}
      </button>

      <StatusPill primary={seasonLabel} secondary={seasonDate} icon={<CalendarIcon />} />
      <StatusPill
        primary="Club Reputation"
        secondary={reputationLabel}
        icon={<ReputationIcon />}
        trailing={<StarRow filled={reputationStars} />}
      />

      <div className="flex-1 min-w-0 max-w-xl mx-auto">
        <SearchBox onChange={onSearch} />
      </div>

      <div className="flex items-center gap-1">
        <IconButton aria-label="Notifications" onClick={onNotifications} badge={unreadCount}>
          <Bell />
        </IconButton>
        <IconButton aria-label="Inbox" onClick={onInbox}>
          <Mail />
        </IconButton>
        <IconButton aria-label="Help" onClick={onHelp}>
          <HelpCircle />
        </IconButton>
      </div>

      <div className="flex items-center gap-3 pl-3 border-l border-surface-700/60">
        <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center overflow-hidden">
          {managerAvatar}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-heading uppercase tracking-wider text-white">{managerName}</span>
          <span className="text-xs text-surface-200">{managerRole}</span>
        </div>
      </div>
    </header>
  );
}

// helpers below: SearchBox, StatusPill, IconButton, StarRow, CalendarIcon, ReputationIcon
```

**Step 4:** `npx vitest run src/components/layout/TopbarV2.test.tsx` — expect 5 passing.

**Step 5:** Add `export { TopbarV2 } from "./TopbarV2";` to `src/components/layout/index.ts`.

**Step 6:** `npx tsc --noEmit` — clean.

**Step 7: Commit**

```bash
git add src/components/layout/TopbarV2.tsx src/components/layout/TopbarV2.test.tsx src/components/layout/index.ts
git commit -m "feat(layout): add TopbarV2 with FM25 status pills + search"
```

---

### Task A.2: SidebarV2 component (TDD)

**Files:**
- Create: `src/components/layout/SidebarV2.tsx`
- Create: `src/components/layout/SidebarV2.test.tsx`
- Modify: `src/components/layout/index.ts`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Home as HomeIcon, Users } from "lucide-react";
import { SidebarV2, type SidebarV2Item } from "./SidebarV2";

const items: SidebarV2Item[] = [
  { id: "dashboard", label: "Dashboard", icon: <HomeIcon /> },
  { id: "squad", label: "Squad", icon: <Users /> },
];

describe("SidebarV2", () => {
  it("renders items with labels", () => {
    render(
      <SidebarV2 items={items} activeId="dashboard" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Squad" })).toBeInTheDocument();
  });

  it("invokes onSelect with id", () => {
    const onSelect = vi.fn();
    render(<SidebarV2 items={items} activeId="dashboard" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Squad" }));
    expect(onSelect).toHaveBeenCalledWith("squad");
  });

  it("renders pinned slot when provided", () => {
    render(
      <SidebarV2
        items={items}
        activeId="dashboard"
        onSelect={vi.fn()}
        pinned={<div data-testid="next-match">Pinned</div>}
      />,
    );
    expect(screen.getByTestId("next-match")).toBeInTheDocument();
  });
});
```

**Step 2:** Verify failing.

**Step 3: Implement**

```tsx
import type { ReactNode } from "react";

export interface SidebarV2Item {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface SidebarV2Props {
  items: SidebarV2Item[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Optional pinned content rendered below the nav list (e.g. Next Match card). */
  pinned?: ReactNode;
  /** Optional footer (Quick Actions button). */
  footer?: ReactNode;
}

export function SidebarV2({ items, activeId, onSelect, pinned, footer }: SidebarV2Props) {
  return (
    <aside className="w-52 bg-surface-900 border-r border-surface-700/60 flex flex-col h-full">
      <nav className="flex-1 overflow-y-auto py-2 flex flex-col gap-0.5 px-2">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-md
                font-heading uppercase tracking-wider text-xs font-semibold
                transition-colors text-left
                [&>svg]:w-4 [&>svg]:h-4 [&>svg]:flex-shrink-0
                ${isActive
                  ? "bg-primary-500/15 text-primary-300 border-l-2 border-primary-500 -ml-px"
                  : "text-surface-200 hover:text-white hover:bg-surface-800"}
                ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
              `}
            >
              {item.icon}
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="text-[10px] font-stat bg-danger-500 text-white rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {pinned && (
        <div className="border-t border-surface-700/60 p-3 flex-shrink-0">
          {pinned}
        </div>
      )}

      {footer && (
        <div className="border-t border-surface-700/60 p-2 flex-shrink-0">
          {footer}
        </div>
      )}
    </aside>
  );
}
```

**Step 4:** Test pass.

**Step 5:** Export.

**Step 6: Commit**

```bash
git add -A src/components/layout/
git commit -m "feat(layout): add SidebarV2 with labelled items + pinned slot + footer"
```

---

## Phase B — Reusable home cards (new)

### Task B.1: FormChartCard (line chart)

**Files:**
- Create: `src/components/home/FormChartCard.tsx`
- Create: `src/components/home/FormChartCard.test.tsx`

Render a small 200×80 SVG line chart over the last N results. Each point is plotted on a 3-tier Y axis (W=top, D=mid, L=bottom). Points connected by a polyline. Form letter badge at each datapoint.

API:
```tsx
interface FormChartCardProps {
  results: Array<"W" | "D" | "L">; // most recent last
  totals: { won: number; drawn: number; lost: number };
  pointsPerGame: number;
  className?: string;
}
```

TDD: 3 tests — renders SVG with N points, renders W/D/L summary, renders PPG.

Commit: `feat(home): TeamFormCard with inline SVG line chart`

---

### Task B.2: GoalsAnalysisCard (donut)

**Files:**
- Create: `src/components/home/GoalsAnalysisCard.tsx`
- Create: `src/components/home/GoalsAnalysisCard.test.tsx`

Donut chart inline SVG (no library). Center: total goals + "Total Goals" label. Slices: Open Play / Set Pieces / Counter Attacks / Penalties, each colored from `--color-primary-*` palette + `--color-accent-*`. Legend on the right with dot + count + percentage.

API:
```tsx
interface GoalSegment { kind: "open_play" | "set_piece" | "counter" | "penalty"; count: number; }
interface GoalsAnalysisCardProps {
  segments: GoalSegment[];
  className?: string;
}
```

TDD: 3 tests — renders total, renders all segments with i18n labels, renders percentages.

Commit: `feat(home): GoalsAnalysisCard with inline donut SVG`

---

### Task B.3: SquadOverviewTable (FM-style)

**Files:**
- Create: `src/components/home/SquadOverviewTable.tsx`
- Create: `src/components/home/SquadOverviewTable.test.tsx`

Table with columns: POS pill | # number | PLAYER NAME | AGE | NAT (flag) | CON (ring) | MOR (ring) | APPS | GLS | AST | AV-RAT (color-graded). Uses `font-stat` on every numeric column. Header tab strip ("Overview / Stats / Contract / Fitness") at top.

API:
```tsx
interface SquadOverviewTableProps {
  players: Array<{
    id: string;
    position: string;
    number?: number;
    matchName: string;
    age: number;
    nationality: string;
    condition: number; // 0-100
    morale: number;    // 0-100
    appearances: number;
    goals: number;
    assists: number;
    avgRating: number;
  }>;
  activeTab: "overview" | "stats" | "contract" | "fitness";
  onTabChange: (tab: "overview" | "stats" | "contract" | "fitness") => void;
  onPlayerClick?: (id: string) => void;
}
```

TDD: 4 tests — renders rows, applies rating-cell-* class via ratingClass(), tab switch fires onTabChange, position pill renders.

Commit: `feat(home): SquadOverviewTable FM-style with color-graded ratings`

---

### Task B.4: TacticsFormationCard (pitch SVG + jerseys)

**Files:**
- Create: `src/components/home/TacticsFormationCard.tsx`
- Create: `src/components/home/TacticsFormationCard.test.tsx`

Largest new component. Pitch as SVG (green gradient, halfway line, center circle, penalty boxes). 11 player jersey badges positioned per formation. Right side: 4 instruction blocks (Team Instructions / In Possession / In Transition / Out of Possession), each with a tactical phrase pill.

API:
```tsx
interface PlayerSlot {
  id: string;
  name: string;
  number: number;
  role: string; // e.g. "PF - At"
  x: number; // 0-100 percent of pitch width
  y: number; // 0-100 percent of pitch height
}
interface TacticsFormationCardProps {
  formation: string; // "4-2-3-1 WIDE"
  tacticalStyle: string; // "Balanced"
  players: PlayerSlot[];
  instructions: {
    teamInstructions: string[]; // ["Play Out Of Defense", "Work Ball Into Box", "Higher Tempo"]
    inPossession: string;       // "Fairly Wide"
    inTransition: string;       // "Counter"
    outOfPossession: string;    // "Mid Block"
  };
}
```

Layout default position helper: given formation string, return 11 (x, y) coords.

TDD: 4 tests — pitch SVG renders, all jerseys render with names, instructions render, formation string renders.

Commit: `feat(home): TacticsFormationCard with pitch SVG + jersey slots`

---

## Phase C — Refactor HomeTab grid

### Task C.1: New HomeTab grid

**Files:**
- Modify: `src/components/home/HomeTab.tsx`

Replace existing nested grids with FM25 3-row layout:
- Row 1 (3 cols): UpcomingMatchCard | TacticsFormationCard (col-span-2) | LeagueTableCard (row-span-2)
- Row 2 (3 cols): SquadStatusCard | SquadOverviewTable (col-span-2)
- Row 3 (4 cols): FormChartCard | GoalsAnalysisCard | TransferActivityCard | TrainingOverviewCard

Onboarding/Job Opportunities/Board Objectives stay above this main grid in their own section (or behind a "More" disclosure). Don't lose them.

Use Tailwind: `grid grid-cols-12 gap-5` — col widths via `col-span-3`, `col-span-6`, `col-span-3`. Responsive: stack to 1 col below md breakpoint.

Mods to existing cards:
- HomeNextOpponentCard → unify look with new UpcomingMatchCard styling (or wrap)
- HomeLeaguePositionCard → use as content, but bump tighter for 3-row card
- HomeRecentResultsCard → repurpose into FormChartCard

Test: snapshot via `render(<HomeTab>{...}</HomeTab>)` and assert presence of each card heading.

Commit: `refactor(home): FM25 3-row 4-col grid`

---

## Phase D — Replace Dashboard chrome

### Task D.1: Wire TopbarV2 + SidebarV2 into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Delete: `src/components/dashboard/DashboardHeader.tsx`
- Delete: `src/components/dashboard/DashboardSidebar.tsx`
- Modify: `src/components/dashboard/DashboardOverlays.tsx` (port any remaining overlay logic)

Replace `<DashboardHeader>` with `<TopbarV2>`. Replace `<DashboardSidebar>` with `<SidebarV2>`. Re-implement search/profile-navigation/save/exit logic in `Dashboard.tsx` directly (since DashboardHeader had inlined them). Wire game state → topbar props (manager name + role + reputation stars + season label).

Pinned slot: `<NextMatchPinnedCard fixture={...} />` (small new component). Footer: existing Quick Actions button.

Verify:
1. `npx tsc --noEmit` — must be clean.
2. `npx vitest run src/pages/Dashboard.test.tsx` — adjust assertions that referenced old chrome class names; behavioral assertions (tab switch fires invoke, save flash shows) should still pass.

Commit: `refactor(dashboard): replace chrome with TopbarV2 + SidebarV2`

---

## Phase E — Final verification

### Task E.1: Full suite + build + manual smoke

```bash
npm test            # all green
npm run build       # clean
npm run dev         # smoke
```

Open Dashboard → verify topbar shows season + reputation + search + manager. Sidebar shows 16 items + Next Match + Quick Actions. Home tab shows 3 rows. Click around — every tab should still render its content.

Commit any small tweaks. Tag: `git tag fm25-home-v2`.

---

## Out of scope

- Mobile responsive ≤768px (the FM25 reference is desktop-only too).
- Accessible keyboard navigation for the formation pitch (focus management on jerseys).
- Animation/transitions beyond what existing primitives ship.
- Search overlay v2 (stay with existing implementation; only the topbar entry point changes).

## Risks

- **Test churn**: many existing Home/Dashboard tests assert on class names or text from cards being moved. Allow ~30 min for behavioral test rewrites per phase.
- **Logic drift**: `DashboardHeader` had inlined search overlay + alert overlay. Port carefully — verify all 4 overlay states still render and their close handlers fire.
- **Pinned Next Match**: requires a compact card variant we don't have today — design from the reference (~80px tall, badge + countdown + temperature).

## Plan complete

Saved to `docs/plans/2026-05-15-fm25-home-redesign-implementation.md`.
