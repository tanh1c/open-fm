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
      ? ""
      : {
          primary: "border-l-2 border-l-app-green",
          accent: "border-l-2 border-l-app-green",
          success: "border-l-2 border-l-success-500",
          danger: "border-l-2 border-l-app-red",
        }[accent];

  return (
    <div
      className={`
        bg-app-card
        border border-app-border
        rounded-xl
        overflow-hidden
        transition-colors duration-200
        ${accentBorder}
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
      className={`px-5 py-4 border-b border-app-border/50 flex items-center justify-between ${className}`}
    >
      <h3 className="text-[11px] font-bold text-app-text-muted tracking-widest uppercase">
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
