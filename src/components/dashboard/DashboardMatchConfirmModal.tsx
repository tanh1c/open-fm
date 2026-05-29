import { AlertCircle } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { getFixtureDisplayLabel, getTeamName } from "../../lib/helpers";
import type { FixtureData, TeamData } from "../../store/gameStore";
import type { MatchModeType } from "../../hooks/useAdvanceTime";
import TeamLogo from "../common/TeamLogo";
import type { DashboardMatchModeMeta } from "./DashboardHeader";
import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardMatchConfirmModalProps {
  matchMode: MatchModeType;
  modeMeta: DashboardMatchModeMeta;
  onCancel: () => void;
  onConfirm: () => void;
  teams: TeamData[];
  todayMatchFixture: FixtureData | null;
}

export default function DashboardMatchConfirmModal({
  matchMode,
  modeMeta,
  onCancel,
  onConfirm,
  teams,
  todayMatchFixture,
}: DashboardMatchConfirmModalProps): JSX.Element {
  const { t } = useTranslation();
  const homeTeam = todayMatchFixture
    ? teams.find((team) => team.id === todayMatchFixture.home_team_id)
    : null;
  const awayTeam = todayMatchFixture
    ? teams.find((team) => team.id === todayMatchFixture.away_team_id)
    : null;
  const homeName = todayMatchFixture
    ? formatBroadcastTeamName(getTeamName(teams, todayMatchFixture.home_team_id))
    : "";
  const awayName = todayMatchFixture
    ? formatBroadcastTeamName(getTeamName(teams, todayMatchFixture.away_team_id))
    : "";

  return (
    <DashboardModalFrame maxWidthClassName="max-w-2xl">
      <div className="overflow-hidden rounded-3xl border border-app-green/25 bg-app-card shadow-2xl shadow-black/50">
        <div className="relative overflow-hidden border-b border-app-border/60 bg-app-bg px-6 py-5">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-app-green/70 to-transparent" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full border border-app-green/30 bg-app-green/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-app-green">
                Matchday Live
              </span>
              <h3 className="mt-3 text-2xl font-heading font-black uppercase tracking-wide text-app-text">
                {t("continueMenu.matchDayTitle")}
              </h3>
              <p className="mt-1 text-sm font-semibold text-app-text-muted">
                {modeMeta.label}
              </p>
            </div>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${modeMeta.buttonColorClass} text-white shadow-lg`}>
              {modeMeta.icon}
            </div>
          </div>
        </div>

        <div className="p-5">
          {todayMatchFixture ? (
            <div className="relative overflow-hidden rounded-3xl border border-app-green/20 bg-black/20 p-5 shadow-inner">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-app-green/50 to-transparent" />
              <p className="mb-5 text-center text-[10px] font-bold uppercase tracking-[0.26em] text-app-green">
                {getFixtureDisplayLabel(t, todayMatchFixture)}
              </p>
              <div className="grid grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)] items-center gap-4">
                <TeamBroadcastBlock label="Home" name={homeName} team={homeTeam} align="right" />
                <div className="flex flex-col items-center gap-2">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-app-green/30 bg-app-card font-heading text-2xl font-black tracking-wider text-app-green shadow-lg shadow-black/30">
                    {t("common.vs")}
                  </span>
                  <span className="rounded-full bg-app-bg px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-app-text-muted">
                    Kickoff
                  </span>
                </div>
                <TeamBroadcastBlock label="Away" name={awayName} team={awayTeam} align="left" />
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-app-border/70 bg-app-bg/70 p-4">
            <p className="text-sm leading-relaxed text-app-text-muted">
              {modeMeta.desc}
            </p>
            {matchMode === "delegate" && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("continueMenu.delegateWarning")}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-app-border bg-app-bg px-4 py-3 text-sm font-heading font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:border-app-green/50 hover:text-app-text"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r ${modeMeta.buttonColorClass} px-4 py-3 text-sm font-heading font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:brightness-110`}
            >
              {modeMeta.icon}
              {t("common.confirm")}
            </button>
          </div>
        </div>
      </div>
    </DashboardModalFrame>
  );
}

function TeamBroadcastBlock({
  label,
  name,
  team,
  align,
}: {
  label: string;
  name: string;
  team: TeamData | null | undefined;
  align: "left" | "right";
}) {
  const alignClasses = align === "right" ? "items-end text-right" : "items-start text-left";
  const rowClasses = align === "right" ? "flex-row-reverse" : "";

  return (
    <div className={`flex min-w-0 flex-col gap-3 ${alignClasses}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-app-text-muted">
        {label}
      </span>
      <div className={`flex min-w-0 items-center gap-4 ${rowClasses}`}>
        {team ? <TeamLogo team={team} className="h-20 w-20 rounded-3xl border border-app-border bg-white/95 p-2 shadow-xl shadow-black/30" /> : <div className="h-20 w-20 rounded-3xl border border-app-border bg-app-card" />}
        <p className="min-w-0 truncate font-heading text-2xl font-black tracking-tight text-app-text">
          {name}
        </p>
      </div>
    </div>
  );
}

function formatBroadcastTeamName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name;
  return `${parts.slice(0, -1).map((part) => `${part[0]}.`).join(" ")} ${parts[parts.length - 1]}`;
}
