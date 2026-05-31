import { useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CalendarDays, Dumbbell, FileText, Mail, Plane, Search, ShieldCheck, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { VacationSettings } from "../../services/advanceTimeService";
import type { FixtureData, GameStateData } from "../../store/gameStore";
import { getTeamName, formatMatchDate } from "../../lib/helpers";
import { getCompetitionTag } from "../../lib/competitionTag";
import MonthCalendar, { type CalendarEvent } from "../common/MonthCalendar";
import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardVacationModalProps {
  gameState: GameStateData;
  onCancel: () => void;
  onConfirm: (targetDate: string, settings: VacationSettings) => void;
}

const DEFAULT_VACATION_SETTINGS: VacationSettings = {
  handleMatches: true,
  handleTraining: true,
  handleTransfers: true,
  handleContracts: true,
  handleScouting: true,
  ignoreSoftBlockers: true,
  returnForUserMatch: false,
  returnForJobOffer: true,
  returnForTransferOffer: true,
  returnForContractDecision: true,
  returnForInjuryCrisis: true,
  returnForUrgentMessage: true,
  contractMaxWageIncreasePct: 15,
  contractMaxYears: 3,
  transferMinimumValuePct: 120,
  allowAssistantToSellKeyPlayers: false,
  applyForJobsWhileAway: false,
  jobMinimumReputation: null,
};

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
  const [settings, setSettings] = useState<VacationSettings>(DEFAULT_VACATION_SETTINGS);

  const returnOptions = [
    {
      key: "returnForUserMatch" as const,
      icon: Trophy,
      label: t("continueMenu.vacationReturnForMatch", { defaultValue: "Return for user matches" }),
      description: t("continueMenu.vacationReturnForMatchDesc", {
        defaultValue: "Stop vacation on the next match day instead of letting the assistant auto-play it.",
      }),
    },
    {
      key: "returnForTransferOffer" as const,
      icon: BriefcaseBusiness,
      label: t("continueMenu.vacationReturnForTransferOffer", { defaultValue: "Transfer offers" }),
      description: t("continueMenu.vacationReturnForTransferOfferDesc", {
        defaultValue: "Come back when a new incoming offer needs review.",
      }),
    },
    {
      key: "returnForContractDecision" as const,
      icon: FileText,
      label: t("continueMenu.vacationReturnForContractDecision", { defaultValue: "Contract decisions" }),
      description: t("continueMenu.vacationReturnForContractDecisionDesc", {
        defaultValue: "Come back when renewals need manager judgement.",
      }),
    },
    {
      key: "returnForInjuryCrisis" as const,
      icon: AlertTriangle,
      label: t("continueMenu.vacationReturnForInjuryCrisis", { defaultValue: "Injury crisis" }),
      description: t("continueMenu.vacationReturnForInjuryCrisisDesc", {
        defaultValue: "Come back if the squad can no longer field safely.",
      }),
    },
    {
      key: "returnForUrgentMessage" as const,
      icon: Mail,
      label: t("continueMenu.vacationReturnForUrgentMessage", { defaultValue: "Urgent inbox" }),
      description: t("continueMenu.vacationReturnForUrgentMessageDesc", {
        defaultValue: "Come back when urgent unread messages arrive.",
      }),
    },
    {
      key: "returnForJobOffer" as const,
      icon: ShieldCheck,
      label: t("continueMenu.vacationReturnForJobOffer", { defaultValue: "Job offers" }),
      description: t("continueMenu.vacationReturnForJobOfferDesc", {
        defaultValue: "Come back when a club makes an approach.",
      }),
    },
  ];

  const authorityOptions = [
    {
      key: "handleMatches" as const,
      icon: Trophy,
      label: t("continueMenu.vacationHandleMatches", { defaultValue: "Manage matches" }),
      description: t("continueMenu.vacationHandleMatchesDesc", {
        defaultValue: "Assistant takes charge of fixtures while you are away.",
      }),
    },
    {
      key: "handleTraining" as const,
      icon: Dumbbell,
      label: t("continueMenu.vacationHandleTraining", { defaultValue: "Run training" }),
      description: t("continueMenu.vacationHandleTrainingDesc", {
        defaultValue: "Training, recovery and fitness checks continue each day.",
      }),
    },
    {
      key: "handleTransfers" as const,
      icon: BriefcaseBusiness,
      label: t("continueMenu.vacationHandleTransfers", { defaultValue: "Handle transfers" }),
      description: t("continueMenu.vacationHandleTransfersDesc", {
        defaultValue: "Assistant applies your transfer policy to incoming offers.",
      }),
    },
    {
      key: "handleContracts" as const,
      icon: FileText,
      label: t("continueMenu.vacationHandleContracts", { defaultValue: "Handle contracts" }),
      description: t("continueMenu.vacationHandleContractsDesc", {
        defaultValue: "Assistant can attempt delegated renewals within your limits.",
      }),
    },
    {
      key: "handleScouting" as const,
      icon: Search,
      label: t("continueMenu.vacationHandleScouting", { defaultValue: "Continue scouting" }),
      description: t("continueMenu.vacationHandleScoutingDesc", {
        defaultValue: "Senior and youth scouting assignments keep progressing.",
      }),
    },
    {
      key: "ignoreSoftBlockers" as const,
      icon: ShieldCheck,
      label: t("continueMenu.vacationIgnoreSoftBlockers", { defaultValue: "Skip routine interruptions" }),
      description: t("continueMenu.vacationIgnoreSoftBlockersDesc", {
        defaultValue: "Inbox, injury and finance warnings wait until you return.",
      }),
    },
  ];

  const toggleBooleanSetting = (key: keyof VacationSettings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  const updateNumberSetting = (key: keyof VacationSettings, value: number) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <DashboardModalFrame maxWidthClassName="max-w-4xl">
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
          <div className="flex flex-col gap-3">
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
          </div>

          <div className="max-h-[62vh] overflow-y-auto rounded-xl border border-app-border bg-app-panel p-4 custom-scrollbar">
            <div className="mb-3">
              <h4 className="font-heading text-sm font-bold uppercase tracking-wide text-app-text">
                {t("continueMenu.vacationAssistantTitle", { defaultValue: "Assistant responsibilities" })}
              </h4>
              <p className="mt-1 text-xs leading-5 text-app-text-muted">
                {t("continueMenu.vacationAssistantDesc", {
                  defaultValue: "Choose when to return and what your assistant may handle while daily simulation continues normally.",
                })}
              </p>
            </div>

            <section className="space-y-2">
              <h5 className="font-heading text-xs font-bold uppercase tracking-wide text-app-green">
                {t("continueMenu.vacationReturnSection", { defaultValue: "Return From Vacation" })}
              </h5>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {returnOptions.map((option) => {
                  const Icon = option.icon;
                  const enabled = settings[option.key];
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleBooleanSetting(option.key)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        enabled ? "border-app-green/45 bg-app-green/10" : "border-app-border bg-app-bg"
                      } hover:border-app-green/70`}
                    >
                      <span className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-bg text-app-green">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-xs font-heading font-bold uppercase tracking-wide text-app-text">{option.label}</span>
                            <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-app-green" : "bg-app-border"}`} />
                          </span>
                          <span className="mt-1 block text-xs leading-4 text-app-text-muted">{option.description}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 space-y-2">
              <h5 className="font-heading text-xs font-bold uppercase tracking-wide text-app-green">
                {t("continueMenu.vacationAuthoritySection", { defaultValue: "Assistant Authority" })}
              </h5>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {authorityOptions.map((option) => {
                  const Icon = option.icon;
                  const enabled = settings[option.key];
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleBooleanSetting(option.key)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        enabled ? "border-app-green/45 bg-app-green/10" : "border-app-border bg-app-bg"
                      } hover:border-app-green/70`}
                    >
                      <span className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-bg text-app-green">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-xs font-heading font-bold uppercase tracking-wide text-app-text">{option.label}</span>
                            <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-app-green" : "bg-app-border"}`} />
                          </span>
                          <span className="mt-1 block text-xs leading-4 text-app-text-muted">{option.description}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="rounded-lg border border-app-border bg-app-bg px-3 py-3">
                <span className="block text-xs font-heading font-bold uppercase tracking-wide text-app-text">
                  {t("continueMenu.vacationContractWageLimit", { defaultValue: "Max wage increase" })}: {settings.contractMaxWageIncreasePct}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={settings.contractMaxWageIncreasePct}
                  onChange={(event) => updateNumberSetting("contractMaxWageIncreasePct", Number(event.target.value))}
                  className="mt-2 w-full accent-app-green"
                />
              </label>
              <label className="rounded-lg border border-app-border bg-app-bg px-3 py-3">
                <span className="block text-xs font-heading font-bold uppercase tracking-wide text-app-text">
                  {t("continueMenu.vacationContractYears", { defaultValue: "Max contract years" })}: {settings.contractMaxYears}
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={settings.contractMaxYears}
                  onChange={(event) => updateNumberSetting("contractMaxYears", Number(event.target.value))}
                  className="mt-2 w-full accent-app-green"
                />
              </label>
              <label className="rounded-lg border border-app-border bg-app-bg px-3 py-3">
                <span className="block text-xs font-heading font-bold uppercase tracking-wide text-app-text">
                  {t("continueMenu.vacationTransferValue", { defaultValue: "Minimum transfer value" })}: {settings.transferMinimumValuePct}%
                </span>
                <input
                  type="range"
                  min={80}
                  max={200}
                  step={10}
                  value={settings.transferMinimumValuePct}
                  onChange={(event) => updateNumberSetting("transferMinimumValuePct", Number(event.target.value))}
                  className="mt-2 w-full accent-app-green"
                />
              </label>
              <button
                type="button"
                onClick={() => toggleBooleanSetting("allowAssistantToSellKeyPlayers")}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                  settings.allowAssistantToSellKeyPlayers ? "border-app-green/45 bg-app-green/10" : "border-app-border bg-app-bg"
                } hover:border-app-green/70`}
              >
                <span className="block text-xs font-heading font-bold uppercase tracking-wide text-app-text">
                  {t("continueMenu.vacationSellKeyPlayers", { defaultValue: "Allow key-player sales" })}
                </span>
                <span className="mt-1 block text-xs leading-4 text-app-text-muted">
                  {t("continueMenu.vacationSellKeyPlayersDesc", { defaultValue: "Off by default so the assistant never sells core starters without you." })}
                </span>
              </button>
            </section>
          </div>
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
            onClick={() => selected && onConfirm(selected, settings)}
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
