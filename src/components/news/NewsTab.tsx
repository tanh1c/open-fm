import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Newspaper,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { formatMatchDate as fmtMatchDate, getTeamName } from "../../lib/helpers";
import type { GameStateData, NewsArticle } from "../../store/gameStore";
import { resolveNewsArticle } from "../../utils/backendI18n";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import { buildViewTeamMenuItem } from "../playerActions/playerContextMenuItems";
import { Select } from "../ui";

const CAT_ICONS: Record<string, ReactNode> = {
  MatchReport: <Newspaper className="w-4 h-4" />,
  LeagueRoundup: <Trophy className="w-4 h-4" />,
  StandingsUpdate: <BarChart3 className="w-4 h-4" />,
  TransferRumour: <TrendingUp className="w-4 h-4" />,
  TransferRoundup: <ArrowLeftRight className="w-4 h-4" />,
  InjuryNews: <FileText className="w-4 h-4" />,
  SeasonPreview: <FileText className="w-4 h-4" />,
  Editorial: <FileText className="w-4 h-4" />,
  ManagerialChange: <FileText className="w-4 h-4" />,
};

const CAT_COLORS: Record<string, string> = {
  MatchReport: "text-app-green",
  LeagueRoundup: "text-yellow-400",
  StandingsUpdate: "text-blue-500",
  TransferRumour: "text-purple-500",
  TransferRoundup: "text-fuchsia-500",
  InjuryNews: "text-red-500",
  SeasonPreview: "text-emerald-500",
  Editorial: "text-app-text-muted",
  ManagerialChange: "text-orange-500",
};

interface NewsTabProps {
  gameState: GameStateData;
  onSelectTeam?: (id: string) => void;
}

const PAGE_SIZE = 13;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function TemplateCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-app-border bg-app-card", className)}>{children}</div>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      {action ? <span className="text-[10px] font-semibold text-app-green">{action}</span> : null}
    </div>
  );
}

function StatRow({ label, value, tone = "text-app-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-app-text-muted">{label}</span>
      <span className={cx("font-bold", tone)}>{value}</span>
    </div>
  );
}

function buildArticleTeamMenuItems(
  t: ReturnType<typeof useTranslation>["t"],
  article: NewsArticle,
  gameState: GameStateData,
  onSelectTeam?: (id: string) => void,
): ContextMenuItem[] {
  if (!onSelectTeam) {
    return [];
  }

  return (article.team_ids ?? []).map((teamId) => ({
    ...buildViewTeamMenuItem(t, () => onSelectTeam(teamId)),
    label: `${t("common.viewTeam")}: ${getTeamName(gameState.teams, teamId)}`,
  }));
}

function getCategoryMeta(category: string, t: ReturnType<typeof useTranslation>["t"]) {
  return {
    icon: CAT_ICONS[category] || <FileText className="w-4 h-4" />,
    color: CAT_COLORS[category] || "text-app-text-muted",
    label: t(`news.categories.${category}`),
  };
}

function getFilterButtonClassName(isActive: boolean): string {
  return cx(
    "rounded-lg px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wider transition-all",
    isActive
      ? "bg-app-green text-app-bg shadow-sm"
      : "border border-app-border bg-app-card text-app-text-muted hover:bg-white/5 hover:text-app-text",
  );
}

export default function NewsTab({ gameState, onSelectTeam }: NewsTabProps) {
  const { t } = useTranslation();
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterTeamId, setFilterTeamId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const news = (gameState.news || []).map(resolveNewsArticle);
  const sortedNews = [...news].sort((a, b) => b.date.localeCompare(a.date));
  const categories = Array.from(new Set(sortedNews.map((n) => n.category)));
  const categoryCounts = new Map<string, number>();

  for (const article of sortedNews) {
    categoryCounts.set(article.category, (categoryCounts.get(article.category) ?? 0) + 1);
  }

  const newsTeamIds = Array.from(new Set(sortedNews.flatMap((n) => n.team_ids || [])));
  const teamsInNews = newsTeamIds
    .map((id) => ({ id, name: getTeamName(gameState.teams, id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let filtered = sortedNews;
  if (filterCategory) {
    filtered = filtered.filter((n) => n.category === filterCategory);
  }
  if (filterTeamId) {
    filtered = filtered.filter((n) => (n.team_ids || []).includes(filterTeamId));
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageArticles = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const selectedTeamName = filterTeamId ? getTeamName(gameState.teams, filterTeamId) : t("news.allTeams");
  const latestArticle = sortedNews[0] ?? null;
  const selectedArticle = selectedId
    ? filtered.find((a) => a.id === selectedId) || sortedNews.find((a) => a.id === selectedId)
    : null;

  if (sortedNews.length === 0) {
    return (
      <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
        <div className="rounded-xl border border-app-border bg-app-card py-16 text-center">
          <Newspaper className="mx-auto mb-3 h-12 w-12 text-app-text-muted" />
          <p className="text-sm text-app-text-muted">{t("news.noNews")}</p>
          <p className="mt-1 text-xs text-app-text-muted">{t("news.newsWillAppear")}</p>
        </div>
      </div>
    );
  }

  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        gameState={gameState}
        onBack={() => setSelectedId(null)}
        onSelectTeam={onSelectTeam}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">NEWS</h1>
          <p className="text-sm text-app-text-muted">
            {t("news.nArticles", { count: filtered.length })} &bull; {filterCategory ?? t("common.all")} &bull; {selectedTeamName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            Articles <span className="font-bold text-app-text">{sortedNews.length}</span>
          </div>
          <div className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            Categories <span className="font-bold text-app-green">{categories.length}</span>
          </div>
          <div className="rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg">
            {safePage + 1} / {totalPages}
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[280px]">
          <div>
            <SectionTitle title="NEWSROOM" action={filterCategory ?? "ALL"} />
            <TemplateCard className="flex flex-col gap-3 p-4">
              <StatRow label="All" value={String(sortedNews.length)} />
              <StatRow label="Showing" value={String(filtered.length)} tone="text-app-green" />
              <StatRow label="Categories" value={String(categories.length)} />
              <StatRow label="Teams" value={String(teamsInNews.length)} />
            </TemplateCard>
          </div>

          <div>
            <SectionTitle title="CATEGORIES" action={`${categories.length}`} />
            <TemplateCard className="overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setFilterCategory(null);
                  setPage(0);
                }}
                className={cx(
                  "flex w-full items-center justify-between px-4 py-3 text-xs font-semibold transition-colors hover:bg-white/5",
                  !filterCategory ? "bg-app-green/10 text-app-green" : "text-app-text-muted",
                )}
              >
                <span>{t("common.all")}</span>
                <span>{sortedNews.length}</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setFilterCategory(filterCategory === category ? null : category);
                    setPage(0);
                  }}
                  className={cx(
                    "flex w-full items-center justify-between border-t border-app-border/30 px-4 py-3 text-xs font-semibold transition-colors hover:bg-white/5",
                    filterCategory === category ? "bg-app-green/10 text-app-green" : "text-app-text-muted",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <span className={CAT_COLORS[category] || "text-app-text-muted"}>{CAT_ICONS[category] || <FileText className="h-4 w-4" />}</span>
                    <span className="truncate">{t(`news.categories.${category}`)}</span>
                  </span>
                  <span>{categoryCounts.get(category) ?? 0}</span>
                </button>
              ))}
            </TemplateCard>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-card p-3">
            <button
              onClick={() => {
                setFilterCategory(null);
                setPage(0);
              }}
              className={getFilterButtonClassName(!filterCategory)}
            >
              {t("common.all")}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setFilterCategory(filterCategory === category ? null : category);
                  setPage(0);
                }}
                className={getFilterButtonClassName(filterCategory === category)}
              >
                {t(`news.categories.${category}`)}
              </button>
            ))}

            {teamsInNews.length > 1 ? (
              <div className="ml-auto flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-app-text-muted" />
                <Select
                  value={filterTeamId || ""}
                  onChange={(e) => {
                    setFilterTeamId(e.target.value || null);
                    setPage(0);
                  }}
                  selectSize="sm"
                  wrapperClassName="min-w-[180px]"
                  className="font-heading font-bold uppercase tracking-wider"
                >
                  <option value="">{t("news.allTeams")}</option>
                  {teamsInNews.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <span className="ml-auto text-xs text-app-text-muted">
                {t("news.nArticles", { count: filtered.length })}
              </span>
            )}
          </div>

          <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-app-border/50 bg-app-bg px-4 py-3">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">FEED</h3>
                <p className="mt-1 text-sm font-bold text-app-text">{filterCategory ?? t("common.all")}</p>
              </div>
              {totalPages > 1 ? (
                <PaginationControls safePage={safePage} totalPages={totalPages} setPage={setPage} />
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
              {pageArticles.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <HeroArticle
                    article={pageArticles[0]}
                    gameState={gameState}
                    onSelect={() => setSelectedId(pageArticles[0].id)}
                    onSelectTeam={onSelectTeam}
                  />

                  {pageArticles.length > 1 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {pageArticles.slice(1).map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          gameState={gameState}
                          onSelect={() => setSelectedId(article.id)}
                          onSelectTeam={onSelectTeam}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-app-text-muted">
                  {t("news.noNews")}
                </div>
              )}
            </div>
          </TemplateCard>
        </section>

        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pl-1 custom-scrollbar 2xl:flex 2xl:w-[340px]">
          <div>
            <SectionTitle title="LATEST" action={latestArticle?.category} />
            {latestArticle ? (
              <TemplateCard className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-app-green">
                  {t(`news.categories.${latestArticle.category}`)}
                </p>
                <p className="mt-2 text-sm font-bold leading-snug text-app-text">{latestArticle.headline}</p>
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-app-text-muted">{latestArticle.body}</p>
              </TemplateCard>
            ) : null}
          </div>

          <div>
            <SectionTitle title="FILTERS" action="ACTIVE" />
            <TemplateCard className="flex flex-col gap-3 p-4">
              <StatRow label="Category" value={filterCategory ?? t("common.all")} tone="text-app-green" />
              <StatRow label="Team" value={selectedTeamName} />
              <StatRow label="Page" value={`${safePage + 1} / ${totalPages}`} />
            </TemplateCard>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PaginationControls({
  safePage,
  totalPages,
  setPage,
}: {
  safePage: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        disabled={safePage === 0}
        onClick={() => setPage((p) => Math.max(0, p - 1))}
        className="rounded-lg border border-app-border bg-app-card p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-14 text-center text-[10px] font-heading font-bold uppercase tracking-wider text-app-text-muted">
        {safePage + 1} / {totalPages}
      </span>
      <button
        disabled={safePage >= totalPages - 1}
        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        className="rounded-lg border border-app-border bg-app-card p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function HeroArticle({
  article,
  gameState,
  onSelect,
  onSelectTeam,
}: {
  article: NewsArticle;
  gameState: GameStateData;
  onSelect: () => void;
  onSelectTeam?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatNewsDate = (date: string) => fmtMatchDate(date, i18n.language);
  const contextItems = buildArticleTeamMenuItems(t, article, gameState, onSelectTeam);
  const meta = getCategoryMeta(article.category, t);

  const articleButton = (
    <button
      data-testid={`news-article-${article.id}`}
      onClick={onSelect}
      className="group w-full overflow-hidden rounded-xl border border-app-border bg-app-bg text-left transition-all hover:border-app-green/50 hover:bg-white/5"
    >
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className={cx("inline-flex items-center gap-1.5 rounded-full bg-app-green/10 px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-widest", meta.color)}>
            {meta.icon}
            {meta.label}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-app-text-muted">
            <Clock className="h-3 w-3" />
            {formatNewsDate(article.date)}
          </span>
        </div>

        <h2 className="mb-3 text-xl font-heading font-bold leading-tight text-app-text transition-colors group-hover:text-app-green">
          {article.headline}
        </h2>

        {article.match_score ? <MatchScore article={article} gameState={gameState} size="lg" /> : null}

        <p className="line-clamp-3 text-sm leading-relaxed text-app-text-muted">{article.body}</p>

        <ArticleFooter
          article={article}
          gameState={gameState}
          onSelectTeam={onSelectTeam}
          sourcePrefix="— "
          renderTeamButtons={false}
        />
      </div>
    </button>
  );

  if (contextItems.length > 0) {
    return <ContextMenu items={contextItems}>{articleButton}</ContextMenu>;
  }

  return articleButton;
}

function ArticleCard({
  article,
  gameState,
  onSelect,
  onSelectTeam,
}: {
  article: NewsArticle;
  gameState: GameStateData;
  onSelect: () => void;
  onSelectTeam?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatNewsDate = (date: string) => fmtMatchDate(date, i18n.language);
  const contextItems = buildArticleTeamMenuItems(t, article, gameState, onSelectTeam);
  const meta = getCategoryMeta(article.category, t);

  const articleButton = (
    <button
      data-testid={`news-article-${article.id}`}
      onClick={onSelect}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-app-border bg-app-bg text-left transition-all hover:border-app-green/50 hover:bg-white/5"
    >
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className={cx("inline-flex items-center gap-1 rounded-full bg-app-green/10 px-2 py-0.5 text-[9px] font-heading font-bold uppercase tracking-widest", meta.color)}>
            {meta.icon}
            {meta.label}
          </span>
        </div>

        <h3 className="mb-2 text-sm font-heading font-bold leading-snug text-app-text transition-colors group-hover:text-app-green">
          {article.headline}
        </h3>

        {article.match_score ? <MatchScore article={article} gameState={gameState} size="sm" /> : null}

        <p className="line-clamp-2 flex-1 text-xs leading-relaxed text-app-text-muted">{article.body}</p>

        <div className="mt-3 flex items-center justify-between border-t border-app-border/50 pt-2">
          <span className="text-[10px] font-heading uppercase tracking-widest text-app-text-muted">{article.source}</span>
          <span className="flex items-center gap-1 text-[10px] text-app-text-muted">
            <Clock className="h-3 w-3" />
            {formatNewsDate(article.date)}
          </span>
        </div>
      </div>
    </button>
  );

  if (contextItems.length > 0) {
    return <ContextMenu items={contextItems}>{articleButton}</ContextMenu>;
  }

  return articleButton;
}

function ArticleDetail({
  article,
  gameState,
  onBack,
  onSelectTeam,
}: {
  article: NewsArticle;
  gameState: GameStateData;
  onBack: () => void;
  onSelectTeam?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const formatNewsDate = (date: string) => fmtMatchDate(date, i18n.language);
  const meta = getCategoryMeta(article.category, t);

  return (
    <div className="mx-auto flex min-h-max max-w-[1100px] flex-col gap-4">
      <button
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-green"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("news.backToNews")}
      </button>

      <article className="overflow-hidden rounded-xl border border-app-border bg-app-card">
        <div className="border-b border-app-border/50 bg-app-bg p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className={cx("inline-flex items-center gap-1.5 rounded-full bg-app-green/10 px-2.5 py-1 text-[10px] font-heading font-bold uppercase tracking-widest", meta.color)}>
              {meta.icon}
              {meta.label}
            </span>
            <span className="flex items-center gap-1 text-xs text-app-text-muted">
              <Clock className="h-3.5 w-3.5" />
              {formatNewsDate(article.date)}
            </span>
          </div>
          <h1 className="text-2xl font-heading font-bold leading-tight text-app-text">{article.headline}</h1>
        </div>

        <div className="p-6">
          {article.match_score ? <MatchScore article={article} gameState={gameState} size="detail" /> : null}

          <div className="whitespace-pre-line text-sm leading-relaxed text-app-text-muted">{article.body}</div>

          <ArticleFooter article={article} gameState={gameState} onSelectTeam={onSelectTeam} sourcePrefix="— " />
        </div>
      </article>
    </div>
  );
}

function MatchScore({ article, gameState, size }: { article: NewsArticle; gameState: GameStateData; size: "sm" | "lg" | "detail" }) {
  if (!article.match_score) {
    return null;
  }

  const isSmall = size === "sm";

  return (
    <div className={cx("mb-3 flex items-center rounded-lg bg-app-card", isSmall ? "gap-2" : "justify-center gap-4 p-3", size === "detail" && "mb-6 rounded-xl bg-app-bg p-4")}>
      <span className={cx("font-heading font-bold text-app-text", isSmall ? "text-xs" : "text-sm")}>
        {getTeamName(gameState.teams, article.match_score.home_team_id)}
      </span>
      <span className={cx("rounded-lg bg-app-green/10 font-heading font-bold text-app-green", isSmall ? "px-1.5 py-0.5 text-xs" : "px-3 py-1 text-lg", size === "detail" && "px-4 py-2 text-2xl")}>
        {article.match_score.home_goals} – {article.match_score.away_goals}
      </span>
      <span className={cx("font-heading font-bold text-app-text", isSmall ? "text-xs" : "text-sm")}>
        {getTeamName(gameState.teams, article.match_score.away_team_id)}
      </span>
    </div>
  );
}

function ArticleFooter({
  article,
  gameState,
  onSelectTeam,
  sourcePrefix = "",
  renderTeamButtons = true,
}: {
  article: NewsArticle;
  gameState: GameStateData;
  onSelectTeam?: (id: string) => void;
  sourcePrefix?: string;
  renderTeamButtons?: boolean;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-app-border/50 pt-3">
      <p className="text-[10px] font-heading uppercase tracking-widest text-app-text-muted">
        {sourcePrefix}{article.source}
      </p>
      {(article.team_ids ?? []).length > 0 && onSelectTeam ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {(article.team_ids ?? []).slice(0, 3).map((teamId) => {
            const teamName = getTeamName(gameState.teams, teamId);
            const className = "cursor-pointer rounded-md bg-app-green/10 px-2 py-0.5 text-[10px] font-heading font-bold uppercase tracking-wider text-app-green transition-colors hover:bg-app-green/20";

            if (!renderTeamButtons) {
              return (
                <span
                  key={teamId}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectTeam(teamId);
                  }}
                  className={className}
                >
                  {teamName}
                </span>
              );
            }

            return (
              <button
                key={teamId}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectTeam(teamId);
                }}
                className={className}
              >
                {teamName}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
