import type { PlayerSeasonStats } from "../../store/gameStore";
import { Card, CardBody, CardHeader } from "../ui";

type TranslateFn = (key: string) => string;

interface PlayerProfileSeasonStatsCardProps {
    stats: PlayerSeasonStats;
    t: TranslateFn;
}

export default function PlayerProfileSeasonStatsCard({
    stats,
    t,
}: PlayerProfileSeasonStatsCardProps) {
    return (
        <Card>
            <CardHeader>{t("playerProfile.seasonStats")}</CardHeader>
            <CardBody>
                <div className="grid grid-cols-3 gap-2">
                    <StatBox label={t("playerProfile.apps")} value={stats.appearances} />
                    <StatBox label={t("playerProfile.goals")} value={stats.goals} />
                    <StatBox label={t("playerProfile.assists")} value={stats.assists} />
                    <StatBox label={t("playerProfile.mins")} value={stats.minutes_played} />
                    <StatBox
                        label={t("playerProfile.cleanSheets")}
                        value={stats.clean_sheets}
                    />
                    <StatBox
                        label={t("playerProfile.yellows")}
                        value={stats.yellow_cards}
                    />
                    <StatBox label={t("playerProfile.reds")} value={stats.red_cards} />
                    <StatBox
                        label={t("playerProfile.avgRating")}
                        value={stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : "-"}
                    />
                </div>
            </CardBody>
        </Card>
    );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="min-w-0 text-center p-2.5 bg-app-bg rounded-lg">
            <p className="font-heading font-bold text-base text-app-text tabular-nums truncate">
                {value}
            </p>
            <p className="text-[10px] text-app-text-muted font-heading uppercase tracking-wider truncate">
                {label}
            </p>
        </div>
    );
}