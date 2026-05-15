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
