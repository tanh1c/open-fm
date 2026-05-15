import type { ReactNode } from "react";
import { Search, Bell, Mail, HelpCircle, Star, CalendarDays, Trophy } from "lucide-react";

interface TopbarV2Props {
  /** Optional logo node (icon + brand name). Caller composes it so the brand
   * string isn't baked into a generic component. */
  logo?: ReactNode;
  seasonLabel: string;
  seasonDate: string;
  reputationLabel: string;
  /** 0-5 stars filled. */
  reputationStars: number;
  managerName: string;
  managerRole: string;
  /** Optional avatar slot — caller renders an <img> or <Initial>. */
  managerAvatar?: ReactNode;
  unreadCount: number;
  onLogoClick?: () => void;
  onSearch?: (query: string) => void;
  onInbox?: () => void;
  onHelp?: () => void;
  onNotifications?: () => void;
}

/**
 * FM25-style topbar. Pinned to the top of an in-game page, sitting above the
 * sidebar+content split below.
 */
export function TopbarV2({
  logo,
  seasonLabel,
  seasonDate,
  reputationLabel,
  reputationStars,
  managerName,
  managerRole,
  managerAvatar,
  unreadCount,
  onLogoClick,
  onSearch,
  onInbox,
  onHelp,
  onNotifications,
}: TopbarV2Props) {
  return (
    <header className="h-16 bg-surface-900 border-b border-surface-700/60 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)] flex items-center px-4 gap-4">
      {logo !== undefined && (
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-2 font-heading uppercase tracking-wider text-base font-bold text-white hover:text-primary-300 transition-colors flex-shrink-0"
        >
          {logo}
        </button>
      )}

      <StatusPill
        icon={<CalendarDays />}
        primary={seasonLabel}
        secondary={seasonDate}
      />

      <StatusPill
        icon={<Trophy />}
        primary="Club Reputation"
        secondary={reputationLabel}
        trailing={<StarRow filled={reputationStars} />}
      />

      <div className="flex-1 min-w-0 max-w-xl mx-auto">
        <SearchBox onChange={onSearch} />
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <IconButton
          ariaLabel="Notifications"
          onClick={onNotifications}
          badge={unreadCount}
        >
          <Bell />
        </IconButton>
        <IconButton ariaLabel="Inbox" onClick={onInbox}>
          <Mail />
        </IconButton>
        <IconButton ariaLabel="Help" onClick={onHelp}>
          <HelpCircle />
        </IconButton>
      </div>

      <div className="flex items-center gap-3 pl-3 border-l border-surface-700/60 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center overflow-hidden">
          {managerAvatar ?? (
            <span className="text-xs font-stat font-semibold text-surface-200">
              {managerName
                .split(" ")
                .map((part) => part[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")}
            </span>
          )}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-heading uppercase tracking-wider text-white truncate max-w-40">
            {managerName}
          </span>
          <span className="text-xs text-surface-200">{managerRole}</span>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface StatusPillProps {
  icon?: ReactNode;
  primary: string;
  secondary: string;
  trailing?: ReactNode;
}

function StatusPill({ icon, primary, secondary, trailing }: StatusPillProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 border border-surface-700/60 rounded-md flex-shrink-0">
      {icon && (
        <span className="[&>svg]:w-4 [&>svg]:h-4 text-surface-200">{icon}</span>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-heading uppercase tracking-wider text-surface-200">
          {primary}
        </span>
        <span className="text-xs font-heading font-semibold text-white">
          {secondary}
        </span>
      </div>
      {trailing && <span className="ml-1">{trailing}</span>}
    </div>
  );
}

function StarRow({ filled }: { filled: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(filled)));
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${
            i < clamped ? "fill-accent-500 text-accent-500" : "text-surface-600"
          }`}
        />
      ))}
    </span>
  );
}

interface SearchBoxProps {
  onChange?: (query: string) => void;
}

function SearchBox({ onChange }: SearchBoxProps) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 border border-surface-700/60 rounded-md focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/40 transition-colors">
      <Search className="w-4 h-4 text-surface-200 flex-shrink-0" />
      <input
        type="search"
        placeholder="Search players, staff, competitions..."
        onChange={(e) => onChange?.(e.target.value)}
        className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-surface-200/50 min-w-0"
      />
      <kbd className="text-[10px] font-stat text-surface-200 border border-surface-700 rounded px-1.5 py-0.5 flex-shrink-0">
        ⌘K
      </kbd>
    </label>
  );
}

interface IconButtonProps {
  ariaLabel: string;
  onClick?: () => void;
  badge?: number;
  children: ReactNode;
}

function IconButton({ ariaLabel, onClick, badge, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="relative w-9 h-9 rounded-md flex items-center justify-center text-surface-200 hover:text-white hover:bg-surface-800 transition-colors [&>svg]:w-4 [&>svg]:h-4"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-danger-500 text-white text-[9px] font-stat font-semibold flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
