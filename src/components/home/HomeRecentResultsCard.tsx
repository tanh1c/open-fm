import { useTranslation } from "react-i18next";

import { getTeamName } from "../../lib/helpers";
import type { TeamData } from "../../store/gameStore";
import { Card, CardBody, CardHeader } from "../ui";
import type { HomeRecentResult } from "./HomeTab.helpers";

interface HomeRecentResultsCardProps {
  recentResults: HomeRecentResult[];
  teams: TeamData[];
  onNavigate?: (tab: string) => void;
}

export default function HomeRecentResultsCard({
  recentResults,
  teams,
  onNavigate,
}: HomeRecentResultsCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader
        action={
          <button
            onClick={() => onNavigate?.("Schedule")}
            className="text-app-green text-xs font-heading font-bold uppercase tracking-wider hover:text-app-text transition-colors"
          >
            {t("dashboard.schedule")}
          </button>
        }
      >
        {t("home.recentResults")}
      </CardHeader>
      <CardBody className="p-0">
        {recentResults.length === 0 ? (
          <p className="text-app-text-muted text-xs p-5">
            {t("home.noMatches")}
          </p>
        ) : (
          <div data-testid="recent-results-list" className="divide-y divide-app-border/50">
            {recentResults
              .slice(-5)
              .reverse()
              .map((result) => (
                <div
                  key={result.fixture.id}
                  className="flex items-center px-4 py-2.5 gap-3 hover:bg-white/5 transition-colors"
                >
                  <span
                    className={`form-badge ${
                      result.resultCode === "W"
                        ? "form-badge-w"
                        : result.resultCode === "L"
                          ? "form-badge-l"
                          : "form-badge-d"
                    }`}
                  >
                    {result.resultCode}
                  </span>
                  <span className="text-xs text-app-text-muted flex-shrink-0 w-6">
                    {result.isHome ? t("home.home").charAt(0) : t("home.away").charAt(0)}
                  </span>
                  <span className="text-sm font-medium text-app-text flex-1 truncate">
                    {getTeamName(teams, result.opponentId)}
                  </span>
                  <span className="text-sm font-heading font-bold text-app-text tabular-nums">
                    {result.myGoals} - {result.opponentGoals}
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}