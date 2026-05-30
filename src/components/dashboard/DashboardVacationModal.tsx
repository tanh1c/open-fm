import { useMemo, useState } from "react";
import { CalendarDays, Plane } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { FixtureData, GameStateData } from "../../store/gameStore";
import { getTeamName, formatMatchDate } from "../../lib/helpers";
import { getCompetitionTag } from "../../lib/competitionTag";
import MonthCalendar, { type CalendarEvent } from "../common/MonthCalendar";
import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardVacationModalProps {
  gameState: GameStateData;
  onCancel: () => void;
  onConfirm: (targetDate: string) => void;
}

function fixtureIncludesTeam(fixture: FixtureData, teamId?: string | null): boolean {
  return !!teamId && (fixture.home_team_id === teamId || fixture.away_team_id === teamId);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardVacationModal({
  gameState,
  onCancel,
  onConfirm,
}: DashboardVacationModalProps) {
  const { t } = useTranslation();
  const today = gameState.clock.current_date.slice(0, 10);
  // Earliest selectable day is tomorrow — vacationing to "today" is a no-op.
  const minDate = addDays(today, 1);

  const userTeamId = gameState.manager.team_id;

  // Aggregate the user's fixtures from every competition plus the standalone
  // league so cup/continental/friendly matches all appear on the calendar.
  const userFixtures = useMemo(() => {
    if (!userTeamId) return [] as FixtureData[];
    const sources: FixtureData[][] = [];
    (gameState.competitions ?? []).forEach((competition) => sources.push(competition.fixtures));
    if (gameState.league) sources.push(gameState.league.fixtures);

    const seen = new Set<string>();
    const collected: FixtureData[] = [];
    for (const fixtures of sources) {
      for (const fixture of fixtures) {
        if (seen.has(fixture.id)) continue;
        if (!fixtureIncludesTeam(fixture, userTeamId)) continue;
        seen.add(fixture.id);
        collected.push(fixture);
      }
    }
    return collected.sort((left, right) => left.date.localeCompare(right.date));
  }, [gameState.competitions, gameState.league, userTeamId]);

  const events: CalendarEvent[] = useMemo(
    () =>
      userFixtures.map((fixture) => {
        const opponentId =
          fixture.home_team_id === userTeamId
            ? fixture.away_team_id
            : fixture.home_team_id;
        const opponent = getTeamName(gameState.teams, opponentId);
        const completed = fixture.status === "Completed";
        const tag = getCompetitionTag(t, fixture.competition);
        return {
          date: fixture.date,
          tone: completed ? "bg-app-text-muted" : tag.dotTone,
          competitionCode: tag.code,
          competitionTone: tag.tone,
          label:
            completed && fixture.result
              ? `${fixture.result.home_goals}-${fixture.result.away_goals}`
              : `vs ${opponent.slice(0, 3).toUpperCase()}`,
          title: `${tag.label}: ${getTeamName(gameState.teams, fixture.home_team_id)} vs ${getTeamName(gameState.teams, fixture.away_team_id)}`,
        };
      }),
    [userFixtures, userTeamId, gameState.teams, t],
  );

  // Default the picker to the next upcoming fixture date if one exists, else
  // a week ahead — gives the user a sensible starting target.
  const nextFixture = userFixtures.find(
    (fixture) => fixture.status !== "Completed" && fixture.date >= minDate,
  );
  const [selected, setSelected] = useState<string | null>(
    nextFixture?.date ?? null,
  );

  return (
    <DashboardModalFrame maxWidthClassName="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-green/15 text-app-green">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold uppercase tracking-wide text-app-text">
              {t("continueMenu.vacation", { defaultValue: "Vacation" })}
            </h3>
            <p className="mt-0.5 text-sm text-app-text-muted">
              {t("continueMenu.vacationModalDesc", {
                defaultValue: "Pick a date to fast-forward to. Stops early for your matches.",
              })}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-app-border bg-app-bg p-3">
          <MonthCalendar
            value={selected}
            onSelect={setSelected}
            events={events}
            today={today}
            minDate={minDate}
            initialMonth={selected ?? minDate}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-app-text-muted">
            <CalendarDays className="h-4 w-4 text-app-green" />
            {t("continueMenu.vacationTarget", { defaultValue: "Target" })}
          </span>
          <span className="font-bold text-app-text">
            {selected ? formatMatchDate(selected) : "—"}
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-app-border bg-app-bg px-4 py-3 text-sm font-heading font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:border-app-green/50 hover:text-app-text"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-app-green px-4 py-3 text-sm font-heading font-bold uppercase tracking-wider text-app-bg shadow-lg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plane className="h-4 w-4" />
            {t("continueMenu.vacationGo", { defaultValue: "Go on Vacation" })}
          </button>
        </div>
      </div>
    </DashboardModalFrame>
  );
}
