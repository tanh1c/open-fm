import { AlertTriangle, ArrowRightLeft, BriefcaseBusiness, CalendarDays, CheckCircle2, Mail, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { VacationReport } from "../../services/advanceTimeService";
import type { GameStateData } from "../../store/gameStore";
import { formatMatchDate, getTeamName } from "../../lib/helpers";
import DashboardModalFrame from "./DashboardModalFrame";

interface DashboardVacationReportModalProps {
  gameState: GameStateData;
  report: VacationReport;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

function stopReasonLabel(stopReason: string): string {
  return stopReason.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export default function DashboardVacationReportModal({
  gameState,
  report,
  onClose,
  onNavigate,
}: DashboardVacationReportModalProps) {
  const { t } = useTranslation();
  const summaryCards = [
    {
      icon: CalendarDays,
      label: t("continueMenu.vacationReportDays", { defaultValue: "Days away" }),
      value: report.daysAdvanced.toString(),
    },
    {
      icon: Trophy,
      label: t("continueMenu.vacationReportMatches", { defaultValue: "User matches" }),
      value: report.matchResults.length.toString(),
    },
    {
      icon: ArrowRightLeft,
      label: t("continueMenu.vacationReportTransfers", { defaultValue: "Transfer offers" }),
      value: ((report.transferOfferIds.length) + (report.assistantTransferActions?.length ?? 0)).toString(),
    },
    {
      icon: Mail,
      label: t("continueMenu.vacationReportMessages", { defaultValue: "Urgent messages" }),
      value: report.urgentMessageIds.length.toString(),
    },
  ];

  return (
    <DashboardModalFrame maxWidthClassName="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-green/15 text-app-green">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold uppercase tracking-wide text-app-text">
              {t("continueMenu.vacationReportTitle", { defaultValue: "Vacation Report" })}
            </h3>
            <p className="mt-0.5 text-sm text-app-text-muted">
              {formatMatchDate(report.startedAt)} – {formatMatchDate(report.endedAt)} · {stopReasonLabel(report.stopReason)}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-app-border bg-app-bg px-3 py-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-app-text-muted">
                  <Icon className="h-4 w-4 text-app-green" />
                  {card.label}
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-app-text">{card.value}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-app-border bg-app-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="font-heading text-sm font-bold uppercase tracking-wide text-app-text">
              {t("continueMenu.vacationReportMatchResults", { defaultValue: "Match results while away" })}
            </h4>
            <button
              type="button"
              onClick={() => onNavigate("Schedule")}
              className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wide text-app-text-muted transition-colors hover:border-app-green/60 hover:text-app-text"
            >
              {t("dashboard.schedule")}
            </button>
          </div>
          {report.matchResults.length > 0 ? (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {report.matchResults.map((match) => (
                <div key={match.fixtureId} className="flex items-center justify-between gap-3 rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-app-text-muted">
                    {formatMatchDate(match.date)} · {getTeamName(gameState.teams, match.homeTeamId)} vs {getTeamName(gameState.teams, match.awayTeamId)}
                  </span>
                  <span className="font-heading font-bold text-app-text">
                    {match.homeGoals}-{match.awayGoals}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-app-text-muted">
              {t("continueMenu.vacationReportNoMatches", { defaultValue: "No user-team fixtures were played during this vacation." })}
            </p>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavigate("Inbox")}
            className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-left text-xs text-app-text-muted transition-colors hover:border-app-green/60 hover:text-app-text"
          >
            <Mail className="mb-2 h-4 w-4 text-app-green" />
            {report.jobOfferMessageIds.length} {t("continueMenu.vacationReportJobOffers", { defaultValue: "job offers" })}
          </button>
          <button
            type="button"
            onClick={() => onNavigate("Transfers")}
            className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-left text-xs text-app-text-muted transition-colors hover:border-app-green/60 hover:text-app-text"
          >
            <BriefcaseBusiness className="mb-2 h-4 w-4 text-app-green" />
            {report.transferOfferIds.length} {t("continueMenu.vacationReportTransferOffers", { defaultValue: "transfer offers" })}
          </button>
          <button
            type="button"
            onClick={() => onNavigate("Squad")}
            className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-left text-xs text-app-text-muted transition-colors hover:border-app-green/60 hover:text-app-text"
          >
            <AlertTriangle className="mb-2 h-4 w-4 text-app-green" />
            {report.blockerIds.length} {t("continueMenu.vacationReportBlockers", { defaultValue: "return alerts" })}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-app-green px-4 py-3 text-sm font-heading font-bold uppercase tracking-wider text-app-bg shadow-lg transition-all hover:brightness-110"
        >
          {t("common.close", { defaultValue: "Close" })}
        </button>
      </div>
    </DashboardModalFrame>
  );
}
