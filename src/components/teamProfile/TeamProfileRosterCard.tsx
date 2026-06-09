import { countryName } from "../../lib/countries";
import {
  calcAge,
  formatVal,
  getPlayerOvr,
  positionBadgeVariant,
} from "../../lib/helpers";
import type { PlayerData, PlayerSeasonStats } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { buildViewProfileMenuItem } from "../playerActions/playerContextMenuItems";
import { Badge, Card, CardBody, CardHeader, CountryFlag, ProgressBar } from "../ui";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import type { TeamProfileTranslate } from "./TeamProfile.types";

interface TeamProfileRosterCardProps {
  roster: PlayerData[];
  locale: string;
  t: TeamProfileTranslate;
  rosterStatsByPlayerId?: Record<string, PlayerSeasonStats>;
  onSelectPlayer?: (id: string) => void;
}

function resolveLabel(
  t: TeamProfileTranslate,
  key: string,
  fallback: string,
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function formatRating(value: number | undefined): string {
  if (value === undefined || value <= 0) {
    return "-";
  }

  return value.toFixed(1);
}

function playerStatus(player: PlayerData, t: TeamProfileTranslate): string {
  if (player.injury) {
    return player.injury.name;
  }

  if (player.loan_parent_team_id) {
    return resolveLabel(t, "transfers.loan", "Loan");
  }

  if (player.transfer_listed) {
    return resolveLabel(t, "transfers.transferListed", "Listed");
  }

  if (player.loan_listed) {
    return resolveLabel(t, "transfers.loanListed", "Loan Listed");
  }

  return resolveLabel(t, "finances.contractRiskStable", "Stable");
}

function ovrClass(ovr: number): string {
  if (ovr >= 75) {
    return "text-app-green";
  }
  if (ovr >= 55) {
    return "text-accent-500";
  }
  return "text-app-text-muted";
}

function TableHeader({ label, className = "" }: { label: string; className?: string }) {
  return (
    <th className={`px-3 py-3 font-heading font-bold uppercase tracking-wider text-app-text-muted ${className}`}>
      {label}
    </th>
  );
}

export default function TeamProfileRosterCard({
  roster,
  locale,
  t,
  rosterStatsByPlayerId = {},
  onSelectPlayer,
}: TeamProfileRosterCardProps) {
  return (
    <Card>
      <CardHeader>
        {t("teams.squad")} ({roster.length})
      </CardHeader>
      <CardBody className="p-0">
        <div className="max-h-[620px] overflow-auto custom-scrollbar">
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-app-bg text-[10px]">
              <tr className="border-b border-app-border">
                <TableHeader label="POS" className="pl-4" />
                <TableHeader label="#" className="w-10 text-center" />
                <TableHeader label="PLAYER" className="min-w-[190px]" />
                <TableHeader label="AGE" className="text-center" />
                <TableHeader label="NAT" />
                <TableHeader label="CON" className="w-24 text-center" />
                <TableHeader label="SHP" className="w-24 text-center" />
                <TableHeader label="MORALE" className="w-24 text-center" />
                <TableHeader label="WAGE" className="text-right" />
                <TableHeader label="VALUE" className="text-right" />
                <TableHeader label="APPS" className="text-center" />
                <TableHeader label="GLS" className="text-center" />
                <TableHeader label="AST" className="text-center" />
                <TableHeader label="AV RAT" className="text-center" />
                <TableHeader label="STATUS" />
                <TableHeader label="OVR" className="text-center" />
                <TableHeader label="POT" className="pr-4 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30">
              {roster.map((player, index) => {
                const ovr = getPlayerOvr(player);
                const age = calcAge(player.date_of_birth);
                const stats = rosterStatsByPlayerId[player.id] ?? player.stats;
                const contextItems = onSelectPlayer
                  ? [buildViewProfileMenuItem(t, () => onSelectPlayer(player.id))]
                  : [];
                const playerRow = (
                  <tr
                    key={player.id}
                    data-testid={`team-profile-roster-${player.id}`}
                    onClick={() => onSelectPlayer?.(player.id)}
                    className={`group transition-colors ${onSelectPlayer
                      ? "cursor-pointer hover:bg-white/5"
                      : ""
                      }`}
                  >
                    <td className="px-3 py-3 pl-4">
                      <Badge
                        variant={positionBadgeVariant(
                          player.natural_position || player.position,
                        )}
                      >
                        {translatePositionAbbreviation(
                          t,
                          player.natural_position || player.position,
                        )}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center font-heading text-xs font-bold tabular-nums text-app-text-muted">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-app-text transition-colors group-hover:text-app-green">
                        {player.full_name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-app-text-muted">
                      {age}
                    </td>
                    <td className="px-3 py-3 text-app-text-muted">
                      <div className="flex items-center gap-1.5">
                        <CountryFlag
                          code={player.nationality}
                          locale={locale}
                          className="text-lg leading-none"
                        />
                        <span className="truncate">{countryName(player.nationality, locale)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <ProgressBar
                        value={player.condition}
                        variant="auto"
                        size="sm"
                        showLabel
                        className="mx-auto max-w-[88px]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <ProgressBar
                        value={player.attributes.stamina}
                        variant="auto"
                        size="sm"
                        showLabel
                        className="mx-auto max-w-[88px]"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <ProgressBar
                        value={player.morale}
                        variant="auto"
                        size="sm"
                        showLabel
                        className="mx-auto max-w-[88px]"
                      />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-app-text-muted">
                      {formatVal(player.wage)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-app-text-muted">
                      {formatVal(player.market_value)}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-app-text">
                      {stats.appearances ?? 0}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-app-text">
                      {stats.goals ?? 0}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-app-text">
                      {stats.assists ?? 0}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-app-text">
                      {formatRating(stats.avg_rating)}
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-app-text-muted">
                      {playerStatus(player, t)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-heading text-lg font-bold tabular-nums ${ovrClass(ovr)}`}>
                        {ovr}
                      </span>
                    </td>
                    <td className="px-3 py-3 pr-4 text-center font-heading text-lg font-bold tabular-nums text-app-text">
                      {player.potential ?? ovr}
                    </td>
                  </tr>
                );

                if (contextItems.length > 0) {
                  return (
                    <ContextMenu items={contextItems} key={player.id}>
                      {playerRow}
                    </ContextMenu>
                  );
                }

                return playerRow;
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
