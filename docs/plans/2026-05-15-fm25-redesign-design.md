# FM25-style UI Redesign — Design Document

**Status**: Approved 2026-05-15
**Scope**: Full overhaul of OpenFootManager web app to match Football Manager 2025 visual language (default dark + violet variant).

## Goals

1. Replace existing emerald + gold + navy palette with FM25's deep charcoal + violet + lime accent.
2. Replace Inter (body) + Barlow Condensed (heading) stack with Inter (body) + **Rajdhani** (heading) + **JetBrains Mono** (stat numerals).
3. Refresh primitive components (Button, Card, Input, Tabs, Modal) with FM25 visual cues: 6px radius, slim 1px borders, inset highlights, primary glow on focus.
4. Introduce FM25-style in-game layout shell (topbar + sidebar icon-rail + main content) for Dashboard and MatchSimulation.
5. Polish pass: tabular numerals in stat tables, color-graded rating cells, W-D-L form badges, deprecate `navy-*` token alias.

## Non-goals

- Theme switcher / skin system (rejected: only one theme to ship, the FM25 one).
- Replicating FM25 exactly with commercial fonts (Eurostile, DIN). We use web-safe alternatives.
- Refactoring page content layouts beyond wrapping in the new shell.

## Strategy: Layered (4 phases)

Implementation ships in 4 layers, each independently testable. Subsequent layers depend on earlier ones but earlier layers are useful even if later ones are deferred.

### Phase 1 — Tokens layer (~30 min)

Rewrite `@theme` block in `src/App.css`. Bundle in three new font sets via `@fontsource/*`. Add three new utility classes (`.font-stat`, `.heading-tight`, `.heading-loose`).

Add `--color-navy-*` aliases that point to `--color-surface-*` so the 50+ existing files using `navy-700`, `navy-900`, etc. keep rendering. They'll be deprecated in Phase 4.

#### Color tokens

```css
@theme {
  /* Surface — deep charcoal/navy with cool blue tint */
  --color-surface-50:  #f5f6fa;
  --color-surface-100: #e8eaf2;
  --color-surface-200: #c4c8d6;
  --color-surface-700: #2a2f47;
  --color-surface-800: #1d2138;
  --color-surface-900: #14172a;
  --color-surface-950: #0a0c1a;

  /* Primary — FM25 signature violet */
  --color-primary-50:  #f4f1ff;
  --color-primary-100: #e6dfff;
  --color-primary-300: #b6a3ff;
  --color-primary-400: #9b82ff;
  --color-primary-500: #7c5cff;
  --color-primary-600: #6240e6;
  --color-primary-700: #4a2eb8;
  --color-primary-900: #2b1a6e;

  /* Accent — bright lime */
  --color-accent-400: #d6ff3f;
  --color-accent-500: #b8eb1c;
  --color-accent-600: #94c40d;

  /* Semantic */
  --color-success-500: #2ecc71;
  --color-warn-500:    #f59e0b;
  --color-danger-500:  #ef4444;

  /* Rating gradient */
  --color-rating-elite: #2ecc71;
  --color-rating-good:  #b8eb1c;
  --color-rating-avg:   #f59e0b;
  --color-rating-poor:  #ef4444;
}
```

#### Typography

```css
--font-sans:    "Inter", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-heading: "Rajdhani", "Inter", "PingFang SC", sans-serif;
--font-mono:    "JetBrains Mono", "Consolas", ui-monospace, monospace;
```

Drop Barlow Condensed import (~80 KB savings). Add Rajdhani 500/600/700 and JetBrains Mono 400/500.

#### Type scale

| Token | Use | Size / weight | Tracking |
|---|---|---|---|
| `text-display` | Hero numerics | 48px / 700 mono | -0.02em |
| `text-h1` | Page title | 24px / 700 heading | uppercase, 0.06em |
| `text-h2` | Section heading | 18px / 600 heading | uppercase, 0.08em |
| `text-h3` | Card title | 14px / 600 heading | uppercase, 0.10em |
| `text-body` | Body text | 14px / 400 sans | normal |
| `text-caption` | Labels | 11px / 600 heading | uppercase, 0.12em |
| `text-stat` | Table numerals | 13px / 500 mono | tabular-nums |

#### Utilities

```css
.font-stat     { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.heading-tight { letter-spacing: 0.06em; text-transform: uppercase; }
.heading-loose { letter-spacing: 0.10em; text-transform: uppercase; }
```

### Phase 2 — Primitive components (~1-1.5 h)

Refactor the building blocks in `src/components/ui/`. Corner radius lands on `rounded-md` (6 px) across the board.

Files:

- `src/components/ui/Button.tsx` — variants `primary`, `secondary`, `ghost` per spec in design.
- `src/components/ui/Card.tsx` — new file; existing pages inline this style. Add `default` and `highlight` variants.
- `src/components/ui/DatePicker.tsx` — already touched in earlier bug fix; restyle inputs.
- `src/components/ui/Tabs.tsx` — new file. Active tab uses 2 px primary bottom border.
- `src/components/ui/Modal.tsx` (or equivalent) — surface-800 bg, surface-700 border, 2xl shadow.
- New `src/components/ui/StatRow.tsx` for table-style stat rows.

Old palette refs (`bg-navy-700`, `text-emerald-*`, etc.) keep working through aliases.

### Phase 3 — Layout shell (~1.5-2 h)

Three layout components and integration.

```
┌──────────────────────────────────────────────────────────┐
│  TOPBAR (56 px)  [crest] [date] [finance] [Continue ►]  │
├──────┬───────────────────────────────────────────────────┤
│ SIDE │                                                   │
│ BAR  │            MAIN CONTENT                           │
│ 56px │            (page body, scrollable)                │
└──────┴───────────────────────────────────────────────────┘
```

Files:

- `src/components/layout/AppShell.tsx` — composes Topbar + Sidebar + main slot.
- `src/components/layout/Topbar.tsx` — left: crest + team name; center: game date (Rajdhani uppercase); right: finance balance (font-stat, color-coded), Continue CTA (always primary).
- `src/components/layout/Sidebar.tsx` — vertical icon rail. Icons: Squad, Tactics, Matches, Transfers, Scouting, Training, Finance, Inbox, News, Settings. Active state uses primary tint background + left border accent.
- `src/pages/Dashboard.tsx` — wrap in AppShell. Move existing tab bar from mid-page to right under Topbar.
- `src/pages/MatchSimulation.tsx` — wrap in AppShell, optionally fullscreen during live match.
- `src/App.tsx` — add nested routes for tab paths if URL-driven (`/squad`, `/tactics`, ...).

Menu screens (MainMenu, TeamSelection) keep centered card layout — they are pre-game and should not show in-game chrome.

### Phase 4 — Polish (~1 h)

- Add `src/lib/ratings.ts` with `ratingClass(value: number)` helper.
- Apply `.font-stat` to existing tables: SquadTab, FinancesTab, fixture lists, transfer log.
- Apply rating cell utilities to player attribute cells.
- Add `.form-badge` utility for W-D-L-W-W indicators.
- Audit residual `navy-*` references; migrate to `surface-*`; remove aliases.
- Verify WCAG AA contrast on every text/bg pair.

## Verification

After each phase:

1. `npx tsc --noEmit` clean.
2. `npm run build` clean (Vite + wasm-pack reuse cached pkg).
3. Smoke render of MainMenu, Dashboard, MatchSimulation in browser.
4. Last phase: a11y contrast pass.

## Risks

- **Rajdhani CJK fallback**: Rajdhani has no CJK glyphs. The existing PingFang SC / Microsoft YaHei chain in `--font-heading` covers Chinese rendering automatically.
- **Inset shadows on Linux**: WebKit GTK renders inset shadows differently. Keep them subtle (4–12 % opacity) so any rendering quirks are invisible.
- **Existing tests reference class names**: minor — only a couple of `.test.tsx` files match `bg-navy-700` etc. The compat alias keeps them passing through Phase 1-3.

## Out of scope (future work)

- Light theme variant.
- High-density "tablet" mode.
- Custom skin import.
- Match engine 2D pitch view styling.
