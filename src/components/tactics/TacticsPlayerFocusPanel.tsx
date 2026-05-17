import { useTranslation } from "react-i18next";
import type { PlayerData } from "../../store/gameStore";
import { Badge, Button, CountryFlag } from "../ui";
import { GitCompareArrows } from "lucide-react";
import { calcAge, getPlayerOvr, positionBadgeVariant } from "../../lib/helpers";
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
}

function valueTone(value: number): string {
  if (value >= 80) return "text-success-500";
  if (value >= 65) return "text-primary-400";
  if (value >= 50) return "text-accent-400";
  return "text-app-text-muted";
}

function valueBarTone(value: number): string {
  if (value >= 80) return "bg-success-500";
  if (value >= 65) return "bg-primary-500";
  if (value >= 50) return "bg-accent-500";
  return "bg-app-border";
}

function getNormalizedPlayerPosition(player: PlayerData): string {
  return normalisePosition(player.natural_position || player.position);
}

function PlayerSummary({
  label,
  player,
}: {
  label: string;
  player: PlayerData;
}) {
  const { t } = useTranslation();
  const normalizedPosition = getNormalizedPlayerPosition(player);
  const displayPosition = player.natural_position || player.position;
  const overallRating = getPlayerOvr(player);

  return (
    <div className="rounded-xl border border-app-border bg-[#151d28] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-heading font-bold uppercase tracking-widest text-app-text-muted">
            {label}
          </p>
          <p className="text-base font-heading font-bold text-app-text mt-1">
            {player.full_name}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={positionBadgeVariant(normalizedPosition)} size="sm">
              {translatePositionLabel(t, displayPosition)}
            </Badge>
            <span className="text-xs text-app-text-muted">
              <CountryFlag
                code={player.nationality}
                className="text-xs leading-none mr-1"
              />
              {t("common.age")} {calcAge(player.date_of_birth)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-heading font-bold uppercase tracking-widest text-app-text-muted">
            {t("common.ovr")}
          </div>
          <div className="text-3xl font-heading font-bold text-primary-400">
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
    <div className="space-y-4">
      {ATTRIBUTE_GROUPS.filter(
        (group) =>
          group.labelKey !== "common.attrGroups.goalkeeper" || isGoalkeeper,
      ).map((group) => (
        <div key={group.labelKey}>
          <h4 className="text-sm font-heading font-bold uppercase tracking-widest text-app-text-muted mb-2">
            {t(group.labelKey)}
          </h4>
          <div className="space-y-2">
            {group.attrs.map((attr) => {
              const value = player.attributes[attr];
              return (
                <div
                  key={attr}
                  className="grid grid-cols-[minmax(0,1fr)_40px] gap-3 items-center"
                >
                  <div>
                    <div className="text-xs text-app-text-muted mb-1">
                      {t(`common.attributes.${attr}`)}
                    </div>
                    <div className="h-2 rounded-full bg-app-border overflow-hidden">
                      <div
                        className={`h-full rounded-full ${valueBarTone(value)}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                  <span
                    className={`text-sm font-heading font-bold tabular-nums ${valueTone(value)}`}
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
}: {
  canConfirmSwap: boolean;
  comparePlayer: PlayerData;
  onConfirmSwap: () => void;
  selectedPlayer: PlayerData;
}) {
  const { t } = useTranslation();
  const showGoalkeeperAttrs =
    getNormalizedPlayerPosition(selectedPlayer) === "Goalkeeper" ||
    getNormalizedPlayerPosition(comparePlayer) === "Goalkeeper";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <PlayerSummary
          label={t("tactics.selectedPlayer")}
          player={selectedPlayer}
        />
        <PlayerSummary
          label={t("tactics.comparePlayer")}
          player={comparePlayer}
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
        <div key={group.labelKey}>
          <h4 className="text-[10px] font-heading font-bold uppercase tracking-widest text-app-text-muted mb-2">
            {t(group.labelKey)}
          </h4>
          <div className="space-y-2">
            {group.attrs.map((attr) => {
              const left = selectedPlayer.attributes[attr];
              const right = comparePlayer.attributes[attr];
              const leftWins = left > right;
              const rightWins = right > left;
              return (
                <div
                  key={attr}
                  className="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 items-center"
                >
                  <div
                    className={`rounded-lg px-2 py-2 ${leftWins ? "bg-primary-500/10 ring-1 ring-primary-500/20" : "bg-[#151d28]"}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span
                        className={`font-heading font-bold ${valueTone(left)}`}
                      >
                        {left}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-app-border overflow-hidden">
                      <div
                        className={`h-full rounded-full ${valueBarTone(left)}`}
                        style={{ width: `${left}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center text-[10px] font-heading font-bold uppercase tracking-wider text-app-text-muted">
                    {t(`common.attributes.${attr}`)}
                  </div>
                  <div
                    className={`rounded-lg px-2 py-2 ${rightWins ? "bg-primary-500/10 ring-1 ring-primary-500/20" : "bg-[#151d28]"}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span
                        className={`font-heading font-bold ${valueTone(right)}`}
                      >
                        {right}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-app-border overflow-hidden">
                      <div
                        className={`h-full rounded-full ${valueBarTone(right)}`}
                        style={{ width: `${right}%` }}
                      />
                    </div>
                  </div>
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
      <div className="max-h-[520px] overflow-y-auto p-4 pr-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-app-border">
        {selectedPlayer ? (
          comparePlayer ? (
            <CompareAttributes
              canConfirmSwap={canConfirmSwap}
              comparePlayer={comparePlayer}
              onConfirmSwap={onConfirmSwap}
              selectedPlayer={selectedPlayer}
            />
          ) : (
            <div className="space-y-4">
              <PlayerSummary
                label={t("tactics.selectedPlayer")}
                player={selectedPlayer}
              />
              <div className="rounded-xl border border-dashed border-app-border px-4 py-3 text-sm text-app-text-muted">
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
