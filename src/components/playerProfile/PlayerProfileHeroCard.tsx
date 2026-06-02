import { RotateCcw, Shield, TimerOff, Trash2 } from "lucide-react";
import { countryName } from "../../lib/countries";
import { formatDate, getContractRiskBadgeVariant, getContractYearsRemaining, positionBadgeVariant } from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { buildViewTeamMenuItem } from "../playerActions/playerContextMenuItems";
import { translatePositionLabel } from "../squad/SquadTab.helpers";
import { formatPlayerMarketValue, formatPlayerWage } from "./PlayerProfile.helpers";
import type {
    PlayerProfileScoutStatus,
    ScoutAvailability,
} from "./PlayerProfile.scouting";
import PlayerProfileScoutAction from "./PlayerProfileScoutAction";
import { TraitList } from "../TraitBadge";
import { Badge, Button, Card, CountryFlag } from "../ui";

type TranslateFn = (
    key: string,
    options?: Record<string, string | number>,
) => string;

interface PlayerProfileHeroCardProps {
    player: PlayerData;
    ovr: number;
    primaryPosition: string;
    age: number;
    teamName: string;
    footednessLabel: string;
    weakFootValue: number;
    weeklySuffix: string;
    language: string;
    currentDate: string;
    contractRiskLevel: "critical" | "warning" | "stable";
    contractRiskLabel: string;
    hasLetExpireIntent: boolean;
    actionSubmitting: boolean;
    isOwnClub: boolean;
    scoutAvailability: ScoutAvailability;
    scoutStatus: PlayerProfileScoutStatus;
    scoutError: string | null;
    onScout: () => void;
    onOpenRenewal: () => void;
    onMarkLetExpire: () => void;
    onClearLetExpire: () => void;
    onOpenTermination: () => void;
    onSelectTeam?: (id: string) => void;
    t: TranslateFn;
}

export default function PlayerProfileHeroCard({
    player,
    ovr,
    primaryPosition,
    age,
    teamName,
    footednessLabel,
    weakFootValue,
    weeklySuffix,
    language,
    currentDate,
    contractRiskLevel,
    contractRiskLabel,
    hasLetExpireIntent,
    actionSubmitting,
    isOwnClub,
    scoutAvailability,
    scoutStatus,
    scoutError,
    onScout,
    onOpenRenewal,
    onMarkLetExpire,
    onClearLetExpire,
    onOpenTermination,
    onSelectTeam,
    t,
}: PlayerProfileHeroCardProps) {
    const teamContextItems = player.team_id && onSelectTeam
        ? [buildViewTeamMenuItem(t, () => onSelectTeam(player.team_id!))]
        : [];

    return (
        <Card accent="primary">
            <div className="bg-linear-to-r from-surface-700 to-surface-800 p-5 rounded-t-xl">
                <div className="flex items-start gap-4">
                    <div
                        className={`w-16 h-16 rounded-xl flex items-center justify-center font-heading font-bold text-2xl border-2 shrink-0 ${ovr >= 75
                            ? "bg-primary-500/20 text-primary-400 border-primary-500/30"
                            : ovr >= 55
                                ? "bg-accent-500/20 text-accent-400 border-accent-500/30"
                                : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                            }`}
                    >
                        {ovr}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-heading font-bold text-white uppercase tracking-wide truncate">
                            {player.full_name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            <Badge variant={positionBadgeVariant(primaryPosition)}>
                                {translatePositionLabel(t, primaryPosition)}
                            </Badge>
                            {player.alternate_positions?.map((alternatePosition) => (
                                <Badge key={alternatePosition} variant="neutral">
                                    {translatePositionLabel(t, alternatePosition)}
                                </Badge>
                            ))}
                            <span className="text-gray-400 text-xs">
                                <CountryFlag
                                    code={player.nationality}
                                    locale={language}
                                    className="mr-1 text-sm leading-none"
                                />
                                {countryName(player.nationality, language)}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 text-xs">
                                {t("common.age")} {age}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 text-xs">
                                {t("common.footednessLabel")}: {footednessLabel}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400 text-xs">
                                {t("common.weakFoot")}: {weakFootValue}/5
                            </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5" />
                            {player.team_id && onSelectTeam ? (
                                <ContextMenu items={teamContextItems}>
                                    <button
                                        data-testid="player-profile-team-link"
                                        onClick={() => onSelectTeam(player.team_id!)}
                                        className="hover:text-primary-400 transition-colors underline underline-offset-2"
                                    >
                                        {teamName}
                                    </button>
                                </ContextMenu>
                            ) : (
                                <span>{teamName}</span>
                            )}
                        </p>
                        {player.traits && player.traits.length > 0 ? (
                            <div className="mt-2">
                                <TraitList traits={player.traits} size="sm" />
                            </div>
                        ) : null}

                        <div className="mt-3 grid gap-2 text-xs text-gray-300 sm:grid-cols-2 xl:grid-cols-4">
                            <CompactInfo label={t("playerProfile.dateOfBirth")} value={formatDate(player.date_of_birth, language)} />
                            <CompactInfo
                                label={t("common.contract")}
                                value={
                                    player.contract_end
                                        ? t("finances.contractExpiresOn", { date: player.contract_end })
                                        : t("playerProfile.noContract")
                                }
                            />
                            <CompactInfo
                                label={t("playerProfile.yearsRemaining")}
                                value={getContractYearsRemaining(player.contract_end, currentDate)}
                            />
                            <div className="rounded-lg bg-white/5 px-3 py-2">
                                <p className="font-heading text-[10px] uppercase tracking-wider text-gray-400">
                                    {t("playerProfile.contractRisk")}
                                </p>
                                <Badge variant={getContractRiskBadgeVariant(contractRiskLevel)}>
                                    {contractRiskLabel}
                                </Badge>
                            </div>
                        </div>

                        {isOwnClub ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {hasLetExpireIntent ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        icon={<RotateCcw />}
                                        disabled={actionSubmitting}
                                        onClick={onClearLetExpire}
                                    >
                                        {t("playerProfile.reopenContractTalks")}
                                    </Button>
                                ) : (
                                    <>
                                        <Button size="sm" variant="outline" onClick={onOpenRenewal}>
                                            {t("common.renewContract")}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            icon={<TimerOff />}
                                            disabled={actionSubmitting}
                                            onClick={onMarkLetExpire}
                                        >
                                            {t("playerProfile.letContractExpire")}
                                        </Button>
                                    </>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    icon={<Trash2 />}
                                    className="text-red-400 hover:text-red-300"
                                    disabled={actionSubmitting || player.contract_end === null}
                                    onClick={onOpenTermination}
                                >
                                    {t("playerProfile.terminateContract")}
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    {!isOwnClub ? (
                        <div className="shrink-0">
                            <PlayerProfileScoutAction
                                availability={scoutAvailability}
                                scoutStatus={scoutStatus}
                                scoutError={scoutError}
                                onScout={onScout}
                            />
                        </div>
                    ) : null}

                    <div className="hidden md:grid grid-cols-2 gap-2 shrink-0">
                        <QuickStat
                            label={t("common.condition")}
                            value={`${player.condition}%`}
                            color={player.condition >= 70 ? "text-primary-400" : "text-red-400"}
                        />
                        <QuickStat
                            label={t("common.morale")}
                            value={`${player.morale}%`}
                            color={player.morale >= 70 ? "text-primary-400" : "text-accent-400"}
                        />
                        <QuickStat
                            label={t("common.value")}
                            value={formatPlayerMarketValue(player.market_value)}
                            color="text-white"
                        />
                        <QuickStat
                            label={t("common.wage")}
                            value={formatPlayerWage(player.wage, weeklySuffix)}
                            color="text-white"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-px bg-gray-200 dark:bg-surface-600 md:hidden">
                <MobileQuickStat
                    label={t("common.condition")}
                    value={`${player.condition}%`}
                    color={player.condition >= 70 ? "text-primary-500" : "text-red-500"}
                />
                <MobileQuickStat
                    label={t("common.morale")}
                    value={`${player.morale}%`}
                    color={player.morale >= 70 ? "text-primary-500" : "text-accent-500"}
                />
                <MobileQuickStat
                    label={t("common.value")}
                    value={formatPlayerMarketValue(player.market_value)}
                    color="text-gray-700 dark:text-gray-200"
                />
                <MobileQuickStat
                    label={t("common.wage")}
                    value={formatPlayerWage(player.wage, weeklySuffix)}
                    color="text-gray-700 dark:text-gray-200"
                />
            </div>
        </Card>
    );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-lg bg-white/5 px-3 py-2">
            <p className="truncate font-heading text-[10px] uppercase tracking-wider text-gray-400">
                {label}
            </p>
            <p className="truncate font-heading text-xs font-bold text-white">
                {value}
            </p>
        </div>
    );
}

function QuickStat({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="bg-white/5 rounded-lg px-4 py-2 text-center min-w-24">
            <p className="text-[10px] text-gray-400 font-heading uppercase tracking-wider">
                {label}
            </p>
            <p className={`font-heading font-bold text-base mt-0.5 ${color}`}>
                {value}
            </p>
        </div>
    );
}

function MobileQuickStat({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="bg-white dark:bg-surface-800 p-3 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-heading uppercase tracking-wider">
                {label}
            </p>
            <p className={`font-heading font-bold text-lg mt-0.5 ${color}`}>
                {value}
            </p>
        </div>
    );
}
