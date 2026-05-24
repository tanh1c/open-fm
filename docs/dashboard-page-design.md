# Dashboard Page Design Guide

This guide captures the shared UI language used by the newer dashboard pages: Transfers, Scouting, and Tactics. Use it when redesigning dashboard content pages so each feature feels like part of the same Football Manager-style application shell.

## Page shell

- Use a centered content container with a large max width: `max-w-[1600px]` or `max-w-[1700px]`.
- Use vertical rhythm with `flex flex-col gap-4` and `min-h-max`.
- Keep dense management screens inside a fixed-height workspace when the page has side panels: `h-[800px] xl:h-[750px]`.
- Scroll inside panels and tables, not the full page, when the content is a management workspace.

## Header

- Put the page title and subtitle at the top left.
- Titles are compact, uppercase, and bold: `text-xl font-bold tracking-tight text-app-text`.
- Subtitles are muted and descriptive: `text-sm text-app-text-muted`.
- Place page actions on the right in a wrapping row: `flex flex-wrap items-center gap-3`.
- Primary actions use green: `bg-app-green text-app-bg font-bold hover:bg-app-green/90`.
- Secondary actions use card styling: `border border-app-border bg-app-card hover:bg-white/5`.

## Tabs

- Use a border-bottom tab row below the header.
- Tab row: `mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-app-border/50 px-2`.
- Active tab: `border-b-2 border-app-green text-app-green font-semibold`.
- Inactive tab: `text-app-text-muted hover:text-white font-medium`.

## Workspace layout

Use the same three-zone structure where possible:

1. Left insight rail
   - Width: `xl:w-[280px]`.
   - Hidden on narrow screens when necessary.
   - Use stacked summary and control cards.
2. Center primary module
   - `flex-1 min-w-0 h-full`.
   - Contains the main interactive controls, search/filter card, table, pitch, or work surface.
3. Right detail rail
   - Width: `xl:w-[360px]` or `xl:w-[420px]` depending on density.
   - Contains selected item details, reports, risk panels, or contextual actions.

Bottom dashboard cards can be added under the workspace with `grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-4`.

## Cards and sections

- Standard card: `rounded-xl border border-app-border bg-app-card`.
- Nested surfaces use `bg-app-bg`, `bg-black/10`, or subtle white overlays.
- Section labels are small uppercase: `text-[10px] font-bold uppercase tracking-widest text-app-text-muted`.
- Highlight values with `text-app-green`; warning states use amber/red token classes.
- Prefer compact padding (`p-3`, `p-4`) and dense typography (`text-xs`, `text-[11px]`) for management data.

## Tables and lists

- Use compact text: `text-[11px]`.
- Header rows use uppercase muted labels: `text-[9px] font-bold uppercase tracking-wider text-app-text-muted`.
- Use `divide-y divide-app-border/30` for row separation.
- Hover states should be subtle: `hover:bg-white/5`.
- Sticky headers are preferred in scrollable tables: `sticky top-0 z-10 bg-app-card`.
- Wrap wide tables in `overflow-x-auto custom-scrollbar`.

## Forms and controls

- Inputs and selects should sit on `bg-app-bg` with `border-app-border` and focus green borders.
- Compact dropdowns/buttons should match the page cards instead of using old gray/surface styling.
- Use rounded badges/chips for filters and state summaries.
- Avoid fake controls: if a tab or button is visible, it should either perform an action or clearly represent current state.

## Responsive behavior

- Let header actions wrap instead of overflowing.
- Hide side rails on smaller screens before shrinking the primary module too far.
- Keep the center content usable at all sizes.
- Avoid horizontal scrollbars for navigation rows; wrap tabs when needed.
