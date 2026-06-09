import { useTranslation } from "react-i18next";
import type { PlayerData } from "../../store/gameStore";
import { Badge, Button, CountryFlag } from "../ui";
import { GitCompareArrows } from "lucide-react";
import { calcAge, getPlayerOvr, getPlayerOvrForPosition, positionBadgeVariant } from "../../lib/helpers";
import { normalisePosition, translatePositionLabel } from "../squad/SquadTab.helpers";

const ATTRIBUTE_GROUPS: {
  labelKey: string;
  attrs: Array<keyof PlayerData["attributes"]>;
}[] = [
    {
      labelKey: "common.attrGroups.physical",
      attrs: ["pace", "stamina", "strength", "agility"],
    },
    {
      labelKey: "common.attrGroups.technical",
      attrs: ["passing", "shooting", "tackling", "dribbling", "defending"],
    },
    {
      labelKey: "common.attrGroups.mental",
      attrs: [
        "positioning",
        "vision",
        "decisions",
        "composure",
        "aggression",
        "teamwork",
        "leadership",
      ],
    },
    {
      labelKey: "common.attrGroups.goalkeeper",
      attrs: ["handling", "reflexes", "aerial"],
    },
  ];

interface TacticsPlayerFocusPanelProps {
  canConfirmSwap: boolean;
  comparePlayer: PlayerData | null;
  onConfirmSwap: () => void;
  selectedPlayer: PlayerData | null;
  xiActivePosition?: Map<string, string>;
}

function valueTone(value: number): string {
  if (value >= 80) return "text-success-500";
  if (value >= 65) return "text-primary-400";
  if (value >= 50) return "text-accent-400";
  return "text-app-text-muted";
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getNormalizedPlayerPosition(player: PlayerData): string {
  return normalisePosition(player.natural_position || player.position);
}

function PlayerSummary({
  label,
  player,
  xiActivePosition,
}: {
  label: "selected" | "compare";
  player: PlayerData;
  xiActivePosition?: Map<string, string>;
}) {
  const { t } = useTranslation();
  const assignedPosition = xiActivePosition?.get(player.id) ?? null;
  const normalizedPosition = assignedPosition ? normalisePosition(assignedPosition) : getNormalizedPlayerPosition(player);
  const displayPosition = assignedPosition ?? player.natural_position ?? player.position;
  const overallRating = assignedPosition ? getPlayerOvrForPosition(player, assignedPosition) : getPlayerOvr(player);
  const displayLabel = label === "selected" ? "Selected" : "Compare";

  return (
    <div className="rounded-xl border border-app-border bg-[#151d28] px-4 py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_44px] items-start gap-2">
        <div className="min-w-0">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-app-text-muted">
            {displayLabel}
          </p>
          <p className="mt-1 line-clamp-2 break-words text-base font-heading font-bold leading-tight text-app-text" title={player.full_name}>
            {player.full_name}
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant={positionBadgeVariant(normalizedPosition)} size="sm">
              {translatePositionLabel(t, displayPosition)}
            </Badge>
            <span className="shrink-0 whitespace-nowrap text-xs text-app-text-muted">
              <CountryFlag
                code={player.nationality}
                className="mr-1 text-xs leading-none"
              />
              {t("common.age")} {calcAge(player.date_of_birth)}
            </span>
          </div>
        </div>
        <div className="w-11 shrink-0 rounded-md border border-app-border/70 bg-black/15 px-1.5 py-1.5 text-center">
          <div className="text-[8px] font-heading font-bold uppercase tracking-wider text-app-text-muted">
            {t("common.ovr")}
          </div>
          <div className="text-xl font-heading font-bold leading-none text-primary-400">
            {overallRating}
          </div>
        </div>
      </div>
    </div>
  );
}

function SinglePlayerAttributes({ player }: { player: PlayerData }) {
  const { t } = useTranslation();
  const isGoalkeeper = getNormalizedPlayerPosition(player) === "Goalkeeper";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ATTRIBUTE_GROUPS.filter(
        (group) =>
          group.labelKey !== "common.attrGroups.goalkeeper" || isGoalkeeper,
      ).map((group) => (
        <div key={group.labelKey} className="rounded-lg border border-app-border/60 bg-[#151d28] p-2.5">
          <h4 className="mb-2 text-[10px] font-heading font-bold uppercase tracking-widest text-app-text-muted">
            {t(group.labelKey)}
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {group.attrs.map((attr) => {
              const value = player.attributes[attr];
              return (
                <div
                  key={attr}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate text-[11px] text-app-text-muted">
                    {t(`common.attributes.${attr}`)}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-heading font-bold tabular-nums ${valueTone(value)}`}
                  >
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareAttributes({
  canConfirmSwap,
  comparePlayer,
  onConfirmSwap,
  selectedPlayer,
  xiActivePosition,
}: {
  canConfirmSwap: boolean;
  comparePlayer: PlayerData;
  onConfirmSwap: () => void;
  selectedPlayer: PlayerData;
  xiActivePosition?: Map<string, string>;
}) {
  const { t } = useTranslation();
  const showGoalkeeperAttrs =
    getNormalizedPlayerPosition(selectedPlayer) === "Goalkeeper" ||
    getNormalizedPlayerPosition(comparePlayer) === "Goalkeeper";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <PlayerSummary
          label="selected"
          player={selectedPlayer}
          xiActivePosition={xiActivePosition}
        />
        <PlayerSummary
          label="compare"
          player={comparePlayer}
          xiActivePosition={xiActivePosition}
        />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-[#151d28] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-app-text-muted">
          {t("tactics.compareSelectionHint")}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={onConfirmSwap}
          disabled={!canConfirmSwap}
        >
          {t("tactics.confirmSwap")}
        </Button>
      </div>
      {ATTRIBUTE_GROUPS.filter(
        (group) =>
          group.labelKey !== "common.attrGroups.goalkeeper" ||
          showGoalkeeperAttrs,
      ).map((group) => (
        <div key={group.labelKey} className="rounded-lg border border-app-border/60 bg-[#151d28] p-2.5">
          <h4 className="text-[10px] font-heading font-bold uppercase tracking-widest text-app-text-muted mb-2">
            {t(group.labelKey)}
          </h4>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {group.attrs.map((attr) => {
              const left = selectedPlayer.attributes[attr];
              const right = comparePlayer.attributes[attr];
              const leftWins = left > right;
              const rightWins = right > left;
              return (
                <div
                  key={attr}
                  className="grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2"
                >
                  <span
                    className={cx(
                      "text-center text-xs font-heading font-bold tabular-nums",
                      leftWins ? "text-success-500" : valueTone(left),
                    )}
                  >
                    {left}
                  </span>
                  <span className="truncate text-center text-[10px] font-heading font-bold uppercase tracking-wider text-app-text-muted">
                    {t(`common.attributes.${attr}`)}
                  </span>
                  <span
                    className={cx(
                      "text-center text-xs font-heading font-bold tabular-nums",
                      rightWins ? "text-success-500" : valueTone(right),
                    )}
                  >
                    {right}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TacticsPlayerFocusPanel({
  canConfirmSwap,
  comparePlayer,
  onConfirmSwap,
  selectedPlayer,
  xiActivePosition,
}: TacticsPlayerFocusPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-xl border border-app-border bg-app-card">
      <div className="border-b border-app-border/50 bg-[#111923] px-4 py-3">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-app-text-muted">
          <GitCompareArrows className="h-4 w-4 text-accent-400" />
          PLAYER FOCUS
        </h3>
      </div>
      <div className="p-3">
        {selectedPlayer ? (
          comparePlayer ? (
            <CompareAttributes
              canConfirmSwap={canConfirmSwap}
              comparePlayer={comparePlayer}
              onConfirmSwap={onConfirmSwap}
              selectedPlayer={selectedPlayer}
            />
          ) : (
            <div className="space-y-3">
              <PlayerSummary
                label="selected"
                player={selectedPlayer}
              />
              <div className="rounded-lg border border-dashed border-app-border px-3 py-2 text-xs text-app-text-muted">
                {t("tactics.selectSecondPlayer")}
              </div>
              <SinglePlayerAttributes player={selectedPlayer} />
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-app-border px-4 py-8 text-center">
            <GitCompareArrows className="mx-auto mb-3 h-10 w-10 text-app-border" />
            <p className="text-sm text-app-text-muted">
              {t("tactics.selectPitchPlayer")}
            </p>
            <p className="mt-2 text-xs text-app-text-muted">
              {t("tactics.selectAnotherToSwap")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
