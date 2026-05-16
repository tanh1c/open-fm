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
    <header className="h-20 border-b border-app-border bg-app-bg flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        {logo !== undefined && (
          <button
            type="button"
            onClick={onLogoClick}
            className="sr-only"
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
      </div>

      <div className="flex items-center gap-6">
        <SearchBox onChange={onSearch} />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
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

          <div className="w-px h-8 bg-app-border mx-2" />

          <button type="button" className="flex items-center gap-3 hover:bg-app-card px-2 py-1.5 rounded-lg transition-colors text-left">
            <div className="w-9 h-9 rounded-full bg-app-card border border-app-border flex items-center justify-center overflow-hidden">
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
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-app-text leading-tight truncate max-w-40">
                {managerName}
              </span>
              <span className="text-xs text-app-text-muted">{managerRole}</span>
            </div>
          </button>
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
    <label data-testid="topbar-search" className="relative block">
      <Search className="w-4 h-4 text-app-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type="search"
        placeholder="Search players, staff, competitions..."
        onChange={(e) => onChange?.(e.target.value)}
        className="w-80 bg-app-card border border-app-border rounded-lg pl-9 pr-12 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-app-green/50 transition-colors"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#151b23] border border-app-border rounded px-1.5 py-0.5 text-[10px] text-app-text-muted font-sans font-medium">
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
      className="relative p-2 text-app-text-muted hover:text-white hover:bg-app-card rounded-lg transition-colors [&>svg]:w-5 [&>svg]:h-5"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute top-1.5 right-1.5 min-w-2 h-2 px-0 rounded-full bg-app-red text-transparent text-[0px] ring-2 ring-app-bg flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
