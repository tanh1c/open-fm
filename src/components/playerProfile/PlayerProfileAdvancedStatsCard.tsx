import { Card, CardBody, CardHeader } from "../ui";
import type { PlayerAdvancedStatsSummary } from "./PlayerProfile.helpers";

type TranslateFn = (key: string) => string;

interface PlayerProfileAdvancedStatsCardProps {
    summary: PlayerAdvancedStatsSummary;
    t: TranslateFn;
}

function resolveLabel(t: TranslateFn, key: string, fallback: string): string {
    const translated = t(key);
    return translated === key ? fallback : translated;
}

function formatRate(value: number | null): string {
    if (value === null) {
        return "-";
    }

    return value.toFixed(2);
}

function formatPercentage(value: number | null): string {
    if (value === null) {
        return "-";
    }

    return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function formatOrdinal(value: number | null, unavailableLabel: string): string {
    if (value === null) {
        return unavailableLabel;
    }

    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) {
        return `${value}th`;
    }

    switch (value % 10) {
        case 1:
            return `${value}st`;
        case 2:
            return `${value}nd`;
        case 3:
            return `${value}rd`;
        default:
            return `${value}th`;
    }
}

function AdvancedStatRow({
    label,
    primaryValue,
    secondaryLabel,
    secondaryValue,
    percentile,
    t,
}: {
    label: string;
    primaryValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    percentile: number | null;
    t: TranslateFn;
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)] gap-2 items-center rounded-lg bg-app-bg px-3 py-2.5">
            <div className="min-w-0">
                <p className="font-heading font-bold text-[11px] uppercase tracking-wider text-app-text-muted truncate">
                    {label}
                </p>
                <p className="font-heading font-bold text-base text-app-text tabular-nums truncate">
                    {primaryValue}
                </p>
            </div>

            <div className="min-w-0 text-center">
                <p className="text-[10px] uppercase tracking-wider text-app-text-muted truncate">
                    {secondaryLabel}
                </p>
                <p className="font-heading font-bold text-sm text-app-text tabular-nums truncate">
                    {secondaryValue}
                </p>
            </div>

            <div className="min-w-0 text-center">
                <p className="text-[10px] uppercase tracking-wider text-app-text-muted truncate">
                    {t("playerProfile.percentile")}
                </p>
                <p className="font-heading font-bold text-sm text-app-text tabular-nums truncate">
                    {formatOrdinal(
                        percentile,
                        t("playerProfile.percentileUnavailable"),
                    )}
                </p>
            </div>
        </div>
    );
}

export default function PlayerProfileAdvancedStatsCard({
    summary,
    t,
}: PlayerProfileAdvancedStatsCardProps) {
    const labels = {
        title: t("playerProfile.advancedStats"),
        shots: resolveLabel(t, "playerProfile.shots", "Shots"),
        shotsOnTarget: resolveLabel(
            t,
            "playerProfile.shotsOnTarget",
            "Shots On Target",
        ),
        passes: resolveLabel(t, "playerProfile.passes", "Passes"),
        tacklesWon: resolveLabel(t, "playerProfile.tacklesWon", "Tackles Won"),
        interceptions: resolveLabel(
            t,
            "playerProfile.interceptions",
            "Interceptions",
        ),
        foulsCommitted: resolveLabel(
            t,
            "playerProfile.foulsCommitted",
            "Fouls Committed",
        ),
        per90: resolveLabel(t, "playerProfile.per90", "Per 90"),
        passAccuracy: resolveLabel(
            t,
            "playerProfile.passAccuracy",
            "Pass Accuracy",
        ),
        percentile: resolveLabel(t, "playerProfile.percentile", "Percentile"),
        percentileUnavailable: resolveLabel(
            t,
            "playerProfile.percentileUnavailable",
            "Percentile unavailable",
        ),
    };

    return (
        <Card>
            <CardHeader>{labels.title}</CardHeader>
            <CardBody>
                <div className="space-y-3">
                    <AdvancedStatRow
                        label={labels.shots}
                        primaryValue={String(summary.metrics.shots.total)}
                        secondaryLabel={labels.per90}
                        secondaryValue={formatRate(summary.metrics.shots.per90)}
                        percentile={summary.metrics.shots.percentile}
                        t={(key: string) =>
                            key === "playerProfile.percentile"
                                ? labels.percentile
                                : labels.percentileUnavailable
                        }
                    />
                    <AdvancedStatRow
                        label={labels.shotsOnTarget}
                        primaryValue={String(summary.metrics.shotsOnTarget.total)}
                        secondaryLabel={labels.per90}
                        secondaryValue={formatRate(summary.metrics.shotsOnTarget.per90)}
                        percentile={summary.metrics.shotsOnTarget.percentile}
                        t={(key: string) =>
                            key === "playerProfile.percentile"
                                ? labels.percentile
                                : labels.percentileUnavailable
                        }
                    />
                    <AdvancedStatRow
                        label={labels.passes}
                        primaryValue={`${summary.metrics.passes.completed} / ${summary.metrics.passes.attempted}`}
                        secondaryLabel={labels.passAccuracy}
                        secondaryValue={formatPercentage(summary.metrics.passes.accuracy)}
                        percentile={summary.metrics.passes.percentile}
                        t={(key: string) =>
                            key === "playerProfile.percentile"
                                ? labels.percentile
                                : labels.percentileUnavailable
                        }
                    />
                    <AdvancedStatRow
                        label={labels.tacklesWon}
                        primaryValue={String(summary.metrics.tacklesWon.total)}
                        secondaryLabel={labels.per90}
                        secondaryValue={formatRate(summary.metrics.tacklesWon.per90)}
                        percentile={summary.metrics.tacklesWon.percentile}
                        t={(key: string) =>
                            key === "playerProfile.percentile"
                                ? labels.percentile
                                : labels.percentileUnavailable
                        }
                    />
                    <AdvancedStatRow
                        label={labels.interceptions}
                        primaryValue={String(summary.metrics.interceptions.total)}
                        secondaryLabel={labels.per90}
                        secondaryValue={formatRate(summary.metrics.interceptions.per90)}
                        percentile={summary.metrics.interceptions.percentile}
                        t={(key: string) =>
                            key === "playerProfile.percentile"
                                ? labels.percentile
                                : labels.percentileUnavailable
                        }
                    />
                    <AdvancedStatRow
                        label={labels.foulsCommitted}
                        primaryValue={String(summary.metrics.foulsCommitted.total)}
                        secondaryLabel={labels.per90}
                        secondaryValue={formatRate(summary.metrics.foulsCommitted.per90)}
                        percentile={summary.metrics.foulsCommitted.percentile}
                        t={(key: string) =>
                            key === "playerProfile.percentile"
                                ? labels.percentile
                                : labels.percentileUnavailable
                        }
                    />
                </div>
            </CardBody>
        </Card>
    );
}