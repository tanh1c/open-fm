# Transfers Completion Design

## Goal

Complete the remaining Transfer page interactions in phases while preserving the existing game logic, save data, and backend command flow.

## Current backend-backed flow

The current Transfer page already uses real game data and Tauri commands for the core transfer flow:

- `make_transfer_bid` for outgoing transfer bids.
- `preview_transfer_bid_financial_impact` for bid affordability previews.
- `respond_to_offer` for accepting or rejecting incoming offers.
- `counter_offer` for incoming-offer negotiations.
- `toggle_transfer_list` and `toggle_loan_list` for user-team listing state.
- `send_scout` for market scouting assignments.
- `onSelectPlayer` and `onSelectTeam` for navigation.

These flows must remain the source of truth. Template UI affordances must not introduce fake persistent state.

## Phase 1: Complete frontend-backed interactions

Phase 1 converts visual-only controls into real interactions using existing frontend state and existing backend commands only.

### Header menus

Make the template header split buttons open real menus:

- Shortlist menu:
  - Switch to the shortlist/listed-player view.
  - Clear filters.
  - If a panel player belongs to the user team, expose transfer-list and loan-list toggles using the existing backend commands.
- Finalize menu:
  - Switch to negotiations/offers.
  - Focus pending incoming/outgoing offers when available.
- Transfer actions menu:
  - Quick links to Market, Loans, Offers, and Listed players.

No new backend state is added here.

### Filter controls

Replace visual dropdown chips with real controls:

- Position dropdown controls `posFilter`.
- Market/view dropdown controls the existing `TransferTabView` and visual tab mapping.
- The Filters button either becomes a real local filter panel or is removed. If kept, it should filter by data already present on `PlayerData`, such as age, value, wage, and offer status.

Filters reset pagination when changed.

### Pagination

Add local pagination to the target table:

- Keep the current full `filteredList` source.
- Derive `paginatedList` from `filteredList`, `page`, and `pageSize`.
- Wire previous/next/page number buttons.
- Reset page when view, search, or filters change.

Pagination is frontend-only because all transfer candidates are already present in `GameStateData`.

### Negotiation panel offer parameters

Keep the template slider visual but connect the controls to existing negotiation state:

- For market/outgoing bid targets, Transfer Fee updates `bidAmount` so the existing bid modal and projection flow receive the selected value.
- For incoming offer targets, the relevant fee slider updates `counterAmount` so the existing counter-offer modal submits the selected value.
- Current Wage, Offer Wage, and Last Manager Fee remain display/local visual controls unless backed by existing command inputs. They must be clearly treated as non-persistent frontend controls and must not imply backend wage-term negotiation.

The backend remains the authority for actual acceptance, rejection, counters, projections, and returned game state.

### Bottom cards

Make summary cards more useful without inventing backend state:

- Player rows open player profiles.
- Club labels open team pages.
- Incoming pending offers expose accept/reject/counter where practical using existing handlers.
- Shortlisted/listed players expose existing transfer-list and loan-list toggles where practical.

## Phase 2: Backend extension design

After Phase 1, separately design backend-backed enhancements only if needed:

- Independent shortlist separate from `transfer_listed`.
- Saved searches / saved filters.
- Negotiation clauses such as signing bonus, sell-on, installments, wage promises, agent demands, or contract terms.
- Backend-derived interest/scout-rating fields if frontend heuristics are not enough.

Phase 2 requires schema, save migration, Rust domain logic, Tauri commands, and tests. It should not be mixed into Phase 1.

## Testing strategy

- Add/update `TransfersTab.test.tsx` for header menus, real dropdown filters, pagination, and negotiation slider state sync.
- Keep existing transfer behavior tests passing:
  - incoming counter-offer command payloads,
  - outgoing bid modal resume flow,
  - scout assignment errors,
  - expired/withdrawn offers,
  - bid projection blocking,
  - transfer-list context actions.
- Run:
  - `npx tsc --noEmit`
  - `npx vitest run src/components/transfers --reporter=verbose`

## Non-goals for Phase 1

- Do not add new backend commands.
- Do not add new persistent fields.
- Do not change save schema.
- Do not remove existing transfer, scouting, listing, or negotiation behavior.
- Do not treat template-only fields as backend truth.
