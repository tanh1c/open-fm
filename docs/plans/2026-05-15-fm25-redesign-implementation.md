# FM25-style UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor OpenFootManager web UI to match the Football Manager 2025 default skin (deep charcoal + violet primary + lime accent) with sharp 6px-radius components and a topbar+sidebar in-game layout shell.

**Architecture:** Layered overhaul in 4 phases — tokens, primitives, layout shell, polish. Each phase is independently shippable. Legacy classes (`navy-*`, `text-emerald-*`) keep rendering through CSS variable aliases until the polish phase removes them.

**Tech Stack:** Tailwind v4 (`@theme` block in App.css), Vite 8, React 19, TypeScript 6, Vitest. Fonts via `@fontsource/*` packages: Rajdhani (heading), JetBrains Mono (numerals), Inter (body, kept).

**Design doc:** `docs/plans/2026-05-15-fm25-redesign-design.md` (committed, sha 9098b75).

---

## Phase 1 — Tokens layer

Goal: swap palette + fonts in App.css. After this phase, the entire app should re-render with FM25 colors and Rajdhani headings without any component code changing.

### Task 1.1: Install new font packages

**Files:**
- Modify: `package.json` (add deps)

**Step 1: Install fonts**

Run:
```bash
npm install @fontsource/rajdhani @fontsource/jetbrains-mono
```

Expected: 2 new entries in `package.json` dependencies, `node_modules/@fontsource/rajdhani` and `node_modules/@fontsource/jetbrains-mono` exist.

**Step 2: Verify**

Run: `ls node_modules/@fontsource/rajdhani node_modules/@fontsource/jetbrains-mono`
Expected: each dir contains `latin-500.css`, `latin-600.css`, `latin-700.css` (Rajdhani) and `latin-400.css`, `latin-500.css` (JetBrains Mono).

**Step 3: Remove unused Barlow Condensed**

Run:
```bash
npm uninstall @fontsource/barlow-condensed
```

Expected: `@fontsource/barlow-condensed` removed from `package.json`.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(fonts): swap Barlow Condensed for Rajdhani + JetBrains Mono"
```

---

### Task 1.2: Rewrite the @theme block

**Files:**
- Modify: `src/App.css`

**Step 1: Replace the entire file contents**

Open `src/App.css` and replace the file with:

```css
@import "tailwindcss";

/* Bundled fonts (offline, used weights and supported subsets only) */
@import "@fontsource/inter/latin-400.css";
@import "@fontsource/inter/latin-500.css";
@import "@fontsource/inter/latin-600.css";
@import "@fontsource/inter/latin-700.css";
@import "@fontsource/inter/latin-ext-400.css";
@import "@fontsource/inter/latin-ext-500.css";
@import "@fontsource/inter/latin-ext-600.css";
@import "@fontsource/inter/latin-ext-700.css";
@import "@fontsource/rajdhani/latin-500.css";
@import "@fontsource/rajdhani/latin-600.css";
@import "@fontsource/rajdhani/latin-700.css";
@import "@fontsource/jetbrains-mono/latin-400.css";
@import "@fontsource/jetbrains-mono/latin-500.css";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Typography
     - heading: Rajdhani (Eurostile-ish), used by .font-heading and h1-h6
     - sans: Inter for body
     - mono: JetBrains Mono for stat numerals (tabular numbers in tables) */
  --font-sans:    "Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  --font-heading: "Rajdhani", "Inter", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  --font-mono:    "JetBrains Mono", "Consolas", ui-monospace, monospace;

  /* Surface — deep charcoal/navy with cool blue tint (FM25 vibe) */
  --color-surface-50:  #f5f6fa;
  --color-surface-100: #e8eaf2;
  --color-surface-200: #c4c8d6;
  --color-surface-300: #9aa1b8;
  --color-surface-600: #353a55;
  --color-surface-700: #2a2f47;
  --color-surface-800: #1d2138;
  --color-surface-900: #14172a;
  --color-surface-950: #0a0c1a;

  /* Primary — FM25 signature violet */
  --color-primary-50:  #f4f1ff;
  --color-primary-100: #e6dfff;
  --color-primary-200: #d3c7ff;
  --color-primary-300: #b6a3ff;
  --color-primary-400: #9b82ff;
  --color-primary-500: #7c5cff;
  --color-primary-600: #6240e6;
  --color-primary-700: #4a2eb8;
  --color-primary-800: #38228c;
  --color-primary-900: #2b1a6e;

  /* Accent — bright lime for positive deltas, ratings */
  --color-accent-50:  #f8ffe1;
  --color-accent-100: #ecffb0;
  --color-accent-300: #d6ff3f;
  --color-accent-400: #c4f31e;
  --color-accent-500: #b8eb1c;
  --color-accent-600: #94c40d;
  --color-accent-700: #6b8b08;

  /* Semantic */
  --color-success-400: #4ade80;
  --color-success-500: #2ecc71;
  --color-success-600: #16a34a;
  --color-warn-500:    #f59e0b;
  --color-danger-500:  #ef4444;

  /* Rating gradient (player attribute cells) */
  --color-rating-elite: #2ecc71;
  --color-rating-good:  #b8eb1c;
  --color-rating-avg:   #f59e0b;
  --color-rating-poor:  #ef4444;

  /* --- BACK-COMPAT ALIASES — REMOVED IN PHASE 4 ---
     These keep ~50 files using bg-navy-* and text-primary-* working until
     they're migrated to surface-*. Do not introduce new uses of navy-*. */
  --color-navy-900: var(--color-surface-900);
  --color-navy-800: var(--color-surface-800);
  --color-navy-700: var(--color-surface-700);
  --color-navy-600: var(--color-surface-600);
}

@layer base {
  body {
    @apply bg-surface-50 text-surface-900 antialiased dark:bg-surface-900 dark:text-surface-100 transition-colors duration-300;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading);
  }
}

@layer utilities {
  .font-heading {
    font-family: var(--font-heading);
  }

  .font-stat {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .heading-tight {
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .heading-loose {
    letter-spacing: 0.10em;
    text-transform: uppercase;
  }

  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: var(--color-surface-600);
    border-radius: 9999px;
  }
}

/* Dark mode: fix native select/option dropdown backgrounds on Linux */
.dark select {
  color-scheme: dark;
}

.dark select option {
  background-color: var(--color-surface-700);
  color: #e2e8f0;
}

/* Dark mode readability: boost low-contrast gray text on charcoal backgrounds */
.dark .text-gray-500 {
  color: #8d99ae;
}

.dark .text-gray-400 {
  color: #a0aec0;
}

/* High-contrast mode: further boost for accessibility */
.high-contrast.dark .text-gray-500 {
  color: #b0bec5;
}

.high-contrast.dark .text-gray-400 {
  color: #cfd8dc;
}

.high-contrast.dark .text-gray-600 {
  color: #90a4ae;
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: clean (App.css is not type-checked, but if any TS file was relying on a missing color token, this surfaces it).

**Step 3: Run vite build**

Run: `npm run build`
Expected: build succeeds. Output `dist/assets/*.css` should contain `--color-primary-500: #7c5cff` (grep to confirm).

```bash
grep -E "primary-500: ?#7c5cff" dist/assets/*.css | head -1
```

**Step 4: Smoke test**

Run: `npm run dev`
Open http://localhost:1420. Expected: app renders, headings now in Rajdhani, primary buttons violet instead of green. Click around MainMenu and Dashboard — no broken layouts (legacy `navy-*` classes still resolving via aliases).

Stop the dev server.

**Step 5: Commit**

```bash
git add src/App.css
git commit -m "feat(theme): swap to FM25 charcoal + violet palette + Rajdhani heading"
```

---

### Task 1.3: Verify all existing tests still pass

**Files:**
- Run: `npm test`

**Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass. The compat alias keeps any test asserting on `bg-navy-700` working.

If any test fails because it asserted a hex color literal: that's a real test smell — note the file path, do NOT edit the test in this phase. Add it to a follow-up list for Phase 4.

**Step 2: If everything passes, no commit needed.** Move on.

---

## Phase 2 — Primitive components

Goal: refresh `Button`, `Card`, and create new `Tabs` + `StatRow` components, applying FM25 design language. Existing pages keep rendering through legacy classes; new code uses the refreshed primitives.

### Task 2.1: Refactor Button.tsx with FM25 variants

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Test: `src/components/ui/Button.test.tsx` (existing — extend, do not break)

**Step 1: Read existing test to understand the contract**

Run:
```bash
cat src/components/ui/Button.test.tsx
```

Note which assertions exist. Common ones: rendering children, applying disabled, click handlers. We must keep these passing.

**Step 2: Replace Button.tsx**

Replace `src/components/ui/Button.tsx` with:

```tsx
import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  icon,
  iconRight,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  // FM25 vibe: rounded-md (6px), uppercase heading font, inset highlight on
  // hover, primary glow on focus.
  const base =
    "inline-flex items-center justify-center gap-2 font-heading font-semibold uppercase tracking-wider rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-white border border-primary-700/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] focus:ring-primary-500",
    accent:
      "bg-accent-500 hover:bg-accent-400 active:bg-accent-600 text-surface-900 border border-accent-700/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] focus:ring-accent-500",
    ghost:
      "bg-transparent hover:bg-surface-700/60 text-surface-200 hover:text-white focus:ring-surface-300",
    outline:
      "bg-transparent border border-surface-600 hover:border-primary-400 text-surface-200 hover:text-white focus:ring-primary-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      {children}
      {iconRight && <span className="[&>svg]:w-4 [&>svg]:h-4">{iconRight}</span>}
    </button>
  );
}
```

**Step 3: Run Button tests**

Run: `npx vitest run src/components/ui/Button.test.tsx`
Expected: PASS. If a test fails because it asserts on a literal class name (e.g., `rounded-lg`), update the test to assert behavior (renders children, click fires handler) rather than implementation classes.

**Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 5: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat(ui): restyle Button with FM25 variants (rounded-md, inset highlight)"
```

---

### Task 2.2: Refactor Card.tsx for FM25 surface treatment

**Files:**
- Modify: `src/components/ui/Card.tsx`
- Test: `src/components/ui/Card.test.tsx`

**Step 1: Replace Card.tsx**

Replace `src/components/ui/Card.tsx` with:

```tsx
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /**
   * Visual emphasis. `primary`/`accent`/`success`/`danger` add a 2px left
   * border in that color (FM25 marks selected/active rows this way).
   * `none` is the default flat card.
   */
  accent?: "primary" | "accent" | "success" | "danger" | "none";
}

export function Card({ children, className = "", accent = "none" }: CardProps) {
  const accentBorder =
    accent === "none"
      ? "border border-surface-700/60"
      : {
          primary: "border-l-2 border-l-primary-500 border-y border-r border-surface-700/60",
          accent: "border-l-2 border-l-accent-500 border-y border-r border-surface-700/60",
          success: "border-l-2 border-l-success-500 border-y border-r border-surface-700/60",
          danger: "border-l-2 border-l-danger-500 border-y border-r border-surface-700/60",
        }[accent];

  return (
    <div
      className={`
        bg-white dark:bg-surface-800
        ${accentBorder}
        rounded-md
        shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
        transition-colors duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ children, action, className = "" }: CardHeaderProps) {
  return (
    <div
      className={`px-5 py-3 border-b border-surface-700/60 flex items-center justify-between ${className}`}
    >
      <h3 className="text-sm font-bold font-heading uppercase tracking-wider text-surface-100">
        {children}
      </h3>
      {action}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
```

**Step 2: Run Card tests**

Run: `npx vitest run src/components/ui/Card.test.tsx`
Expected: PASS. Update behavioral tests if they break on class literals.

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 4: Commit**

```bash
git add src/components/ui/Card.tsx
git commit -m "feat(ui): restyle Card with FM25 left-accent border + slim borders"
```

---

### Task 2.3: Create Tabs component (new)

**Files:**
- Create: `src/components/ui/Tabs.tsx`
- Create: `src/components/ui/Tabs.test.tsx`
- Modify: `src/components/ui/index.ts` (export the new component)

**Step 1: Write the failing test**

Create `src/components/ui/Tabs.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  const items = [
    { id: "squad", label: "Squad" },
    { id: "tactics", label: "Tactics" },
    { id: "fixtures", label: "Fixtures" },
  ];

  it("renders every tab label", () => {
    render(<Tabs items={items} activeId="squad" onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Squad" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tactics" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Fixtures" })).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected", () => {
    render(<Tabs items={items} activeId="tactics" onChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Tactics" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Squad" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("calls onChange with the tab id when clicked", () => {
    const onChange = vi.fn();
    render(<Tabs items={items} activeId="squad" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Fixtures" }));
    expect(onChange).toHaveBeenCalledWith("fixtures");
  });
});
```

**Step 2: Verify it fails**

Run: `npx vitest run src/components/ui/Tabs.test.tsx`
Expected: FAIL with "Cannot find module './Tabs'" or similar.

**Step 3: Implement Tabs.tsx**

Create `src/components/ui/Tabs.tsx`:

```tsx
import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * FM25-style tab bar: thin underline marker, uppercase Rajdhani labels,
 * primary color on the active tab. Used inside AppShell under the topbar
 * and inline within page bodies.
 */
export function Tabs({ items, activeId, onChange, className = "" }: TabsProps) {
  return (
    <div
      role="tablist"
      className={`flex gap-0 border-b border-surface-700/60 ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`
              px-4 py-2.5 -mb-px
              font-heading uppercase tracking-wider text-xs font-semibold
              border-b-2 transition-colors
              ${
                isActive
                  ? "text-white border-primary-500"
                  : "text-surface-200 hover:text-white border-transparent"
              }
              ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run src/components/ui/Tabs.test.tsx`
Expected: PASS (3 tests).

**Step 5: Export from index**

Modify `src/components/ui/index.ts`:

```ts
export { Card, CardHeader, CardBody } from "./Card";
export { Button } from "./Button";
export { Badge } from "./Badge";
export { ProgressBar } from "./ProgressBar";
export { CountryFlag } from "./CountryFlag";
export { TeamLocation } from "./TeamLocation";
export { ThemeToggle } from "./ThemeToggle";
export { DatePicker } from "./DatePicker";
export { Select } from "./Select";
export { Tabs, type TabItem } from "./Tabs";
```

**Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 7: Commit**

```bash
git add src/components/ui/Tabs.tsx src/components/ui/Tabs.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): add Tabs primitive with FM25 underline marker"
```

---

### Task 2.4: Create StatRow component (new)

**Files:**
- Create: `src/components/ui/StatRow.tsx`
- Create: `src/components/ui/StatRow.test.tsx`
- Modify: `src/components/ui/index.ts`

**Step 1: Write the failing test**

Create `src/components/ui/StatRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatRow, StatCell } from "./StatRow";

describe("StatRow", () => {
  it("renders children", () => {
    render(
      <StatRow>
        <StatCell>Player Name</StatCell>
        <StatCell numeric>42</StatCell>
      </StatRow>,
    );
    expect(screen.getByText("Player Name")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("applies font-stat to numeric cells", () => {
    render(
      <StatRow>
        <StatCell numeric data-testid="num">99</StatCell>
      </StatRow>,
    );
    expect(screen.getByTestId("num").className).toContain("font-stat");
  });
});
```

**Step 2: Verify it fails**

Run: `npx vitest run src/components/ui/StatRow.test.tsx`
Expected: FAIL ("Cannot find module './StatRow'").

**Step 3: Implement StatRow.tsx**

Create `src/components/ui/StatRow.tsx`:

```tsx
import type { ReactNode, HTMLAttributes } from "react";

interface StatRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * A row inside a stat table. FM25 tables are dense: small padding, hairline
 * dividers, hover highlight. Wrap StatCell children inside.
 */
export function StatRow({ children, className = "", ...rest }: StatRowProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 text-sm border-b border-surface-800 hover:bg-surface-800/50 transition-colors ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface StatCellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Right-align and use tabular numerals for numeric cells. */
  numeric?: boolean;
}

export function StatCell({ children, className = "", numeric, ...rest }: StatCellProps) {
  const numericClasses = numeric
    ? "font-stat text-right text-surface-100"
    : "text-surface-100";
  return (
    <div className={`${numericClasses} ${className}`} {...rest}>
      {children}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run src/components/ui/StatRow.test.tsx`
Expected: PASS (2 tests).

**Step 5: Export from index**

Add to `src/components/ui/index.ts`:

```ts
export { StatRow, StatCell } from "./StatRow";
```

**Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 7: Commit**

```bash
git add src/components/ui/StatRow.tsx src/components/ui/StatRow.test.tsx src/components/ui/index.ts
git commit -m "feat(ui): add StatRow + StatCell for dense FM25 stat tables"
```

---

### Task 2.5: Restyle DatePicker for FM25

**Files:**
- Modify: `src/components/ui/DatePicker.tsx`
- Test: `src/components/ui/DatePicker.test.tsx`

**Step 1: Update class strings only**

In `src/components/ui/DatePicker.tsx`, find the day input className (the input inside the day `<div className="flex-1">`). Replace its className with:

```tsx
className={`w-full bg-surface-900 border text-surface-100 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-primary-500/40 transition-colors placeholder:text-surface-200/40 text-center ${
  error
    ? "border-danger-500"
    : "border-surface-700 focus:border-primary-500"
}`}
```

Repeat the same className change for the year input.

For the month dropdown trigger button, replace its className with:

```tsx
className={`w-full flex items-center justify-between bg-surface-900 border text-left rounded-md p-2.5 outline-none transition-colors ${
  error
    ? "border-danger-500"
    : monthOpen
      ? "border-primary-500 ring-2 ring-primary-500/40"
      : "border-surface-700"
}`}
```

For the dropdown panel, replace with:

```tsx
className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-800 rounded-md shadow-xl border border-surface-700 overflow-hidden"
```

For each month option button, replace className with:

```tsx
className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
  month === m.value || month === m.value.padStart(2, "0")
    ? "bg-primary-500/15 text-primary-300"
    : "text-surface-100 hover:bg-surface-700"
}`}
```

**Step 2: Run DatePicker tests**

Run: `npx vitest run src/components/ui/DatePicker.test.tsx`
Expected: PASS. If a test asserts on a navy-* class literal, update to behavioral assertion.

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 4: Smoke test**

Run: `npm run dev`. Open MainMenu → Create Career → check the DatePicker visual: charcoal inputs, violet focus ring, dropdown matches.
Stop the dev server.

**Step 5: Commit**

```bash
git add src/components/ui/DatePicker.tsx
git commit -m "feat(ui): restyle DatePicker for FM25 surface treatment"
```

---

### Task 2.6: Final phase 2 verification

**Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass.

**Step 2: Production build**

Run: `npm run build`
Expected: build succeeds, no TS errors, no warnings about missing CSS variables.

**Step 3: Browser smoke test**

Run: `npm run dev`. Visit MainMenu, click through Create → World Select. Buttons should be violet, cards should have left-accent borders, DatePicker should be charcoal-themed. Click around Dashboard tabs once you're in a save.
Stop the dev server.

No commit if no changes — Phase 2 is done.

---

## Phase 3 — Layout shell

Goal: introduce FM25-style topbar + sidebar shell. Wrap Dashboard and MatchSimulation.

### Task 3.1: Create AppShell layout component

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/index.ts`

**Step 1: Create the layout dir**

Run: `mkdir -p src/components/layout`

**Step 2: Implement AppShell**

Create `src/components/layout/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";

interface AppShellProps {
  topbar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * FM25 in-game frame: 56px topbar across the full width, 56px icon-rail
 * sidebar on the left, scrollable main content fills the rest.
 *
 * Intended for in-game pages (Dashboard, MatchSimulation). Pre-game pages
 * like MainMenu use a centered card layout instead.
 */
export function AppShell({ topbar, sidebar, children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-surface-900 text-surface-100">
      <header className="h-14 bg-surface-900 border-b border-surface-700/60 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)] flex items-center px-4">
        {topbar}
      </header>
      <div className="flex flex-1 min-h-0">
        <nav className="w-14 bg-surface-900 border-r border-surface-700/60 flex flex-col items-center py-3 gap-1">
          {sidebar}
        </nav>
        <main className="flex-1 overflow-y-auto bg-surface-900">{children}</main>
      </div>
    </div>
  );
}
```

**Step 3: Create index export**

Create `src/components/layout/index.ts`:

```ts
export { AppShell } from "./AppShell";
export { Topbar } from "./Topbar";
export { Sidebar, type SidebarItem } from "./Sidebar";
```

(Topbar and Sidebar created in next tasks; the index is set up now so later commits don't need to touch it again.)

**Step 4: Type check (will fail temporarily)**

Run: `npx tsc --noEmit`
Expected: FAIL with "Cannot find module './Topbar'" — that's fine. Next tasks fix it.

**Step 5: Don't commit yet** — finish the trio first.

---

### Task 3.2: Create Topbar component

**Files:**
- Create: `src/components/layout/Topbar.tsx`
- Create: `src/components/layout/Topbar.test.tsx`

**Step 1: Write the failing test**

Create `src/components/layout/Topbar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Topbar } from "./Topbar";

describe("Topbar", () => {
  it("renders team name and date", () => {
    render(
      <Topbar
        teamName="Test FC"
        gameDate="15 May 2026"
        financeDisplay="£12,345,000"
        onContinue={() => {}}
      />,
    );
    expect(screen.getByText("Test FC")).toBeInTheDocument();
    expect(screen.getByText("15 May 2026")).toBeInTheDocument();
    expect(screen.getByText("£12,345,000")).toBeInTheDocument();
  });

  it("renders Continue button when onContinue provided", () => {
    render(
      <Topbar
        teamName="Test FC"
        gameDate="15 May 2026"
        financeDisplay="£0"
        onContinue={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });
});
```

**Step 2: Verify it fails**

Run: `npx vitest run src/components/layout/Topbar.test.tsx`
Expected: FAIL ("Cannot find module './Topbar'").

**Step 3: Implement Topbar**

Create `src/components/layout/Topbar.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

interface TopbarProps {
  teamName: string;
  /** Pre-formatted human-readable date, e.g. "15 May 2026". */
  gameDate: string;
  /** Pre-formatted finance balance, color-styled by caller via className. */
  financeDisplay: string;
  /** Caller-provided color class for the finance text. Defaults to neutral. */
  financeColorClass?: string;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** Optional crest slot. Caller renders an <img> or icon. */
  crest?: React.ReactNode;
}

/**
 * FM25-style top bar. Always shows team name + date + finance, and a Continue
 * CTA pinned to the right corner — that button is the FM trademark.
 */
export function Topbar({
  teamName,
  gameDate,
  financeDisplay,
  financeColorClass = "text-surface-100",
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  crest,
}: TopbarProps) {
  return (
    <div className="flex items-center justify-between w-full gap-6">
      <div className="flex items-center gap-3 min-w-0">
        {crest && <div className="w-7 h-7 flex-shrink-0">{crest}</div>}
        <span className="font-heading uppercase tracking-wider text-sm font-semibold text-white truncate">
          {teamName}
        </span>
      </div>

      <div className="flex items-center gap-6 flex-shrink-0">
        <span className="font-heading uppercase tracking-wider text-xs text-surface-200">
          {gameDate}
        </span>
        <span className={`font-stat text-sm font-semibold ${financeColorClass}`}>
          {financeDisplay}
        </span>
      </div>

      {onContinue && (
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={continueDisabled}
          iconRight={<ChevronRight />}
        >
          {continueLabel}
        </Button>
      )}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run src/components/layout/Topbar.test.tsx`
Expected: PASS (2 tests).

---

### Task 3.3: Create Sidebar component

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Sidebar.test.tsx`

**Step 1: Write the failing test**

Create `src/components/layout/Sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Users, Settings as SettingsIcon } from "lucide-react";
import { Sidebar, type SidebarItem } from "./Sidebar";

describe("Sidebar", () => {
  const items: SidebarItem[] = [
    { id: "squad", label: "Squad", icon: <Users data-testid="users-icon" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon data-testid="settings-icon" /> },
  ];

  it("renders an icon button per item with accessible label", () => {
    render(<Sidebar items={items} activeId="squad" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Squad" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("invokes onSelect with the id when clicked", () => {
    const onSelect = vi.fn();
    render(<Sidebar items={items} activeId="squad" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onSelect).toHaveBeenCalledWith("settings");
  });
});
```

**Step 2: Verify it fails**

Run: `npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: FAIL ("Cannot find module './Sidebar'").

**Step 3: Implement Sidebar**

Create `src/components/layout/Sidebar.tsx`:

```tsx
import type { ReactNode } from "react";

export interface SidebarItem {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Vertical icon-rail navigation. The label is exposed via aria-label and a
 * native title tooltip. Active item gets a primary tint background and a
 * left border accent (FM25 trademark).
 */
export function Sidebar({ items, activeId, onSelect }: SidebarProps) {
  return (
    <>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            title={item.label}
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            className={`
              w-10 h-10 rounded-md flex items-center justify-center
              transition-colors
              [&>svg]:w-5 [&>svg]:h-5
              ${
                isActive
                  ? "bg-primary-500/15 text-primary-300 border border-primary-500/40"
                  : "text-surface-200 hover:text-white hover:bg-surface-700"
              }
              ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
            `}
          >
            {item.icon}
          </button>
        );
      })}
    </>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: PASS (2 tests).

**Step 5: Type check (Topbar + Sidebar + AppShell + index now all exist)**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 6: Commit the layout trio**

```bash
git add src/components/layout
git commit -m "feat(layout): add AppShell + Topbar + Sidebar primitives"
```

---

### Task 3.4: Wrap Dashboard with AppShell

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Read current Dashboard to find existing tabs and CTA**

Run: `head -60 src/pages/Dashboard.tsx` and scan for the existing tab bar and Continue button. Note where the page-level tab list lives — the goal is to lift it directly under the topbar.

**Step 2: Wrap the page**

Replace the top-level `return ()` JSX of `Dashboard.tsx` with this skeleton (keeping the existing tab content rendering untouched):

```tsx
import { AppShell, Topbar, Sidebar, type SidebarItem } from "../components/layout";
import { Tabs, type TabItem } from "../components/ui/Tabs";
import {
  Users,
  Activity,
  Calendar,
  ArrowLeftRight,
  Search,
  Dumbbell,
  Wallet,
  Inbox,
  Newspaper,
  Settings as SettingsIcon,
} from "lucide-react";
```

Keep the existing tab state hook (likely `useState<"squad" | "tactics" | ...>`). Then in the JSX:

```tsx
const sidebarItems: SidebarItem[] = [
  { id: "squad", label: "Squad", icon: <Users /> },
  { id: "tactics", label: "Tactics", icon: <Activity /> },
  { id: "fixtures", label: "Fixtures", icon: <Calendar /> },
  { id: "transfers", label: "Transfers", icon: <ArrowLeftRight /> },
  { id: "scouting", label: "Scouting", icon: <Search /> },
  { id: "training", label: "Training", icon: <Dumbbell /> },
  { id: "finances", label: "Finances", icon: <Wallet /> },
  { id: "inbox", label: "Inbox", icon: <Inbox /> },
  { id: "news", label: "News", icon: <Newspaper /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
];

const tabItems: TabItem[] = sidebarItems.map(({ id, label }) => ({ id, label }));

return (
  <AppShell
    topbar={
      <Topbar
        teamName={teamName}
        gameDate={formattedDate}
        financeDisplay={formattedBalance}
        onContinue={handleAdvanceTime}
        continueDisabled={isAdvancing}
      />
    }
    sidebar={<Sidebar items={sidebarItems} activeId={activeTab} onSelect={setActiveTab} />}
  >
    <div className="px-6 py-3 border-b border-surface-700/60 bg-surface-900">
      <Tabs items={tabItems} activeId={activeTab} onChange={setActiveTab} />
    </div>
    <div className="p-6 max-w-screen-2xl mx-auto">
      {/* existing tab content render here */}
    </div>
  </AppShell>
);
```

Adapt the variable names (`teamName`, `formattedDate`, `formattedBalance`, `handleAdvanceTime`, `isAdvancing`, `activeTab`, `setActiveTab`) to whatever the existing Dashboard already uses. Do NOT introduce new state — reuse what's there.

**Step 3: Run Dashboard tests**

Run: `npx vitest run src/pages/Dashboard.test.tsx`
Expected: tests that asserted on chrome (e.g. "renders top header with team") may need their selectors updated. Tests that assert on tab content (e.g. "shows squad list") should still pass.

**Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 5: Smoke test**

Run: `npm run dev`. Open a save → Dashboard. Verify topbar + sidebar render, tab switch works, content scrolls in main pane only (not the whole page).
Stop the dev server.

**Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(layout): wrap Dashboard with FM25 AppShell"
```

---

### Task 3.5: Wrap MatchSimulation with AppShell

**Files:**
- Modify: `src/pages/MatchSimulation.tsx`

**Step 1: Read the page**

Run: `head -50 src/pages/MatchSimulation.tsx`. MatchSimulation typically has different states (pre-match setup, live, half-time, post-match). Identify which states should show the shell.

**Step 2: Wrap conditionally**

Wrap the pre-match and post-match views in `<AppShell>` with the same Topbar/Sidebar as Dashboard. Live match view stays fullscreen — wrap only its container in `<div className="bg-surface-900 min-h-screen">` so it gets the new background.

If the page receives `team`, `date`, `balance` from the gameStore, reuse those for Topbar. Disable `onContinue` (live match has its own controls).

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 4: Run MatchSimulation tests**

Run: `npx vitest run src/pages/MatchSimulation.test.tsx`
Expected: PASS (or behavioral updates only).

**Step 5: Smoke test**

Run: `npm run dev`. Trigger a match, walk through pre-match → live → post-match. Verify the chrome shows in pre/post but live takes the full pane.
Stop the dev server.

**Step 6: Commit**

```bash
git add src/pages/MatchSimulation.tsx
git commit -m "feat(layout): wrap MatchSimulation pre/post views with AppShell"
```

---

### Task 3.6: Phase 3 verification

**Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass.

**Step 2: Production build**

Run: `npm run build`
Expected: build succeeds.

**Step 3: Manual smoke**

Open the app, navigate Main Menu → Create → Select Team → Dashboard → Match → back. Every screen should render correctly.

No commit needed; phase complete.

---

## Phase 4 — Polish

Goal: rating helper, stat-table polish, form badges, drop legacy aliases, contrast audit.

### Task 4.1: Add ratings helper

**Files:**
- Create: `src/lib/ratings.ts`
- Create: `src/lib/ratings.test.ts`

**Step 1: Write the failing test**

Create `src/lib/ratings.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ratingClass } from "./ratings";

describe("ratingClass", () => {
  it("returns elite class for 85+", () => {
    expect(ratingClass(85)).toBe("rating-cell-elite");
    expect(ratingClass(99)).toBe("rating-cell-elite");
  });

  it("returns good class for 70-84", () => {
    expect(ratingClass(70)).toBe("rating-cell-good");
    expect(ratingClass(84)).toBe("rating-cell-good");
  });

  it("returns avg class for 50-69", () => {
    expect(ratingClass(50)).toBe("rating-cell-avg");
    expect(ratingClass(69)).toBe("rating-cell-avg");
  });

  it("returns poor class below 50", () => {
    expect(ratingClass(0)).toBe("rating-cell-poor");
    expect(ratingClass(49)).toBe("rating-cell-poor");
  });
});
```

**Step 2: Verify it fails**

Run: `npx vitest run src/lib/ratings.test.ts`
Expected: FAIL ("Cannot find module './ratings'").

**Step 3: Implement**

Create `src/lib/ratings.ts`:

```ts
/**
 * Map a 0-100 player attribute or rating to a CSS class that color-grades the
 * cell. The class names match utilities defined in App.css's @layer utilities
 * block (added in this task).
 */
export type RatingClass =
  | "rating-cell-elite"
  | "rating-cell-good"
  | "rating-cell-avg"
  | "rating-cell-poor";

export function ratingClass(value: number): RatingClass {
  if (value >= 85) return "rating-cell-elite";
  if (value >= 70) return "rating-cell-good";
  if (value >= 50) return "rating-cell-avg";
  return "rating-cell-poor";
}
```

**Step 4: Add the CSS utilities**

In `src/App.css`, inside the existing `@layer utilities` block (after `.heading-loose`), add:

```css
.rating-cell-poor  { background: color-mix(in srgb, var(--color-rating-poor) 15%, transparent); color: var(--color-rating-poor); border: 1px solid color-mix(in srgb, var(--color-rating-poor) 30%, transparent); }
.rating-cell-avg   { background: color-mix(in srgb, var(--color-rating-avg) 15%, transparent);  color: var(--color-rating-avg);  border: 1px solid color-mix(in srgb, var(--color-rating-avg) 30%, transparent); }
.rating-cell-good  { background: color-mix(in srgb, var(--color-rating-good) 15%, transparent); color: var(--color-rating-good); border: 1px solid color-mix(in srgb, var(--color-rating-good) 30%, transparent); }
.rating-cell-elite { background: color-mix(in srgb, var(--color-rating-elite) 15%, transparent); color: var(--color-rating-elite); border: 1px solid color-mix(in srgb, var(--color-rating-elite) 30%, transparent); }
```

**Step 5: Run tests**

Run: `npx vitest run src/lib/ratings.test.ts`
Expected: PASS (4 tests).

**Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 7: Commit**

```bash
git add src/lib/ratings.ts src/lib/ratings.test.ts src/App.css
git commit -m "feat(ui): add ratingClass helper + color-graded rating cells"
```

---

### Task 4.2: Apply font-stat to existing stat tables

**Files:**
- Modify: existing tab/component files that render numeric tables (SquadTab, FinancesTab, transfer log, fixture list)

**Step 1: Find candidate files**

Run:
```bash
grep -rln "font-mono\|tabular-nums" src/components/
```

Each match is a candidate. Also identify columns in tables that show numbers (player attributes, age, wage, fee) that don't yet have these classes.

**Step 2: For each table file, add `font-stat` class to numeric `<td>`/`<div>` cells**

Pattern: where you see something like `<td className="text-right">{player.age}</td>`, change to `<td className="text-right font-stat">{player.age}</td>`.

Apply to: age, OVR, wage, fee, market value, possession %, goals, assists, etc. Skip text columns (names, dates).

Limit: this task is "10 minutes of grep + apply". Don't refactor table layouts — just add the class.

**Step 3: Run tests**

Run: `npm test`
Expected: PASS.

**Step 4: Smoke test**

Run: `npm run dev`. Verify Squad table numbers render in monospace (notice the "1" and "0" align).
Stop the dev server.

**Step 5: Commit**

```bash
git add -u src/components
git commit -m "feat(ui): apply font-stat to numeric cells in stat tables"
```

---

### Task 4.3: Add form badge utility

**Files:**
- Modify: `src/App.css`

**Step 1: Add utility classes**

In `src/App.css`, inside the same `@layer utilities` block (after the rating cells from Task 4.1), add:

```css
.form-badge {
  display: inline-flex;
  width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  font-family: var(--font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  border: 1px solid;
}
.form-badge-w {
  background: color-mix(in srgb, var(--color-success-500) 20%, transparent);
  color: var(--color-success-500);
  border-color: color-mix(in srgb, var(--color-success-500) 40%, transparent);
}
.form-badge-d {
  background: color-mix(in srgb, var(--color-warn-500) 20%, transparent);
  color: var(--color-warn-500);
  border-color: color-mix(in srgb, var(--color-warn-500) 40%, transparent);
}
.form-badge-l {
  background: color-mix(in srgb, var(--color-danger-500) 20%, transparent);
  color: var(--color-danger-500);
  border-color: color-mix(in srgb, var(--color-danger-500) 40%, transparent);
}
```

**Step 2: Apply to one form display first**

Find an existing form display (likely `src/components/league/StandingsTable.tsx` or a recent form column in SquadTab). Replace ad-hoc rendering with:

```tsx
<span className={`form-badge form-badge-${result.toLowerCase()}`}>
  {result}
</span>
```

where `result` is `"W" | "D" | "L"`.

**Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 4: Commit**

```bash
git add src/App.css src/components
git commit -m "feat(ui): add W-D-L form-badge utility + first usage"
```

---

### Task 4.4: Migrate residual navy-* references and remove aliases

**Files:**
- Modify: any file under `src/` that uses `navy-*` Tailwind classes
- Modify: `src/App.css` (drop the alias block)

**Step 1: Find all references**

Run:
```bash
grep -rln "\(bg\|text\|border\|ring\|shadow\|hover:bg\|hover:text\|focus:ring\|focus:border\|dark:bg\|dark:text\|dark:border\)-navy-" src/
```

**Step 2: Bulk-replace navy-* → surface-***

For each file from the grep output, replace:

- `navy-900` → `surface-900`
- `navy-800` → `surface-800`
- `navy-700` → `surface-700`
- `navy-600` → `surface-600`

Run:
```bash
node -e "
const fs = require('node:fs');
const path = require('node:path');
const targets = require('child_process').execSync('grep -rl \"navy-\" src/', {encoding:'utf8'}).split('\n').filter(Boolean);
for (const f of targets) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replaceAll('navy-900', 'surface-900');
  s = s.replaceAll('navy-800', 'surface-800');
  s = s.replaceAll('navy-700', 'surface-700');
  s = s.replaceAll('navy-600', 'surface-600');
  fs.writeFileSync(f, s);
}
console.log('Migrated', targets.length, 'files');
"
```

**Step 3: Delete the alias block from App.css**

In `src/App.css`, remove the four `--color-navy-*` lines (the back-compat alias block).

**Step 4: Verify nothing else uses navy**

Run: `grep -rn "navy-" src/`
Expected: NO matches (except possibly comments). If matches remain, fix them by hand.

**Step 5: Run tests**

Run: `npm test`
Expected: PASS. Tests asserting on the old class names will need updates if any remain — convert to behavioral assertions.

**Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: clean.

**Step 7: Build**

Run: `npm run build`
Expected: clean.

**Step 8: Smoke test**

Run: `npm run dev`. Visit MainMenu, Dashboard, MatchSimulation, Settings. Nothing should look broken.
Stop the dev server.

**Step 9: Commit**

```bash
git add -u src/
git commit -m "refactor(theme): migrate navy-* tokens to surface-* + drop aliases"
```

---

### Task 4.5: WCAG contrast audit

**Files:**
- Inspection only.

**Step 1: List the text/bg pairs to verify**

The pairs that matter:

| Foreground | Background | Min ratio (AA) |
|---|---|---|
| `surface-100 (#e8eaf2)` | `surface-900 (#14172a)` | 4.5:1 |
| `surface-200 (#c4c8d6)` | `surface-900 (#14172a)` | 4.5:1 |
| `primary-300 (#b6a3ff)` | `surface-900 (#14172a)` | 4.5:1 |
| `primary-500 (#7c5cff)` | `white` (button text) | 4.5:1 |
| `accent-500 (#b8eb1c)` | `surface-900 (#14172a)` | 4.5:1 |
| `success-500 (#2ecc71)` | `surface-900 (#14172a)` | 3:1 (UI element) |
| `danger-500 (#ef4444)` | `surface-900 (#14172a)` | 3:1 |

**Step 2: Verify in browser DevTools**

Open the deployed dev server. Use Chrome DevTools → Inspect → Accessibility panel → Contrast checker on a representative element of each pair (sample one button, one card title, one form badge). All should report AA pass.

If any pair fails, adjust the lighter color in `App.css` (e.g. lighten `primary-300` from `#b6a3ff` to `#c8b8ff`).

**Step 3: Document the result**

Add a short note at the bottom of `docs/plans/2026-05-15-fm25-redesign-design.md`:

```markdown
## Verification log

- 2026-05-15: Manual WCAG AA contrast audit passed for all text/bg pairs listed in Phase 4 task 4.5.
```

**Step 4: Commit**

```bash
git add docs/plans/2026-05-15-fm25-redesign-design.md
git commit -m "docs(design): record WCAG contrast audit pass"
```

---

### Task 4.6: Final integration verification

**Step 1: Full test suite**

Run: `npm test`
Expected: all green.

**Step 2: Production build**

Run: `npm run build`
Expected: clean.

**Step 3: Verify CSS bundle does not contain navy aliases**

Run: `grep -c "navy" dist/assets/*.css || echo "no matches"`
Expected: "no matches" (or 0).

**Step 4: Final smoke**

Run: `npm run preview`. Click through every page (MainMenu, TeamSelection, Dashboard each tab, MatchSimulation each phase, Settings). Confirm:

- Buttons are violet (primary) or lime (accent).
- Headings are Rajdhani uppercase.
- Numbers in tables align in tabular numerals.
- DatePicker focus ring is violet.
- Sidebar active item has violet tint background.

**Step 5: Tag the redesign**

```bash
git tag fm25-ui-v1
```

Phase 4 done. Plan complete.

---

## Plan complete

Plan saved to `docs/plans/2026-05-15-fm25-redesign-implementation.md` (this file). Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** — open a new session with `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
