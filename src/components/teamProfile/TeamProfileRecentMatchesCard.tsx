import { Card, CardBody, CardHeader } from "../ui";

import type { TeamProfileTranslate, TeamRecentMatchEntry } from "./TeamProfile.types";

interface TeamProfileRecentMatchesCardProps {
  matches: TeamRecentMatchEntry[];
  t: TeamProfileTranslate;
  onSelectMatch?: (fixtureId: string) => void;
}

function resolveLabel(
  t: TeamProfileTranslate,
  key: string,
  fallback: string,
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function matchResult(match: TeamRecentMatchEntry): string {
  if (match.goalsFor > match.goalsAgainst) {
    return "W";
  }
  if (match.goalsFor < match.goalsAgainst) {
    return "L";
  }
  return "D";
}

function resultClass(result: string): string {
  if (result === "W") {
    return "bg-app-green/10 text-app-green";
  }
  if (result === "L") {
    return "bg-red-500/10 text-red-400";
  }
  return "bg-amber-500/10 text-amber-400";
}

export default function TeamProfileRecentMatchesCard({
  matches,
  t,
  onSelectMatch,
}: TeamProfileRecentMatchesCardProps) {
  const title = resolveLabel(t, "teamProfile.recentMatches", "Recent Matches");
  const possessionLabel = resolveLabel(t, "teamProfile.possession", "Possession");
  const shotsLabel = resolveLabel(t, "teamProfile.shots", "Shots");
  const shotsOnTargetLabel = resolveLabel(
    t,
    "teamProfile.shotsOnTarget",
    "Shots On Target",
  );
  const scoreLabel = t("common.score");

  return (
    <Card>
      <CardHeader>{title}</CardHeader>
      <CardBody className="p-0">
        {matches.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-app-text-muted">
            {resolveLabel(t, "teamProfile.noRecentMatches", "No recent matches yet")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-app-bg text-[10px] uppercase tracking-wider text-app-text-muted">
                <tr className="border-b border-app-border">
                  <th className="px-4 py-3 font-heading font-bold">Date</th>
                  <th className="px-4 py-3 font-heading font-bold">Competition</th>
                  <th className="px-4 py-3 text-center font-heading font-bold">MD</th>
                  <th className="px-4 py-3 font-heading font-bold">Opponent</th>
                  <th className="px-4 py-3 text-center font-heading font-bold">{scoreLabel}</th>
                  <th className="px-4 py-3 text-center font-heading font-bold">Result</th>
                  <th className="px-4 py-3 text-center font-heading font-bold">{possessionLabel}</th>
                  <th className="px-4 py-3 text-center font-heading font-bold">{shotsLabel}</th>
                  <th className="px-4 py-3 text-center font-heading font-bold">{shotsOnTargetLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40">
                {matches.map((match) => {
                  const result = matchResult(match);

                  return (
                    <tr
                      key={match.fixtureId}
                      role={onSelectMatch ? "button" : undefined}
                      tabIndex={onSelectMatch ? 0 : undefined}
                      onClick={() => onSelectMatch?.(match.fixtureId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectMatch?.(match.fixtureId);
                        }
                      }}
                      className={`hover:bg-white/[0.03] ${onSelectMatch ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-4 py-3 font-heading text-xs font-bold tabular-nums text-app-text-muted">
                        {match.date}
                      </td>
                      <td className="px-4 py-3 font-semibold text-app-text">
                        {match.competition}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">
                        {match.matchday}
                      </td>
                      <td className="px-4 py-3 font-semibold text-app-text">
                        {match.opponentName}
                      </td>
                      <td className="px-4 py-3 text-center font-heading font-bold tabular-nums text-app-text">
                        {match.goalsFor}-{match.goalsAgainst}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-heading text-xs font-bold ${resultClass(result)}`}>
                          {result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">
                        {match.possessionPct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">
                        {match.shots}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-app-text-muted">
                        {match.shotsOnTarget}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
