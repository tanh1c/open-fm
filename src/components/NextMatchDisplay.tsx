import { useTranslation } from "react-i18next";
import { GameStateData } from "../store/gameStore";
import { ChevronRight, CloudRain, Shield } from "lucide-react";
import {
  getTeamName,
  findNextFixture,
  formatMatchDate,
  isSeasonComplete,
} from "../lib/helpers";

export default function NextMatchDisplay({
  gameState,
}: {
  gameState: GameStateData;
}) {
  const { t } = useTranslation();
  const userTeamId = gameState.manager.team_id;
  const league = gameState.league;

  if (!userTeamId || !league) {
    return (
      <p className="text-app-text-muted text-sm text-center py-8">
        {t("home.noLeagueSchedule")}
      </p>
    );
  }

  const nextFixture = findNextFixture(league.fixtures, userTeamId);
  if (!nextFixture) {
    return (
      <p className="text-app-text-muted text-sm text-center py-8">
        {t(
          isSeasonComplete(league)
            ? "home.seasonComplete"
            : "home.noUpcomingOpponent",
        )}
      </p>
    );
  }

  const isHome = nextFixture.home_team_id === userTeamId;
  const opponentId = isHome
    ? nextFixture.away_team_id
    : nextFixture.home_team_id;
  const fixtureLabel =
    nextFixture.competition === "League"
      ? t("home.matchdayN", { n: nextFixture.matchday })
      : nextFixture.competition === "PreseasonTournament"
        ? t("season.preseasonTournament")
        : t("season.friendly");

  const homeTeamName = getTeamName(gameState.teams, nextFixture.home_team_id);
  const opponentName = getTeamName(gameState.teams, opponentId);

  return (
    <div data-testid="template-upcoming-match" className="flex-1 p-5 flex flex-col items-center min-h-[292px]">
      <div className="text-xs text-app-text-muted mb-1 text-center">
        {nextFixture.competition === "League" ? t("season.leagueMatch", { defaultValue: "League Match" }) : fixtureLabel}
      </div>
      <div className="text-[10px] text-app-text-muted mb-6 text-center">
        {fixtureLabel}
      </div>

      <div className="flex items-center justify-between w-full mb-6 relative gap-2">
        <div className="flex flex-col items-center gap-2 z-10 shrink min-w-0">
          <div className="w-14 h-14 bg-app-bg border border-app-border rounded-xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-app-green" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wide truncate max-w-[80px] text-app-text">
            {homeTeamName}
          </span>
          <span className="text-[10px] text-app-text-muted">
            {isHome ? t("home.home") : t("home.away")}
          </span>
        </div>

        <div className="flex flex-col items-center flex-1 shrink">
          <span className="text-2xl font-bold text-app-text mb-1 tracking-widest">VS</span>
          <span className="text-[10px] text-app-text-muted mb-0.5 whitespace-nowrap">
            {formatMatchDate(nextFixture.date)}
          </span>
          <span className="text-xs font-bold text-app-text">15:00</span>
        </div>

        <div className="flex flex-col items-center gap-2 z-10 shrink min-w-0">
          <div className="w-14 h-14 bg-app-bg border border-app-border rounded-xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-app-red" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wide truncate max-w-[80px] text-app-text">
            {opponentName}
          </span>
          <span className="text-[10px] text-app-text-muted">
            {!isHome ? t("home.home") : t("home.away")}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 w-full mt-auto">
        <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-app-border" />
          <span>{fixtureLabel}</span>
          <CloudRain className="w-3.5 h-3.5 ml-1" />
          <span>22°C</span>
        </div>
      </div>

      <button className="h-10 border-t border-app-border/50 flex items-center justify-center gap-2 text-[11px] font-semibold text-app-green hover:bg-app-green/5 transition-colors w-[calc(100%+2.5rem)] mt-5 -mb-5">
        <span>{t("home.matchPreview", { defaultValue: "Match Preview" })}</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
