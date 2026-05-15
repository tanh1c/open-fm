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
      "bg-accent-400 hover:bg-accent-500 active:bg-accent-600 text-surface-900 border border-accent-700/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] focus:ring-accent-500",
    ghost:
      "bg-transparent hover:bg-surface-700/60 text-surface-200 hover:text-white focus:ring-surface-300",
    outline:
      "bg-transparent border-2 border-surface-600 hover:border-primary-400 text-surface-200 hover:text-white focus:ring-primary-500",
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
