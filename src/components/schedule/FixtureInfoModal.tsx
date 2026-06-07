import { useEffect } from "react";
import { Calendar, MapPin, Shield, Trophy, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { FixtureData, GameStateData } from "../../store/gameStore";
import type { TeamData } from "../../store/types";
import { getTeamName, formatMatchDate } from "../../lib/helpers";
import { getCompetitionTag } from "../../lib/competitionTag";
import TeamLogo from "../common/TeamLogo";

interface FixtureInfoModalProps {
  fixture: FixtureData | null;
  gameState: GameStateData;
  onClose: () => void;
  onViewTeam?: (teamId: string) => void;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-app-border bg-app-bg px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-green/10 text-app-green">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-app-text">{value}</p>
      </div>
    </div>
  );
}

function TeamBlock({ team, name, align }: { team?: TeamData; name: string; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-2 ${align === "left" ? "" : ""}`}>
      {team ? <TeamLogo team={team} size="md" /> : <Shield className="h-10 w-10 text-app-text-muted" />}
      <span className="truncate text-center text-sm font-bold text-app-text">{name}</span>
    </div>
  );
}

export default function FixtureInfoModal({ fixture, gameState, onClose, onViewTeam }: FixtureInfoModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!fixture) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fixture, onClose]);

  if (!fixture) return null;

  const teamById = new Map(gameState.teams.map((team) => [team.id, team]));
  const homeTeam = teamById.get(fixture.home_team_id);
  const awayTeam = teamById.get(fixture.away_team_id);
  const homeName = homeTeam?.name ?? getTeamName(gameState.teams, fixture.home_team_id);
  const awayName = awayTeam?.name ?? getTeamName(gameState.teams, fixture.away_team_id);
  const userTeamId = gameState.manager.team_id;
  const tag = getCompetitionTag(t, fixture.competition);

  const isUserHome = fixture.home_team_id === userTeamId;
  const opponentId = isUserHome ? fixture.away_team_id : fixture.home_team_id;
  const opponentName = isUserHome ? awayName : homeName;
  const venue = userTeamId
    ? isUserHome
      ? t("schedule.home", { defaultValue: "Home" })
      : t("schedule.away", { defaultValue: "Away" })
    : "—";
  const stadium = homeTeam?.stadium_name ?? "—";
  const stadiumCity = homeTeam?.city ? `${stadium} · ${homeTeam.city}` : stadium;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-3 py-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-app-border bg-app-bg shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-border bg-app-card px-4 py-3">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-[0.24em] text-app-green">
              {t("schedule.upcomingMatch", { defaultValue: "Upcoming Match" })}
            </p>
            <p className="mt-1 truncate text-xs text-app-text-muted">{tag.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-bg text-app-text-muted transition hover:border-app-green hover:text-app-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-app-border bg-app-card px-4 py-5">
            <TeamBlock team={homeTeam} name={homeName} align="right" />
            <span className="shrink-0 rounded border border-app-border bg-app-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
              vs
            </span>
            <TeamBlock team={awayTeam} name={awayName} align="left" />
          </div>

          <div className="flex flex-col gap-2">
            <InfoRow icon={<Shield className="h-4 w-4" />} label={t("schedule.opponent", { defaultValue: "Opponent" })} value={opponentName} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label={`${venue} · ${t("schedule.stadium", { defaultValue: "Stadium" })}`} value={stadiumCity} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label={t("schedule.date", { defaultValue: "Date" })} value={formatMatchDate(fixture.date)} />
            <InfoRow icon={<Trophy className="h-4 w-4" />} label={t("schedule.competition", { defaultValue: "Competition" })} value={tag.label} />
          </div>

          {onViewTeam ? (
            <button
              type="button"
              onClick={() => {
                onViewTeam(opponentId);
                onClose();
              }}
              className="rounded-lg bg-app-green px-4 py-2.5 text-sm font-bold text-app-bg transition-colors hover:bg-app-green/90"
            >
              {t("common.viewTeam", { defaultValue: "View Team" })}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
