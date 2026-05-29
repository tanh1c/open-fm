# Tournaments Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `http://localhost:1420/tournaments` into the shared dashboard style while preserving all tournament tabs, competition selection, context menus, awards loading, and navigation behavior.

**Architecture:** Keep the redesign local to `src/components/tournaments/TournamentsTab.tsx`. Replace legacy `Card`/gray styling with local dashboard primitives (`TemplateCard`, `SectionTitle`, `StatRow`, `HeaderChip`) and split repeated JSX into small local helper components. Preserve existing derived data and event handlers, only changing presentation and adding light memoization where it reduces repeated lookup work.

**Tech Stack:** React, TypeScript, Tailwind CSS app tokens, Vitest, React Testing Library, Tauri `invoke` mock in tests.

---

### Task 1: Add dashboard primitives and preserve test coverage

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Test: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Run current tests before editing**

Run:

```bash
npx vitest run src/components/tournaments/TournamentsTab.test.tsx
```

Expected: PASS. If it fails before edits, stop and diagnose existing breakage first.

**Step 2: Replace legacy UI imports with dashboard-ready imports**

In `src/components/tournaments/TournamentsTab.tsx`, remove unused legacy imports after the redesign begins:

```ts
import { Card, CardHeader, CardBody, Badge } from "../ui";
```

Keep `Badge` only if it remains genuinely used; otherwise remove the whole import.

Ensure the icon import still includes only used icons:

```ts
import {
  Trophy,
  Calendar,
  TableProperties,
  Award,
  Star,
  Shield,
  Users,
  Zap,
} from "lucide-react";
```

Add `type ReactNode` to the React import:

```ts
import { useState, useEffect, useMemo, type ReactNode } from "react";
```

**Step 3: Add local dashboard helper primitives near `competitionLogoMeta`**

Add:

```tsx
function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function TemplateCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-app-border bg-app-card", className)}>{children}</div>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      {action ? <span className="text-[10px] font-semibold text-app-green">{action}</span> : null}
    </div>
  );
}

function StatRow({ label, value, tone = "text-app-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-app-text-muted">{label}</span>
      <span className={cx("font-bold tabular-nums", tone)}>{value}</span>
    </div>
  );
}

function HeaderChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
      <span className="text-app-green">{icon}</span>
      {label}: <span className="font-bold text-app-text">{value}</span>
    </div>
  );
}
```

**Step 4: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS.

**Step 5: Commit if only primitive/setup changes are complete**

Do not commit unless the user has explicitly requested commits in the current flow. If committing:

```bash
git add src/components/tournaments/TournamentsTab.tsx
git commit -m "refactor(tournaments): add dashboard primitives"
```

---

### Task 2: Redesign empty state, header, selector, and tabs

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Test: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Add/keep a test for the no active tournament state**

The existing test must remain valid:

```ts
it("renders the empty state when there is no active tournament", () => {
  render(<TournamentsTab gameState={createGameState(false)} onSelectTeam={vi.fn()} />);

  expect(screen.getByText("No active tournament")).toBeInTheDocument();
});
```

**Step 2: Replace the old empty state**

Replace:

```tsx
<div className="max-w-4xl mx-auto text-center py-12">
```

with dashboard shell/card styling:

```tsx
<div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
  <TemplateCard className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-bg text-app-text-muted">
      <Trophy className="h-6 w-6" />
    </div>
    <h1 className="text-xl font-bold tracking-tight text-app-text">TOURNAMENTS</h1>
    <p className="text-sm text-app-text-muted">{t("tournaments.noActive")}</p>
  </TemplateCard>
</div>
```

**Step 3: Replace the top-level wrapper and legacy league header**

Replace the returned wrapper:

```tsx
<div className="max-w-6xl mx-auto">
```

with:

```tsx
<div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
```

Replace the old preseason card and gradient league header with:

```tsx
{isPreseason ? (
  <TemplateCard className="border-app-green/30 bg-app-green/10 p-4">
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-app-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-bg">
          {t(`season.phases.${seasonContext.phase}`)}
        </span>
        <span className="text-sm font-bold text-app-text">
          {seasonContext.season_start
            ? t("season.startsOn", { date: formatMatchDate(seasonContext.season_start) })
            : t("season.noOpener")}
        </span>
      </div>
      <p className="text-xs text-app-text-muted">{t("season.tournamentsPreseasonHint")}</p>
    </div>
  </TemplateCard>
) : null}

<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
  <div className="flex min-w-0 items-center gap-4">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-card text-app-green">
      {competitionCountry && competitionTier ? (
        <DivisionLogo country={competitionCountry} leagueName={competitionLabel} />
      ) : (
        <Trophy className="h-7 w-7" />
      )}
    </div>
    <div className="min-w-0">
      <h1 className="truncate text-xl font-bold tracking-tight text-app-text">TOURNAMENTS</h1>
      <p className="text-sm text-app-text-muted">
        {competitionLabel} &bull; {t("schedule.season", { number: selectedCompetition.season })} &bull; {t("tournaments.nTeams", { count: competitionTeamCount })}
      </p>
      {competitionOptions.length > 1 ? (
        <select
          value={selectedCompetition.id}
          onChange={(event) => setSelectedCompetitionId(event.target.value)}
          className="mt-3 w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm font-bold text-app-text outline-none transition-colors hover:border-app-green/50 focus:border-app-green sm:max-w-sm"
          aria-label="Select competition"
        >
          {competitionOptions.map((competition) => (
            <option key={competition.id} value={competition.id} className="bg-app-bg text-app-text">
              {getCompetitionDisplayName(competition)}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  </div>
  <div className="flex flex-wrap items-center gap-3">
    <HeaderChip icon={<Trophy className="h-4 w-4" />} label={t("tournaments.progress")} value={`${completedMatchdays}/${totalMatchdays}`} />
    <HeaderChip icon={<Calendar className="h-4 w-4" />} label={t("tournaments.matches")} value={String(completedMatches)} />
    <HeaderChip icon={<Zap className="h-4 w-4" />} label={t("tournaments.goals")} value={String(totalGoals)} />
  </div>
</div>
```

**Step 4: Replace tab switcher with shared style tabs**

Use:

```tsx
<div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-app-border/50 px-2">
  {(["overview", "standings", "fixtures", "awards"] as const).map((nextView) => (
    <button
      key={nextView}
      type="button"
      onClick={() => setView(nextView)}
      className={cx(
        "flex items-center gap-1.5 border-b-2 px-1 pb-3 text-xs font-bold uppercase tracking-wider transition-colors",
        view === nextView
          ? "border-app-green text-app-green"
          : "border-transparent text-app-text-muted hover:text-app-text",
      )}
    >
      {nextView === "overview" ? <Trophy className="h-4 w-4" /> : nextView === "standings" ? <TableProperties className="h-4 w-4" /> : nextView === "awards" ? <Award className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
      {nextView === "overview" ? t("tournaments.overview") : nextView === "standings" ? t("schedule.standings") : nextView === "awards" ? t("tournaments.awardsTab") : t("schedule.fixtures")}
    </button>
  ))}
</div>
```

**Step 5: Verify tests still pass**

Run:

```bash
npx vitest run src/components/tournaments/TournamentsTab.test.tsx
```

Expected: PASS.

---

### Task 3: Build the hybrid workspace and overview panels

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Test: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Wrap tab content in workspace layout**

Below the tab row, add:

```tsx
<div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
  <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[280px]">
    {/* left rail */}
  </aside>

  <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 h-full">
    <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden bg-app-bg">
      {/* center tab content */}
    </TemplateCard>
  </section>

  <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[360px]">
    {/* right rail */}
  </aside>
</div>
```

Move existing `{view === ...}` blocks into the center `TemplateCard`.

**Step 2: Add left rail content**

Left rail should include:

```tsx
<div>
  <SectionTitle title="COMPETITION" action={competitionLabel} />
  <TemplateCard className="flex flex-col gap-3 p-4">
    <StatRow label="Leagues" value={String(domesticLeagueCompetitions.length)} tone="text-app-green" />
    <StatRow label="Cups" value={String(domesticCupCompetitions.length)} />
    <StatRow label="Continental" value={String(continentalCompetitions.length)} />
    <StatRow label="Teams" value={String(competitionTeamCount)} />
  </TemplateCard>
</div>

<div>
  <SectionTitle title="SEASON STATUS" action={seasonContext.phase} />
  <TemplateCard className="flex flex-col gap-3 p-4">
    <StatRow label="Current phase" value={t(`season.phases.${seasonContext.phase}`)} tone="text-app-green" />
    <StatRow label="Completed rounds" value={`${completedMatchdays}/${totalMatchdays}`} />
    <StatRow label="Completed matches" value={String(completedMatches)} />
  </TemplateCard>
</div>
```

**Step 3: Add center module header**

Inside center `TemplateCard`, before content:

```tsx
<div className="flex items-center justify-between border-b border-app-border/50 bg-app-card px-4 py-3">
  <div>
    <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-green">
      {view === "overview" ? t("tournaments.overview") : view === "standings" ? t("schedule.standings") : view === "fixtures" ? t("schedule.fixtures") : t("tournaments.awardsTab")}
    </h2>
    <p className="mt-1 text-xs text-app-text-muted">{competitionLabel}</p>
  </div>
  <span className="rounded bg-app-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-bg">
    {t("schedule.season", { number: selectedCompetition.season })}
  </span>
</div>
<div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
  {/* selected tab content */}
</div>
```

**Step 4: Restyle Overview content**

For overview, use a two-column grid inside the center scroll area:

```tsx
<div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
  <TemplateCard className="overflow-hidden xl:col-span-3">
    {/* mini standings table or state */}
  </TemplateCard>
  <TemplateCard className="overflow-hidden xl:col-span-2">
    {/* top scorers compact list */}
  </TemplateCard>
</div>
```

Use the same table/test IDs already present for overview standings:

```tsx
data-testid={`tournaments-overview-standing-${entry.team_id}`}
```

Do not remove `ContextMenu` wrappers.

**Step 5: Verify behavior test still passes**

Run:

```bash
npx vitest run src/components/tournaments/TournamentsTab.test.tsx
```

Expected: PASS.

---

### Task 4: Restyle standings and fixtures tabs

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Test: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Restyle standings empty states**

Replace old `Card/CardBody` empty states with:

```tsx
<TemplateCard className="flex min-h-[280px] flex-col items-center justify-center gap-2 p-8 text-center">
  <Trophy className="h-8 w-8 text-app-text-muted" />
  <p className="text-sm font-bold text-app-text">Knockout competition</p>
  <p className="max-w-md text-xs text-app-text-muted">Use the fixtures tab to follow each cup round.</p>
</TemplateCard>
```

For preseason standings locked, keep existing translated text.

**Step 2: Restyle full standings table**

Use a scrollable table with app classes:

```tsx
<div className="overflow-x-auto custom-scrollbar">
  <table className="w-full min-w-[760px] text-left text-[11px] whitespace-nowrap">
    <thead className="sticky top-0 z-10 border-b border-app-border/50 bg-app-card">
      <tr className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
        ...
      </tr>
    </thead>
    <tbody className="divide-y divide-app-border/30 text-app-text">
      ... keep ContextMenu and data-testid={`tournaments-standing-${entry.team_id}`} ...
    </tbody>
  </table>
</div>
```

Rows should use:

```tsx
className={cx(
  "cursor-pointer transition-colors hover:bg-white/5",
  isUser && "bg-app-green/10 ring-1 ring-inset ring-app-green/30",
)}
```

**Step 3: Restyle fixtures tab**

Keep `sortedMatchdays.map`. Replace each legacy card with:

```tsx
<TemplateCard key={md} className="overflow-hidden">
  <div className="border-b border-app-border/50 bg-app-card px-4 py-3">
    <h4 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
      {getFixtureRoundLabel(fixtures[0])} — {formatMatchDate(fixtures[0].date)}
    </h4>
  </div>
  <div className="divide-y divide-app-border/30">
    {/* fixture rows */}
  </div>
</TemplateCard>
```

Fixture row classes:

```tsx
className={cx(
  "flex items-center px-4 py-3 transition-colors hover:bg-white/5",
  isUserMatch && "bg-app-green/10",
)}
```

Keep:

```tsx
data-testid={`tournaments-fixture-${f.id}`}
```

Keep home/away `onClick={() => onSelectTeam(...)}`.

**Step 4: Verify fixtures context menu test**

Run:

```bash
npx vitest run src/components/tournaments/TournamentsTab.test.tsx -t "offers fixture context menu actions"
```

Expected: PASS.

**Step 5: Run full tournament tests**

Run:

```bash
npx vitest run src/components/tournaments/TournamentsTab.test.tsx
```

Expected: PASS.

---

### Task 5: Restyle awards and right rail

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Test: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Restyle awards tab states**

Replace legacy centered loading/error blocks with `TemplateCard` or simple center content inside the center scroll area:

```tsx
<TemplateCard className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
  <Award className="h-10 w-10 text-app-text-muted" />
  <p className="text-sm text-app-text-muted">{t("tournaments.loadingAwards")}</p>
</TemplateCard>
```

For retry button:

```tsx
<button
  type="button"
  onClick={() => setAwardsRetryCount((count) => count + 1)}
  className="rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg transition-colors hover:bg-app-green/90"
>
  {t("common.retry")}
</button>
```

**Step 2: Restyle `AwardCard`**

Replace `Card/CardHeader/CardBody` in `AwardCard` with `TemplateCard`:

```tsx
<TemplateCard className="overflow-hidden">
  <div className="border-b border-app-border/50 bg-app-card px-4 py-3">
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-app-text">{title}</span>
        <p className="text-[10px] font-normal normal-case tracking-normal text-app-text-muted">{subtitle}</p>
      </div>
    </div>
  </div>
  ...
</TemplateCard>
```

Rows should use `divide-y divide-app-border/30`, `hover:bg-white/5`, `text-app-*` classes. Keep:

```tsx
data-testid={`tournaments-award-entry-${entry.player_id}`}
```

**Step 3: Add right rail content**

Right rail should include:

- Top scorers card using `topScorers` and existing context menus/test IDs:

```tsx
data-testid={`tournaments-top-scorer-${entry.player!.id}`}
```

- A table snapshot card:
  - leader from `standings[0]` if available.
  - user standing if available.
  - total goals and completed matches.

Keep right rail read-only except existing context menu/navigation in top scorers.

**Step 4: Verify top scorer profile test**

Run:

```bash
npx vitest run src/components/tournaments/TournamentsTab.test.tsx -t "top-scorer context menu"
```

Expected: PASS.

**Step 5: Run full verification**

Run:

```bash
npx tsc --noEmit
npx vitest run src/components/tournaments/TournamentsTab.test.tsx
```

Expected: both PASS.

---

### Task 6: Final polish and manual check

**Files:**
- Modify: `src/components/tournaments/TournamentsTab.tsx`
- Test: `src/components/tournaments/TournamentsTab.test.tsx`

**Step 1: Remove any remaining legacy classes**

Search within `TournamentsTab.tsx` and remove/replace old styling tokens where practical:

- `max-w-6xl`
- `gray-`
- `surface-`
- `primary-`
- old `Card`, `CardHeader`, `CardBody` imports

Do not remove classes inside unrelated imported components.

**Step 2: Ensure all existing behavior still exists**

Verify in code:

- Competition selector still changes `selectedCompetitionId`.
- Tabs still set `view`.
- Awards still call `invoke<SeasonAwards>("get_season_awards")` only when `view === "awards"` and no cached awards exist.
- Context menu wrappers still exist for standings, fixtures, top scorers, and awards.
- Existing test IDs are preserved.

**Step 3: Run verification commands**

Run:

```bash
npx tsc --noEmit
npx vitest run src/components/tournaments/TournamentsTab.test.tsx
```

Expected: both PASS.

**Step 4: Manual browser check**

Start the dev server if it is not already running, then open:

```text
http://localhost:1420/tournaments
```

Check:

1. Page matches the app dashboard style used by Schedule/Teams/Players.
2. Competition selector works when multiple competitions exist.
3. Overview, Standings, Fixtures, Awards tabs render correctly.
4. Right-click standings rows, fixture rows, top scorers, and awards rows.
5. Team/player navigation still works.
6. No full-page scroll problem; the workspace panels scroll internally.

**Step 5: Commit only if explicitly requested**

The user has not automatically authorized every commit. Commit only when explicitly requested, or if the current workflow already requires it and the user has agreed.

Suggested commit message:

```bash
git add src/components/tournaments/TournamentsTab.tsx src/components/tournaments/TournamentsTab.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): redesign tournaments dashboard

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```
