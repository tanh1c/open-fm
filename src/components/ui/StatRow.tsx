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
