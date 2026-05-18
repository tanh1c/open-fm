# Transfers Completion Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining visual-only controls on the Transfer page using existing frontend state and existing backend commands only.

**Architecture:** Keep `src/components/transfers/TransfersTab.tsx` as the main orchestration component. Add local UI state for menus, filters, pagination, and negotiation-panel parameter sync, but keep backend mutations routed only through existing services in `src/services/transfersService.ts` and `src/services/scoutingService.ts`. Do not add backend commands, schema, or save fields in Phase 1.

**Tech Stack:** React, TypeScript, Tailwind, Vite, Vitest, Testing Library, Tauri `invoke` service wrappers.

---

## Rules for all tasks

- Preserve existing transfer/game flow:
  - `make_transfer_bid`
  - `preview_transfer_bid_financial_impact`
  - `respond_to_offer`
  - `counter_offer`
  - `toggle_transfer_list`
  - `toggle_loan_list`
  - `send_scout`
- Do not add backend commands or schema fields.
- Do not remove existing actions, context menus, modals, or tests.
- Follow TDD: write/adjust test first, run it to see the expected failure, then implement.
- Do not commit or push unless the user explicitly asks.

---

### Task 1: Add local filter and pagination model helpers

**Files:**
- Modify: `src/components/transfers/TransfersTab.model.ts`
- Modify: `src/components/transfers/TransfersTab.model.test.ts`

**Step 1: Write failing tests**

Add tests for local filter and pagination helpers:

```ts
it("filters transfer players by age, value, wage, and offer status", () => {
  const players = [
    createPlayer({ id: "young", date_of_birth: "2008-01-01", market_value: 500000, wage: 1000, transfer_offers: [] }),
    createPlayer({ id: "prime", date_of_birth: "2000-01-01", market_value: 1500000, wage: 3000, transfer_offers: [{ id: "offer-1", from_team_id: "team-1", fee: 1000000, wage_offered: 0, last_manager_fee: null, negotiation_round: 1, suggested_counter_fee: null, status: "Pending", date: "2026-08-01" }] }),
  ];

  expect(applyTransferAdvancedFilters(players, {
    minAge: 20,
    maxAge: 30,
    maxValue: 2000000,
    maxWeeklyWage: 100,
    offerStatus: "Pending",
  }, "2026-08-01T00:00:00Z").map((player) => player.id)).toEqual(["prime"]);
});

it("paginates transfer players and clamps the current page", () => {
  const players = Array.from({ length: 23 }, (_, index) => createPlayer({ id: `player-${index}` }));

  expect(paginateTransferPlayers(players, 2, 10).items).toHaveLength(10);
  expect(paginateTransferPlayers(players, 99, 10).page).toBe(3);
});
```

If there is no `createPlayer` helper in the model test, use the existing test fixture pattern in that file.

**Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.model.test.ts --reporter=verbose
```

Expected: FAIL because `applyTransferAdvancedFilters` and `paginateTransferPlayers` do not exist.

**Step 3: Implement helpers**

Add types and helpers in `TransfersTab.model.ts`:

```ts
export interface TransferAdvancedFilters {
  minAge: number | null;
  maxAge: number | null;
  maxValue: number | null;
  maxWeeklyWage: number | null;
  offerStatus: "Any" | "Pending" | "Accepted" | "Rejected" | "Withdrawn";
}

function ageOnDate(dateOfBirth: string, currentDate: string): number {
  const birth = new Date(dateOfBirth);
  const current = new Date(currentDate);
  let age = current.getFullYear() - birth.getFullYear();
  const monthDiff = current.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && current.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function applyTransferAdvancedFilters(
  players: PlayerData[],
  filters: TransferAdvancedFilters,
  currentDate: string,
): PlayerData[] {
  return players.filter((player) => {
    const age = ageOnDate(player.date_of_birth, currentDate);
    if (filters.minAge !== null && age < filters.minAge) return false;
    if (filters.maxAge !== null && age > filters.maxAge) return false;
    if (filters.maxValue !== null && player.market_value > filters.maxValue) return false;
    if (filters.maxWeeklyWage !== null && player.wage / 52 > filters.maxWeeklyWage) return false;
    if (filters.offerStatus !== "Any" && !player.transfer_offers.some((offer) => offer.status === filters.offerStatus)) return false;
    return true;
  });
}

export function paginateTransferPlayers<T>(items: T[], page: number, pageSize: number): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(pageCount, Math.max(1, page));
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, pageCount };
}
```

**Step 4: Run tests**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.model.test.ts --reporter=verbose
```

Expected: PASS.

---

### Task 2: Replace visual dropdowns and Filters button with real controls

**Files:**
- Modify: `src/components/transfers/TransfersTab.tsx`
- Modify: `src/components/transfers/TransfersTab.test.tsx`

**Step 1: Write failing tests**

Add a test in `TransfersTab.test.tsx`:

```ts
it("uses real transfer filters and view dropdowns", () => {
  render(
    <TransfersTab
      gameState={createGameState([
        createPlayer({ id: "defender", full_name: "Dan Defender", natural_position: "Defender", position: "Defender", transfer_listed: true, team_id: "team-2" }),
        createPlayer({ id: "forward", full_name: "Finn Forward", natural_position: "Forward", position: "Forward", transfer_listed: true, team_id: "team-2" }),
      ])}
      onSelectPlayer={vi.fn()}
      onSelectTeam={vi.fn()}
      onGameUpdate={vi.fn()}
    />,
  );

  fireEvent.change(screen.getByLabelText("Transfer list view"), { target: { value: "market" } });
  fireEvent.change(screen.getByLabelText("Position filter"), { target: { value: "Defender" } });

  expect(screen.getByText("Dan Defender")).toBeInTheDocument();
  expect(screen.queryByText("Finn Forward")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Advanced filters" }));
  expect(screen.getByLabelText("Maximum value")).toBeInTheDocument();
});
```

**Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: FAIL because dropdowns are visual-only `div`s and advanced filters do not exist.

**Step 3: Implement controls**

In `TransfersTab.tsx`:

- Import new model helpers/types:

```ts
import {
  applyTransferAdvancedFilters,
  deriveTransferCollections,
  filterTransferPlayers,
  getCurrentTransferList,
  paginateTransferPlayers,
  type TransferAdvancedFilters,
  type TransferTabView,
} from "./TransfersTab.model";
```

- Add state:

```ts
const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
const [advancedFilters, setAdvancedFilters] = useState<TransferAdvancedFilters>({
  minAge: null,
  maxAge: null,
  maxValue: null,
  maxWeeklyWage: null,
  offerStatus: "Any",
});
```

- Replace `FilterDropdown` visual div usage with real `<select>` controls:

```tsx
<select aria-label="Position filter" value={posFilter ?? ""} onChange={(event) => setPosFilter(event.target.value || null)} className="bg-app-bg border border-app-border rounded-lg px-3 py-1.5 text-xs text-app-text">
  <option value="">Any Position</option>
  {positions.map((position) => <option key={position} value={position}>{position}</option>)}
</select>

<select aria-label="Transfer list view" value={view} onChange={(event) => {
  const nextView = event.target.value as TransferTabView;
  const matchingTab = visualTabs.find((tab) => tab.view === nextView);
  setView(nextView);
  setVisualTab(matchingTab?.id ?? "Overview");
}} className="bg-app-bg border border-app-border rounded-lg px-3 py-1.5 text-xs text-app-text">
  <option value="market">Transfer Market</option>
  <option value="loans">Loan Market</option>
  <option value="offers">Offers</option>
  <option value="my_list">Shortlists</option>
</select>
```

- Make Filters button toggle a compact local panel:

```tsx
<button type="button" aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen((open) => !open)} className="...">
  <Filter className="w-3.5 h-3.5" /> Advanced filters
</button>

{advancedFiltersOpen ? (
  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 border-t border-app-border/40 pt-3">
    <input aria-label="Minimum age" type="number" value={advancedFilters.minAge ?? ""} onChange={(event) => setAdvancedFilters((current) => ({ ...current, minAge: event.target.value ? Number(event.target.value) : null }))} className="..." />
    <input aria-label="Maximum age" type="number" value={advancedFilters.maxAge ?? ""} onChange={(event) => setAdvancedFilters((current) => ({ ...current, maxAge: event.target.value ? Number(event.target.value) : null }))} className="..." />
    <input aria-label="Maximum value" type="number" value={advancedFilters.maxValue ?? ""} onChange={(event) => setAdvancedFilters((current) => ({ ...current, maxValue: event.target.value ? Number(event.target.value) : null }))} className="..." />
    <input aria-label="Maximum weekly wage" type="number" value={advancedFilters.maxWeeklyWage ?? ""} onChange={(event) => setAdvancedFilters((current) => ({ ...current, maxWeeklyWage: event.target.value ? Number(event.target.value) : null }))} className="..." />
    <select aria-label="Offer status filter" value={advancedFilters.offerStatus} onChange={(event) => setAdvancedFilters((current) => ({ ...current, offerStatus: event.target.value as TransferAdvancedFilters["offerStatus"] }))} className="...">
      <option value="Any">Any status</option>
      <option value="Pending">Pending</option>
      <option value="Accepted">Accepted</option>
      <option value="Rejected">Rejected</option>
      <option value="Withdrawn">Withdrawn</option>
    </select>
  </div>
) : null}
```

- Compute list in this order:

```ts
const baseFilteredList = filterTransferPlayers(currentList, search, posFilter);
const filteredList = applyTransferAdvancedFilters(baseFilteredList, advancedFilters, gameState.clock.current_date);
```

**Step 4: Run tests**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: PASS.

---

### Task 3: Add real target-table pagination

**Files:**
- Modify: `src/components/transfers/TransfersTab.tsx`
- Modify: `src/components/transfers/TransfersTab.test.tsx`

**Step 1: Write failing test**

Add a test:

```ts
it("paginates transfer target rows", () => {
  const players = Array.from({ length: 13 }, (_, index) => createPlayer({
    id: `market-${index}`,
    full_name: `Market Player ${index}`,
    match_name: `M. Player ${index}`,
    team_id: "team-2",
    transfer_listed: true,
    transfer_offers: [],
  }));

  render(<TransfersTab gameState={createGameState(players)} onSelectPlayer={vi.fn()} onSelectTeam={vi.fn()} onGameUpdate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: /transfer market/i }));

  expect(screen.getByText("Market Player 0")).toBeInTheDocument();
  expect(screen.queryByText("Market Player 12")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Next transfer page" }));

  expect(screen.getByText("Market Player 12")).toBeInTheDocument();
});
```

**Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: FAIL because table renders all rows and pagination buttons are static.

**Step 3: Implement pagination**

- Add state:

```ts
const [page, setPage] = useState(1);
const pageSize = 10;
```

- Reset page when filtering context changes:

```ts
useEffect(() => {
  setPage(1);
}, [view, search, posFilter, advancedFilters]);
```

- Derive page result:

```ts
const pagination = paginateTransferPlayers(filteredList, page, pageSize);
const visibleList = pagination.items;
```

- Render `visibleList.map(renderPlayerContextRow)` instead of `filteredList.map(...)`.

- Replace static pagination buttons with real controls:

```tsx
<button type="button" aria-label="Previous transfer page" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>...</button>
<span>Page {pagination.page} / {pagination.pageCount}</span>
<button type="button" aria-label="Next transfer page" disabled={pagination.page >= pagination.pageCount} onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))}>...</button>
```

**Step 4: Run tests**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: PASS.

---

### Task 4: Make header menus functional

**Files:**
- Modify: `src/components/transfers/TransfersTab.tsx`
- Modify: `src/components/transfers/TransfersTab.test.tsx`

**Step 1: Write failing test**

Add tests:

```ts
it("opens transfer header menus with real quick actions", () => {
  render(<TransfersTab gameState={createGameState()} onSelectPlayer={vi.fn()} onSelectTeam={vi.fn()} onGameUpdate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Shortlist menu" }));
  expect(screen.getByRole("button", { name: "Show listed players" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Finalize menu" }));
  expect(screen.getByRole("button", { name: "Show pending offers" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Transfer actions" }));
  expect(screen.getByRole("button", { name: "Open loan market" })).toBeInTheDocument();
});
```

**Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: FAIL because menu buttons do not render menu content.

**Step 3: Implement menus**

- Add state:

```ts
const [openHeaderMenu, setOpenHeaderMenu] = useState<null | "shortlist" | "finalize" | "actions">(null);
```

- Add helper:

```ts
const openView = (tabId: string, nextView: TransferTabView) => {
  setVisualTab(tabId);
  setView(nextView);
  setOpenHeaderMenu(null);
};
```

- Wrap split buttons in `relative` containers and render compact absolute menus.
- Menu actions should only set existing state or call existing handlers.
- If a toggle action needs `panelPlayer`, only enable it when `panelPlayer.team_id === userTeamId`.

Example menu:

```tsx
{openHeaderMenu === "actions" ? (
  <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-lg border border-app-border bg-app-card p-1 shadow-xl">
    <button type="button" onClick={() => openView("Transfer Targets", "market")} className="...">Open transfer market</button>
    <button type="button" onClick={() => openView("Loans", "loans")} className="...">Open loan market</button>
    <button type="button" onClick={() => openView("Negotiations", "offers")} className="...">Open offers</button>
  </div>
) : null}
```

**Step 4: Run tests**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: PASS.

---

### Task 5: Sync negotiation-panel fee controls to real bid/counter state

**Files:**
- Modify: `src/components/transfers/TransfersTab.tsx`
- Modify: `src/components/transfers/TransfersTab.test.tsx`

**Step 1: Write failing test**

Add a test:

```ts
it("syncs the negotiation panel transfer fee control with the bid modal amount", () => {
  render(<TransfersTab gameState={createGameState([
    createPlayer({ id: "market-player", team_id: "team-2", transfer_listed: true, market_value: 1000000, transfer_offers: [] }),
  ])} onSelectPlayer={vi.fn()} onSelectTeam={vi.fn()} onGameUpdate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: /transfer market/i }));
  fireEvent.change(screen.getByRole("slider", { name: "Transfer Fee parameter" }), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit panel bid" }));

  expect(screen.getByLabelText(/bid amount/i)).toHaveValue(0.8);
});
```

If the input value assertion differs because the bid input is text, assert display value `"0.80"` or `"0.8"` according to the modal implementation.

**Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: FAIL because parameter levels are local visual state and do not update `bidAmount`.

**Step 3: Implement sync**

- Extend `NegotiationPanel` props:

```ts
onTransferFeeParameterChange: (nextPct: number) => void;
```

- In parent, implement:

```ts
const handlePanelTransferFeeChange = (nextPct: number) => {
  const player = panelPlayer;
  if (!player) return;
  const baseFee = panelOffer?.fee ?? player.market_value;
  const nextFee = Math.max(0, Math.round((baseFee * nextPct) / 100));

  if (player.team_id !== userTeamId) {
    if (!bidTarget || bidTarget.id !== player.id) openBidNegotiation(player);
    setBidAmount((nextFee / 1_000_000).toFixed(2));
    return;
  }

  if (panelOffer) {
    setCounterTarget((current) => current ?? { player, offerId: panelOffer.id, fromTeamId: panelOffer.from_team_id, fee: panelOffer.fee });
    setCounterAmount((nextFee / 1_000_000).toFixed(2));
  }
};
```

- Pass to `NegotiationPanel`.
- In `NegotiationPanel`, for Transfer Fee only:

```tsx
<ParameterRow label="Transfer Fee" val={formatVal(offerFee)} pct={parameterLevels.fee} onChange={(value) => { updateParameterLevel("fee", value); onTransferFeeParameterChange(value); }} />
```

- Leave wage rows local-only because existing backend commands do not accept wage terms.

**Step 4: Run tests**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: PASS.

---

### Task 6: Add bottom-card row actions

**Files:**
- Modify: `src/components/transfers/TransfersTab.tsx`
- Modify: `src/components/transfers/TransfersTab.test.tsx`

**Step 1: Write failing test**

Add a focused test:

```ts
it("opens player profiles from bottom transfer cards", () => {
  const onSelectPlayer = vi.fn();
  render(<TransfersTab gameState={createGameState([createPlayer({ transfer_listed: true })])} onSelectPlayer={onSelectPlayer} onSelectTeam={vi.fn()} onGameUpdate={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Open J. Smith from Incoming Transfers" }));

  expect(onSelectPlayer).toHaveBeenCalledWith("player-1");
});
```

Adjust accessible name if the card used is Shortlisted instead of Incoming based on fixture data.

**Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: FAIL because bottom rows are not buttons.

**Step 3: Implement actions**

- Update `BottomTransferCard`, `LoanWatchCard`, `ShortlistCardGroup`, and `ShortlistCard` props to accept `onSelectPlayer` and optionally `onSelectTeam`.
- Convert row player names/cards to buttons with accessible labels.
- For incoming pending offers, optionally pass `onCounterOffer` if the existing parent handler is easy to thread without broad refactor.
- Do not duplicate backend mutation logic inside card components.

Example:

```tsx
<button type="button" aria-label={`Open ${player.match_name} from ${title}`} onClick={() => onSelectPlayer(player.id)} className="font-bold group-hover:text-app-green transition-colors truncate text-left">
  {player.match_name}
</button>
```

**Step 4: Run tests**

Run:

```bash
npx vitest run src/components/transfers/TransfersTab.test.tsx --reporter=verbose
```

Expected: PASS.

---

### Task 7: Full verification

**Files:**
- No edits unless failures reveal issues.

**Step 1: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0.

**Step 2: Run transfer tests**

Run:

```bash
npx vitest run src/components/transfers --reporter=verbose
```

Expected: all transfer tests pass.

**Step 3: Inspect git diff**

Run:

```bash
git diff -- src/components/transfers docs/plans/2026-05-18-transfers-completion-design.md docs/plans/2026-05-18-transfers-completion-implementation.md
```

Expected: changes only cover the Phase 1 frontend completion, tests, and plan docs.

**Step 4: Report remaining Phase 2 scope**

Report clearly that Phase 1 uses existing backend only. Any true backend additions such as independent shortlist, saved filters, wage clauses, sell-on clauses, signing bonus, or agent demands remain Phase 2.
