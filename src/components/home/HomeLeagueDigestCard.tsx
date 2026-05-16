import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import type { NewsArticle } from "../../store/gameStore";
import { Badge, Card, CardBody, CardHeader } from "../ui";

interface HomeLeagueDigestCardProps {
  articles: NewsArticle[];
  lang: string;
  onNavigate?: (tab: string) => void;
}

export default function HomeLeagueDigestCard({
  articles,
  lang,
  onNavigate,
}: HomeLeagueDigestCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader
        action={
          <button
            onClick={() => onNavigate?.("News")}
            className="text-app-green text-xs font-heading font-bold uppercase tracking-wider hover:text-app-text transition-colors"
          >
            {t("dashboard.news")}
          </button>
        }
      >
        {t("home.leagueDigest")}
      </CardHeader>
      <CardBody className="p-0">
        {articles.length === 0 ? (
          <p className="text-sm text-app-text-muted p-6 text-center">
            {t("home.noLeagueDigest")}
          </p>
        ) : (
          <div data-testid="league-digest-list" className="divide-y divide-app-border/50">
            {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => onNavigate?.("News")}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors grid grid-cols-[minmax(0,1fr)_0.875rem] gap-3 items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 min-w-0">
                    <Badge variant="neutral" size="sm">
                      {t(`news.categories.${article.category}`)}
                    </Badge>
                    <span className="text-[10px] text-app-text-muted truncate">
                      {formatDateShort(article.date, lang)} - {article.source}
                    </span>
                  </div>
                  <p className="text-xs font-heading font-bold text-app-text leading-snug line-clamp-2">
                    {article.headline}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-app-text-muted" />
              </button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}