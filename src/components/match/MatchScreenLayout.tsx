import type { ReactNode } from "react";

import { ThemeToggle } from "../ui";

interface MatchScreenLayoutProps {
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  header?: ReactNode;
  headerClassName?: string;
  headerContentClassName?: string;
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
  showThemeToggle = true,
  themeToggleClassName,
}: MatchScreenLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-app-bg text-app-text">
      {header && (
        <header
          className={joinClasses(
            "border-b border-app-border bg-app-card/95 shadow-lg shadow-black/20",
            headerClassName,
          )}
        >
          <div
            className={joinClasses(
              "relative mx-auto w-full max-w-[1700px] px-4 sm:px-6",
              headerContentClassName,
            )}
          >
            <div className={showThemeToggle ? "pr-14" : undefined}>{header}</div>
            {showThemeToggle && (
              <ThemeToggle
                className={joinClasses(
                  "absolute right-4 top-4 sm:right-6",
                  themeToggleClassName,
                )}
              />
            )}
          </div>
        </header>
      )}

      <div className={joinClasses("min-h-0 flex-1", contentClassName)}>{children}</div>

      {footer}
    </div>
  );
}
