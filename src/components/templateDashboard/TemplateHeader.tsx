import { ArrowLeft, Bell, Calendar, ChevronDown, ChevronRight, HelpCircle, Loader2, Mail, Save, Search } from "lucide-react";
import type { ReactNode } from "react";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import { getTeamName } from "../../lib/helpers";
import type { PlayerData, TeamData } from "../../store/gameStore";
import { positionCode } from "../squad/SquadTab.helpers";

export interface TemplateHeaderMatchModeMeta {
  buttonColorClass: string;
  desc: string;
  dropdownColorClass: string;
  icon: ReactNode;
  label: string;
}

interface TemplateHeaderProps {
  seasonLabel: string;
  seasonDate: string;
  reputationLabel: string;
  reputationStars: number;
  managerName: string;
  managerRole: string;
  unreadCount?: number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
  onInbox?: () => void;
  onHelp?: () => void;
  activeTabLabel: string;
  hasProfileHistory: boolean;
  matchedPlayers: PlayerData[];
  matchedTeams: TeamData[];
  onBack: () => void;
  onSelectSearchPlayer: (playerId: string) => void;
  onSelectSearchTeam: (teamId: string) => void;
  searchOpen: boolean;
  teams: TeamData[];
  hasMatchToday: boolean;
  isAdvancing: boolean;
  isSaving: boolean;
  isUnemployed: boolean;
  matchMode: MatchModeType;
  modeMeta: Record<MatchModeType, TemplateHeaderMatchModeMeta>;
  onContinue: () => void;
  onSave: () => void;
  onSelectMatchMode: (mode: MatchModeType) => void;
  onSkipToMatchDay: () => void;
  onToggleContinueMenu: () => void;
  saveFlash: boolean;
  seasonComplete: boolean;
  showContinueMenu: boolean;
  labels: {
    continue: string;
    saved: string;
    saving: string;
    save: string;
    saveGame: string;
    simulating: string;
    seasonComplete: string;
    skipToMatchDay: string;
    skipToMatchDayDesc: string;
  };
}

export function TemplateHeader({
  seasonLabel: _seasonLabel,
  seasonDate,
  reputationLabel: _reputationLabel,
  reputationStars: _reputationStars,
  managerName: _managerName,
  managerRole: _managerRole,
  unreadCount = 0,
  searchValue = "",
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onInbox,
  onHelp,
  activeTabLabel,
  hasProfileHistory,
  matchedPlayers,
  matchedTeams,
  onBack,
  onSelectSearchPlayer,
  onSelectSearchTeam,
  searchOpen,
  teams,
  hasMatchToday,
  isAdvancing,
  isSaving,
  isUnemployed,
  matchMode,
  modeMeta,
  onContinue,
  onSave,
  onSelectMatchMode,
  onSkipToMatchDay,
  onToggleContinueMenu,
  saveFlash,
  seasonComplete,
  showContinueMenu,
  labels,
}: TemplateHeaderProps) {
  const currentModeMeta = modeMeta[matchMode];
  const showSearchResults = searchOpen && searchValue.length >= 2;

  return (
    <header data-testid="template-header" className="h-16 border-b border-app-border bg-app-bg flex items-center gap-4 px-4 lg:px-6 shrink-0 overflow-visible">
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {hasProfileHistory && (
          <button
            type="button"
            onClick={onBack}
            title="Back"
            className="h-9 w-9 inline-flex items-center justify-center text-app-text-muted hover:text-white hover:bg-app-card rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-semibold text-app-text leading-tight">{activeTabLabel}</span>
            <span className="hidden lg:inline text-app-text-muted">/</span>
            <span className="hidden lg:inline truncate text-xs text-app-text-muted">{seasonDate}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
            <Calendar className="w-3 h-3" />
            <span>Dashboard</span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-w-32 max-w-xl ml-auto">
        <Search className="w-4 h-4 text-app-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          placeholder="Search players, staff, competitions..."
          className="h-9 w-full bg-app-card border border-app-border rounded-lg pl-9 pr-3 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-app-green/50 transition-colors"
        />
        {showSearchResults && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-app-border bg-app-card shadow-xl">
            <SearchResults
              matchedPlayers={matchedPlayers}
              matchedTeams={matchedTeams}
              onSelectSearchPlayer={onSelectSearchPlayer}
              onSelectSearchTeam={onSelectSearchTeam}
              teams={teams}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button type="button" className="h-9 w-9 inline-flex items-center justify-center text-app-text-muted hover:text-white hover:bg-app-card rounded-lg transition-colors relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-app-red rounded-full ring-2 ring-app-bg" />}
        </button>
        <button type="button" onClick={onInbox} className="h-9 w-9 inline-flex items-center justify-center text-app-text-muted hover:text-white hover:bg-app-card rounded-lg transition-colors">
          <Mail className="w-4 h-4" />
        </button>
        <button type="button" onClick={onHelp} className="hidden md:inline-flex h-9 w-9 items-center justify-center text-app-text-muted hover:text-white hover:bg-app-card rounded-lg transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="hidden sm:block w-px h-7 bg-app-border mx-1" />

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          title={labels.saveGame}
          className={getSaveButtonClassName(saveFlash, isSaving)}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="hidden sm:inline">{getSaveButtonLabel(labels, saveFlash, isSaving)}</span>
        </button>

        {isUnemployed ? (
          <button
            type="button"
            onClick={() => onContinue()}
            disabled={isAdvancing || seasonComplete}
            className="h-9 bg-linear-to-r from-gray-600 to-gray-700 inline-flex items-center gap-2 rounded-lg px-3 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
          >
            <span>{getContinueLabel(labels, hasMatchToday, isAdvancing, seasonComplete, currentModeMeta)}</span>
            <ChevronRight className={`w-4 h-4 ${isAdvancing ? "animate-pulse" : ""}`} />
          </button>
        ) : (
          <div className="relative">
            <div className="flex h-9">
              <button
                type="button"
                onClick={() => onContinue()}
                disabled={isAdvancing || seasonComplete}
                className={`bg-linear-to-r ${currentModeMeta.buttonColorClass} inline-flex items-center gap-2 rounded-l-lg pl-3 pr-2 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70`}
              >
                {seasonComplete ? null : isAdvancing ? null : currentModeMeta.icon}
                <span className="whitespace-nowrap">{getContinueLabel(labels, hasMatchToday, isAdvancing, seasonComplete, currentModeMeta)}</span>
                <ChevronRight className={`w-4 h-4 ${isAdvancing ? "animate-pulse" : ""}`} />
              </button>
              <button
                type="button"
                onClick={onToggleContinueMenu}
                className={`bg-linear-to-r ${currentModeMeta.dropdownColorClass} inline-flex items-center justify-center rounded-r-lg border-l border-white/20 px-2 text-white transition-colors hover:brightness-110`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {showContinueMenu && (
              <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-app-border bg-app-card py-1 shadow-xl">
                {(["live", "spectator", "delegate"] as const).map((mode) => {
                  const isActive = matchMode === mode;
                  const optionMeta = modeMeta[mode];

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSelectMatchMode(mode)}
                      className={isActive ? "flex w-full items-center gap-3 px-4 py-2.5 text-left bg-white/5" : "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"}
                    >
                      <span className={isActive ? "text-app-green" : "text-app-text-muted"}>{optionMeta.icon}</span>
                      <div className="flex-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-app-text">{optionMeta.label}</span>
                        <p className="mt-0.5 text-xs text-app-text-muted">{optionMeta.desc}</p>
                      </div>
                      {isActive && <span className="text-xs font-bold text-app-green">✓</span>}
                    </button>
                  );
                })}
                <div className="my-1 border-t border-app-border" />
                <button
                  type="button"
                  onClick={onSkipToMatchDay}
                  className="w-full px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-app-text">{labels.skipToMatchDay}</span>
                  <p className="mt-0.5 text-xs text-app-text-muted">{labels.skipToMatchDayDesc}</p>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function SearchResults({
  matchedPlayers,
  matchedTeams,
  onSelectSearchPlayer,
  onSelectSearchTeam,
  teams,
}: {
  matchedPlayers: PlayerData[];
  matchedTeams: TeamData[];
  onSelectSearchPlayer: (playerId: string) => void;
  onSelectSearchTeam: (teamId: string) => void;
  teams: TeamData[];
}) {
  if (matchedPlayers.length === 0 && matchedTeams.length === 0) {
    return <p className="p-3 text-xs text-app-text-muted">No results</p>;
  }

  return (
    <>
      {matchedTeams.length > 0 && (
        <div>
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">Teams</p>
          {matchedTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              onMouseDown={() => onSelectSearchTeam(team.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white"
                style={{ backgroundColor: team.colors.primary }}
              >
                {team.short_name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-app-text">{team.name}</span>
              <span className="ml-auto text-xs text-app-text-muted">{team.city}</span>
            </button>
          ))}
        </div>
      )}
      {matchedPlayers.length > 0 && (
        <div>
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">Players</p>
          {matchedPlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              onMouseDown={() => onSelectSearchPlayer(player.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
            >
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-app-green">
                {positionCode(player.position)}
              </span>
              <span className="text-sm font-medium text-app-text">{player.full_name}</span>
              <span className="ml-auto text-xs text-app-text-muted">{getTeamName(teams, player.team_id ?? "")}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function getSaveButtonClassName(saveFlash: boolean, isSaving: boolean): string {
  const baseClassName = "h-9 inline-flex items-center gap-2 rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-all";

  if (isSaving) {
    return `${baseClassName} cursor-wait opacity-70 bg-app-card border border-app-border text-app-text-muted`;
  }

  if (saveFlash) {
    return `${baseClassName} bg-app-green text-app-bg`;
  }

  return `${baseClassName} bg-app-card border border-app-border text-app-text-muted hover:text-white hover:bg-white/5`;
}

function getSaveButtonLabel(
  labels: TemplateHeaderProps["labels"],
  saveFlash: boolean,
  isSaving: boolean,
): string {
  if (saveFlash) return labels.saved;
  if (isSaving) return labels.saving;
  return labels.save;
}

function getContinueLabel(
  labels: TemplateHeaderProps["labels"],
  hasMatchToday: boolean,
  isAdvancing: boolean,
  seasonComplete: boolean,
  modeMeta: TemplateHeaderMatchModeMeta,
): string {
  if (seasonComplete) return labels.seasonComplete;
  if (isAdvancing) return labels.simulating;
  return hasMatchToday ? modeMeta.label : labels.continue;
}

