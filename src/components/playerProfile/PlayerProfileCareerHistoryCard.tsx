import type { CareerEntry } from "../../store/gameStore";
import { Card, CardBody, CardHeader } from "../ui";

type TranslateFn = (
    key: string,
    options?: Record<string, string | number>,
) => string;

interface PlayerProfileCareerHistoryCardProps {
    career: CareerEntry[];
    t: TranslateFn;
}

export default function PlayerProfileCareerHistoryCard({
    career,
    t,
}: PlayerProfileCareerHistoryCardProps) {
    return (
        <Card>
            <CardHeader>{t("playerProfile.careerHistory")}</CardHeader>
            <CardBody>
                {career.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {career.map((entry, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-navy-600 last:border-0"
                            >
                                <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                                        {entry.team_name}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">
                                        {entry.season}/{entry.season + 1}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-3">
                                    <span>
                                        {t("playerProfile.nApps", { count: entry.appearances })}
                                    </span>
                                    <span>
                                        {t("playerProfile.nGoals", { count: entry.goals })}
                                    </span>
                                    <span>
                                        {t("playerProfile.nAssists", { count: entry.assists })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                        {t("playerProfile.noCareer")}
                    </p>
                )}
            </CardBody>
        </Card>
    );
}