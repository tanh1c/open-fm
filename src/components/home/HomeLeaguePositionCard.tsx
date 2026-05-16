import { ChevronRight, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, Card, CardBody, CardHeader } from "../ui";

interface LeagueStandingSnapshot {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

interface HomeLeaguePositionCardProps {
  isPreseason: boolean;
  phase: string;
  seasonStartLabel: string | null;
  myStanding: number | null;
  myStandingData: LeagueStandingSnapshot | null;
  teamForm: string[];
  onNavigate?: (tab: string) => void;
}

export default function HomeLeaguePositionCard({
  isPreseason,
  phase,
  seasonStartLabel,
  myStanding,
  myStandingData,
  teamForm,
  onNavigate,
}: HomeLeaguePositionCardProps) {
  const { t } = useTranslation();

  const lastThreeResults = teamForm.slice(-3);
  const winStreak =
    lastThreeResults.length >= 3 && lastThreeResults.every((result) => result === "W");
  const loseStreak =
    lastThreeResults.length >= 3 && lastThreeResults.every((result) => result === "L");
  const unbeaten = teamForm.length >= 4 && teamForm.every((result) => result !== "L");

  return (
    <Card accent="accent">
      <CardHeader
        action={
          <button
            onClick={() => onNavigate?.("Schedule")}
            className="text-app-green text-xs font-heading font-bold uppercase tracking-wider hover:text-app-text transition-colors"
          >
            {t("home.standings")}
          </button>
        }
      >
        {t("home.leaguePosition")}
      </CardHeader>
      <CardBody>
        {isPreseason ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Badge variant="accent" size="sm">
              {t(`season.phases.${phase}`)}
            </Badge>
            <p className="text-sm font-heading font-bold text-app-text">
              {seasonStartLabel
                ? t("season.startsOn", { date: seasonStartLabel })
                : t("season.noOpener")}
            </p>
            <p className="text-xs text-app-text-muted max-w-xs">
              {t("season.standingsLocked")}
            </p>
          </div>
        ) : myStanding && myStandingData ? (
          <div className="overflow-hidden rounded-xl border border-app-border/50 bg-app-bg/40">
            <div
              data-testid="league-position-rank"
              className="flex items-center justify-between border-b border-app-border/50 px-3 py-3 bg-app-bg/60"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-8 h-8 rounded bg-app-green/10 border border-app-green/30 flex items-center justify-center text-sm font-heading font-bold text-app-green">
                  {myStanding}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-app-text-muted truncate">
                    {myStanding === 1
                      ? t("common.place.1")
                      : myStanding === 2
                        ? t("common.place.2")
                        : myStanding === 3
                          ? t("common.place.3")
                          : t("common.place.other", { n: myStanding })}
                  </p>
                  <p className="text-xs font-semibold text-app-text">Club</p>
                </div>
              </div>
              <span className="text-sm font-stat font-bold text-app-text">
                {myStandingData.points} pts
              </span>
            </div>

            <div className="grid grid-cols-5 px-3 py-2 text-[10px] uppercase tracking-wider text-app-text-muted border-b border-app-border/30">
              <span>P</span>
              <span className="text-center">W</span>
              <span className="text-center">D</span>
              <span className="text-center">L</span>
              <span className="text-right">GD</span>
            </div>
            <div className="grid grid-cols-5 px-3 py-2.5 text-xs font-stat text-app-text">
              <span>{myStandingData.played}</span>
              <span className="text-center text-app-green">{myStandingData.won}</span>
              <span className="text-center text-app-text-muted">{myStandingData.drawn}</span>
              <span className="text-center text-app-red">{myStandingData.lost}</span>
              <span className="text-right">
                {myStandingData.goals_for - myStandingData.goals_against > 0 ? "+" : ""}
                {myStandingData.goals_for - myStandingData.goals_against}
              </span>
            </div>

            {teamForm.length > 0 && (
              <div className="border-t border-app-border/30 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {teamForm.map((result, index) => (
                      <span
                        key={`${result}-${index}`}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-heading font-bold ${
                          result === "W"
                            ? "bg-app-green text-app-bg"
                            : result === "L"
                              ? "bg-app-red text-app-bg"
                              : "bg-app-border text-app-text-muted"
                        }`}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-app-text-muted" />
                </div>
                {winStreak && (
                  <span className="mt-2 block text-[10px] font-heading font-bold text-app-green uppercase tracking-wider">
                    {t("home.winningStreak")}
                  </span>
                )}
                {loseStreak && (
                  <span className="mt-2 block text-[10px] font-heading font-bold text-app-red uppercase tracking-wider">
                    {t("home.losingStreak")}
                  </span>
                )}
                {!winStreak && !loseStreak && unbeaten && (
                  <span className="mt-2 block text-[10px] font-heading font-bold text-app-green uppercase tracking-wider">
                    {t("home.unbeatenRun")}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            <Trophy className="w-8 h-8 text-app-border" />
            <p className="text-xs text-app-text-muted">
              {t("home.noLeague")}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}