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
