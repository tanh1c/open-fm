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
    <header className="h-20 border-b border-app-border bg-app-bg flex items-center justify-between px-6 gap-4 shrink-0">
      {logo !== undefined && (
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-2 font-heading uppercase tracking-wider text-base font-bold text-app-text hover:text-app-green transition-colors flex-shrink-0"
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

      <div className="flex items-center gap-3 pl-3 border-l border-app-border flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-app-card border border-app-border flex items-center justify-center overflow-hidden">
          {managerAvatar ?? (
            <span className="text-xs font-stat font-semibold text-app-text-muted">
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
          <span className="text-sm font-bold uppercase tracking-wider text-app-text truncate max-w-40">
            {managerName}
          </span>
          <span className="text-xs text-app-text-muted">{managerRole}</span>
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
    <div className="flex items-center gap-3 bg-app-card border border-app-border rounded-xl px-4 py-2 flex-shrink-0">
      {icon && (
        <span className="[&>svg]:w-4 [&>svg]:h-4 text-app-text-muted">{icon}</span>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
          {primary}
        </span>
        <span className="text-xs font-semibold text-app-text">
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
            i < clamped ? "fill-app-green text-app-green" : "text-app-border"
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
    <label className="flex items-center gap-2 px-3 py-2 bg-app-card border border-app-border rounded-xl focus-within:border-app-green focus-within:ring-2 focus-within:ring-app-green/20 transition-colors">
      <Search className="w-4 h-4 text-app-text-muted flex-shrink-0" />
      <input
        type="search"
        placeholder="Search players, staff, competitions..."
        onChange={(e) => onChange?.(e.target.value)}
        className="flex-1 bg-transparent outline-none text-sm text-app-text placeholder:text-app-text-muted/60 min-w-0"
      />
      <kbd className="text-[10px] font-stat text-app-text-muted border border-app-border rounded px-1.5 py-0.5 flex-shrink-0">
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
      className="relative w-10 h-10 rounded-xl flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-app-card transition-colors [&>svg]:w-4 [&>svg]:h-4"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-app-red text-white text-[9px] font-stat font-semibold flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
