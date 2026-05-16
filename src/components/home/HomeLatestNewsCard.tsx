import { ChevronRight, Newspaper, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import type { NewsArticle, TeamData } from "../../store/gameStore";
import { Card, CardBody, CardHeader } from "../ui";

interface HomeLatestNewsCardProps {
  articles: NewsArticle[];
  teams: TeamData[];
  lang: string;
  onNavigate?: (tab: string) => void;
}

export default function HomeLatestNewsCard({
  articles,
  teams,
  lang,
  onNavigate,
}: HomeLatestNewsCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>TRANSFER ACTIVITY</CardHeader>
      {articles.length === 0 ? (
        <CardBody className="flex flex-col items-center gap-2 py-6">
          <Newspaper className="w-8 h-8 text-app-border" />
          <p className="text-xs text-app-text-muted">
            {t("home.noNews")}
          </p>
        </CardBody>
      ) : (
        <div className="flex-1 flex flex-col justify-center p-4 py-2">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => onNavigate?.("News")}
              className="flex items-center gap-3 py-3 border-b border-app-border/30 last:border-0 hover:bg-white/5 transition-colors -mx-4 px-4 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-app-bg border border-app-border flex items-center justify-center shrink-0">
                <Newspaper className="w-4 h-4 text-app-green" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-semibold text-app-text truncate">{article.headline}</span>
                <span className="text-[10px] text-app-text-muted truncate">
                  {formatDateShort(article.date, lang)} • {article.source}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[10px] text-app-text-muted truncate hidden sm:block w-16">
                  {teams.find((team) => article.team_ids.includes(team.id))?.short_name ?? "News"}
                </span>
              </div>
              <div className="bg-[#5b75a1]/20 text-[#8baae0] px-2 py-1 rounded text-[10px] font-bold shrink-0">
                {article.match_score ? `${article.match_score.home_goals}-${article.match_score.away_goals}` : "INFO"}
              </div>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onNavigate?.("Transfers")}
        className="h-10 border-t border-app-border/50 flex items-center justify-center gap-2 text-[11px] font-semibold text-app-green hover:bg-app-green/5 transition-colors"
      >
        <span>View All Transfers</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </Card>
  );
}