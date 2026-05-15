import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "primary" | "accent" | "success" | "danger" | "neutral";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "neutral", size = "sm", className = "" }: BadgeProps) {
  const variants = {
    primary: "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
    accent: "bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-400",
    success: "bg-green-100 text-green-700 dark:bg-success-500/20 dark:text-success-400",
    danger: "bg-red-100 text-red-700 dark:bg-danger-500/20 dark:text-danger-500",
    neutral: "bg-gray-100 text-gray-600 dark:bg-surface-600 dark:text-surface-200",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center font-bold font-heading uppercase tracking-wider rounded-md ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}
