import type { ReactNode } from "react";

import { ThemeToggle } from "../ui";

export function MatchPageAction({
  children,
  onClick,
  variant = "secondary",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClasses(
        "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
        variant === "primary"
          ? "bg-app-green text-app-bg hover:bg-app-green/90"
          : "border border-app-border bg-app-card text-app-text-muted hover:bg-white/5 hover:text-app-text",
      )}
    >
      {children}
    </button>
  );
}

interface MatchScreenLayoutProps {
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  header?: ReactNode;
  headerClassName?: string;
  headerContentClassName?: string;
  pageActions?: ReactNode;
  pageSubtitle?: ReactNode;
  pageTitle?: string;
  showThemeToggle?: boolean;
  themeToggleClassName?: string;
}

function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export default function MatchScreenLayout({
  children,
  contentClassName,
  footer,
  header,
  headerClassName,
  headerContentClassName,
  pageActions,
  pageSubtitle,
  pageTitle,
  showThemeToggle = true,
  themeToggleClassName,
}: MatchScreenLayoutProps) {
  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <div className="mx-auto flex min-h-screen max-w-[1700px] flex-col gap-4 px-4 py-4 sm:px-6">
        {(pageTitle || pageSubtitle || pageActions || showThemeToggle) && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {pageTitle ? (
                <h1 className="font-heading text-xl font-bold uppercase tracking-tight text-app-text">
                  {pageTitle}
                </h1>
              ) : null}
              {pageSubtitle ? (
                <div className="mt-1 text-sm text-app-text-muted">{pageSubtitle}</div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {pageActions}
              {showThemeToggle && <ThemeToggle className={themeToggleClassName} />}
            </div>
          </div>
        )}

        {header && (
          <header
            className={joinClasses(
              "rounded-xl border border-app-border bg-app-card shadow-lg shadow-black/10",
              headerClassName,
            )}
          >
            <div className={joinClasses("relative w-full", headerContentClassName)}>
              {header}
            </div>
          </header>
        )}

        <div className={joinClasses("min-h-0 flex-1", contentClassName)}>{children}</div>

        {footer}
      </div>
    </div>
  );
}
