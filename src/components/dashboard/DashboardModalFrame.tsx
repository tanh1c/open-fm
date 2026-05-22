import type { JSX, ReactNode } from "react";

interface DashboardModalFrameProps {
  children: ReactNode;
  maxWidthClassName: string;
}

export default function DashboardModalFrame({
  children,
  maxWidthClassName,
}: DashboardModalFrameProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={`mx-4 w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-navy-600 dark:bg-navy-800 ${maxWidthClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
