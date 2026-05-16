import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./templateUtils";

export function TemplateCard({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={cn("bg-app-card rounded-xl border border-app-border overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function TemplateCardHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-5 py-4 flex items-center justify-between border-b border-app-border/50", className)}>
      <h2 className="text-[11px] font-bold text-app-text-muted tracking-widest uppercase">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}
