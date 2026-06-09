import { AlertTriangle, ChevronDown, ChevronUp, Star } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { calcAge, getPlayerOvr, getPlayerOvrForPosition, positionBadgeVariant } from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import { TraitList } from "../TraitBadge";
import { getOverallRatingClassName, type SortKey } from "./TacticsTab.helpers";
import { Badge, ProgressBar } from "../ui";
import {
  getPreferredPositions,
  isPlayerOutOfPosition,
  normalisePosition,
  translatePositionAbbreviation,
  type SquadSection,
} from "../squad/SquadTab.helpers";

interface TacticsPlayerTableProps {
  emptyMessage: string;
  highlightedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  players: PlayerData[];
  section: SquadSection;
  sortDir: "asc" | "desc";
  sortKey: SortKey;
  title: string;
  toggleSort: (key: SortKey) => void;
  totalCount: number;
  xiActivePosition: Map<string, string>;
}

interface SortHeaderProps {
  column: SortKey;
  label: string;
  sortDir: "asc" | "desc";
  sortKey: SortKey;
  toggleSort: (key: SortKey) => void;
}

function renderPreferredPositionMeta(
  player: PlayerData,
  translate: (key: string, options?: { defaultValue?: string }) => string,
): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
      {getPreferredPositions(player).map((position, index) => (
        <Badge
          key={`${player.id}-${position}`}
          variant={index === 0 ? positionBadgeVariant(position) : "neutral"}
          size="sm"
        >
          {translatePositionAbbreviation(translate, position)}
        </Badge>
      ))}
    </div>
  );
}

function SortHeader({
  column,
  label,
  sortDir,
  sortKey,
  toggleSort,
}: SortHeaderProps): JSX.Element {
  const isActive = sortKey === column;

  return (
    <th
      className={`cursor-pointer select-none px-4 py-2.5 font-heading font-bold uppercase tracking-wider transition-colors hover:text-primary-400 ${isActive
          ? "text-primary-400"
          : "text-app-text-muted"
        }`}
      onClick={() => toggleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : null}
      </div>
    </th>
  );
}

function renderTableRow(props: {
  highlightedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  player: PlayerData;
  section: SquadSection;
  xiActivePosition: Map<string, string>;
}): JSX.Element {
  const {
    highlightedPlayerId,
    onSelectPlayer,
    player,
    section,
    xiActivePosition,
  } = props;
  const { t } = useTranslation();
  const activePosition =
    section === "xi"
      ? (xiActivePosition.get(player.id) ?? player.position)
      : player.natural_position || player.position;
  const normalizedActivePosition = normalisePosition(activePosition);
  const isHighlighted = highlightedPlayerId === player.id;
  const isWrongPosition =
    section === "xi" && isPlayerOutOfPosition(player, activePosition);
  const overallRating = section === "xi" ? getPlayerOvrForPosition(player, activePosition) : getPlayerOvr(player);

  return (
    <tr
      key={player.id}
      data-testid={`${section}-player-${player.id}`}
      onClick={() => onSelectPlayer(player.id)}
      className={`group cursor-pointer transition-colors ${isHighlighted
          ? "bg-primary-500/10"
          : "hover:bg-white/[0.03]"
        }`}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Badge
            variant={positionBadgeVariant(normalizedActivePosition)}
            size="sm"
          >
            {translatePositionAbbreviation(t, activePosition)}
          </Badge>
          {isWrongPosition ? (
            <span
              title={t("squad.outOfPositionTooltip")}
              className="text-amber-500"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="text-sm font-semibold text-app-text transition-colors group-hover:text-primary-400">
          {player.full_name}
        </div>
        {renderPreferredPositionMeta(player, t)}
      </td>
      <td className="px-4 py-2.5 text-sm tabular-nums text-app-text-muted">
        {calcAge(player.date_of_birth)}
      </td>
      <td className="w-28 px-4 py-2.5">
        <ProgressBar
          value={player.condition}
          variant="auto"
          size="sm"
          showLabel
        />
      </td>
      <td className="px-4 py-2.5 text-sm tabular-nums text-app-text-muted">
        {player.morale}
      </td>
      <td className="px-4 py-2.5">
        {player.traits.length > 0 ? (
          <TraitList traits={player.traits} size="xs" max={2} />
        ) : (
          <span className="text-xs text-gray-500">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={`text-base font-heading font-bold tabular-nums ${getOverallRatingClassName(
            overallRating,
          )}`}
        >
          {overallRating}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {player.injury ? (
            <Badge variant="danger" size="sm">
              {t("common.injured")}
            </Badge>
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function TacticsPlayerTable({
  emptyMessage,
  highlightedPlayerId,
  onSelectPlayer,
  players,
  section,
  sortDir,
  sortKey,
  title,
  toggleSort,
  totalCount,
  xiActivePosition,
}: TacticsPlayerTableProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-card">
      <div className="border-b border-app-border/50 bg-[#111923] p-4">
        <h3 className="flex items-center gap-2 text-sm font-heading font-bold uppercase tracking-wide text-app-text">
          {section === "xi" ? (
            <Star className="h-4 w-4 fill-current text-accent-400" />
          ) : null}
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-app-text-muted">
          {players.length} / {totalCount} {t("squad.playersLabel")}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-app-border bg-[#151d28] text-xs">
              <SortHeader
                column="pos"
                label={t("squad.pos")}
                sortDir={sortDir}
                sortKey={sortKey}
                toggleSort={toggleSort}
              />
              <SortHeader
                column="name"
                label={t("common.name")}
                sortDir={sortDir}
                sortKey={sortKey}
                toggleSort={toggleSort}
              />
              <SortHeader
                column="age"
                label={t("common.age")}
                sortDir={sortDir}
                sortKey={sortKey}
                toggleSort={toggleSort}
              />
              <SortHeader
                column="condition"
                label={t("common.condition")}
                sortDir={sortDir}
                sortKey={sortKey}
                toggleSort={toggleSort}
              />
              <SortHeader
                column="morale"
                label={t("common.morale")}
                sortDir={sortDir}
                sortKey={sortKey}
                toggleSort={toggleSort}
              />
              <th className="px-4 py-2.5 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                {t("squad.traits")}
              </th>
              <SortHeader
                column="ovr"
                label={t("common.ovr")}
                sortDir={sortDir}
                sortKey={sortKey}
                toggleSort={toggleSort}
              />
              <th className="px-4 py-2.5 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                {t("common.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/60">
            {players.map((player) =>
              renderTableRow({
                highlightedPlayerId,
                onSelectPlayer,
                player,
                section,
                xiActivePosition,
              }),
            )}
          </tbody>
        </table>
        {players.length === 0 ? (
          <div className="p-6 text-center text-sm text-app-text-muted">
            {emptyMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
