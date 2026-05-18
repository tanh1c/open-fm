import { GraduationCap, RefreshCcw, ScanSearch, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { StaffData, YouthScoutingAssignment } from "../../store/gameStore";
import { Badge, Button, Card, CardBody, CardHeader, Select } from "../ui";

interface ScoutingYouthRecruitmentCardProps {
    title?: string;
    hint?: string;
    youthAssignments: YouthScoutingAssignment[];
    scouts: StaffData[];
    availableScouts: StaffData[];
    isStarting: boolean;
    selectedScoutId: string;
    region: string;
    objective: string;
    targetPosition: string;
    errorMessage?: string | null;
    embedded?: boolean;
    onScoutChange: (value: string) => void;
    onRegionChange: (value: string) => void;
    onObjectiveChange: (value: string) => void;
    onTargetPositionChange: (value: string) => void;
    onStartSearch: () => void;
    onCancelSearch: (assignmentId: string) => void;
    onReassignSearch: (assignmentId: string, scoutId: string) => void;
}

export default function ScoutingYouthRecruitmentCard({
    title,
    hint,
    youthAssignments,
    scouts,
    availableScouts,
    isStarting,
    selectedScoutId,
    region,
    objective,
    targetPosition,
    errorMessage,
    embedded = false,
    onScoutChange,
    onRegionChange,
    onObjectiveChange,
    onTargetPositionChange,
    onStartSearch,
    onCancelSearch,
    onReassignSearch,
}: ScoutingYouthRecruitmentCardProps) {
    const { t } = useTranslation();
    const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
    const availableScoutCount = availableScouts.length;
    const canStart = availableScoutCount > 0 && selectedScoutId.length > 0 && !isStarting;

    function formatRegion(value?: string): string {
        if (value === "International") return t("scouting.regionInternational");
        return t("scouting.regionDomestic");
    }

    function formatObjective(value?: string): string {
        if (value === "HighPotential") return t("scouting.objectiveHighPotential");
        if (value === "ReadySoon") return t("scouting.objectiveReadySoon");
        return t("scouting.objectiveBalanced");
    }

    function getReassignChoices(assignment: YouthScoutingAssignment): StaffData[] {
        return scouts.filter(
            (scout) =>
                scout.id !== assignment.scout_id &&
                availableScouts.some((candidate) => candidate.id === scout.id),
        );
    }

    function shortPositionLabel(value: string): string {
        if (value === "Defender") return "DEF";
        if (value === "Midfielder") return "MID";
        if (value === "Forward") return "FWD";
        return value;
    }

    const content = (
        <CardBody className="flex min-h-[360px] flex-col gap-3 p-3 pb-5">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-snug text-gray-500 dark:text-gray-400">
                        {hint ?? "Find youth prospects by scout, region, profile, and role."}
                    </p>
                    {embedded ? (
                        <Button size="sm" icon={<ScanSearch />} disabled={!canStart} onClick={onStartSearch}>Start</Button>
                    ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <span className="truncate text-[10px] font-heading uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {"Scout"}
                        </span>
                        <Select
                            fullWidth
                            selectSize="sm"
                            value={selectedScoutId}
                            aria-label={"Scout"}
                            onChange={(event) => onScoutChange(event.target.value)}
                        >
                            <option value="">Select</option>
                            {availableScouts.map((scout) => (
                                <option key={scout.id} value={scout.id}>
                                    {scout.first_name} {scout.last_name}
                                </option>
                            ))}
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <span className="truncate text-[10px] font-heading uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {"Region"}
                        </span>
                        <Select
                            fullWidth
                            selectSize="sm"
                            value={region}
                            aria-label={"Region"}
                            onChange={(event) => onRegionChange(event.target.value)}
                        >
                            <option value="Domestic">Domestic</option>
                            <option value="International">Global</option>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="truncate text-[10px] font-heading uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {"Profile"}
                        </span>
                        <Select
                            fullWidth
                            selectSize="sm"
                            value={objective}
                            aria-label={"Profile"}
                            onChange={(event) => onObjectiveChange(event.target.value)}
                        >
                            <option value="Balanced">Balanced</option>
                            <option value="HighPotential">Potential</option>
                            <option value="ReadySoon">Ready</option>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="truncate text-[10px] font-heading uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {"Role"}
                        </span>
                        <Select
                            fullWidth
                            selectSize="sm"
                            value={targetPosition}
                            aria-label={"Role"}
                            onChange={(event) => onTargetPositionChange(event.target.value)}
                        >
                            <option value="">Any</option>
                            <option value="Defender">DEF</option>
                            <option value="Midfielder">MID</option>
                            <option value="Forward">FWD</option>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="primary" size="sm">
                        {youthAssignments.length} active
                    </Badge>
                    {availableScoutCount === 0 ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t("scouting.noScoutsFree")}
                        </span>
                    ) : null}
                    {errorMessage ? (
                        <span className="text-xs text-red-500">{errorMessage}</span>
                    ) : null}
                </div>

                {youthAssignments.length === 0 ? (
                    <div className="flex items-start gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-surface-600 dark:bg-surface-800/40">
                        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                        <p className="text-xs leading-snug text-gray-500 dark:text-gray-400">
                            No youth searches yet.
                        </p>
                        <span className="sr-only">No youth searches running.</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {youthAssignments.map((assignment) => {
                            const scout = scouts.find((staffMember) => staffMember.id === assignment.scout_id);
                            if (!scout) {
                                return null;
                            }

                            const reassignChoices = getReassignChoices(assignment);
                            const reassignTarget = reassignTargets[assignment.id] ?? reassignChoices[0]?.id ?? "";

                            return (
                                <div
                                    key={assignment.id}
                                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-surface-600 dark:bg-surface-800/60"
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate font-heading text-xs font-bold text-gray-800 dark:text-gray-100">
                                                Youth search
                                            </p>
                                            <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                                {scout.first_name} {scout.last_name}
                                            </p>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                <Badge variant="neutral" size="sm">
                                                    {formatRegion(assignment.region)}
                                                </Badge>
                                                <Badge variant="neutral" size="sm">
                                                    {formatObjective(assignment.objective)}
                                                </Badge>
                                                <Badge variant="neutral" size="sm">
                                                    {assignment.target_position ? shortPositionLabel(assignment.target_position) : "Any"}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-accent-500 shrink-0">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-xs font-heading font-bold">
                                                {t("scouting.daysLeft", { days: assignment.days_remaining })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                icon={<XCircle className="w-4 h-4" />}
                                                onClick={() => onCancelSearch(assignment.id)}
                                            >
Cancel
                                            </Button>
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                            <Select
                                                selectSize="sm"
                                                value={reassignTarget}
                                                aria-label={`${t("scouting.reassignSearch")} ${assignment.id}`}
                                                onChange={(event) =>
                                                    setReassignTargets((current) => ({
                                                        ...current,
                                                        [assignment.id]: event.target.value,
                                                    }))
                                                }
                                                disabled={reassignChoices.length === 0}
                                            >
                                                {reassignChoices.length === 0 ? (
                                                    <option value="">{t("scouting.noAlternateScout")}</option>
                                                ) : (
                                                    reassignChoices.map((candidate) => (
                                                        <option key={candidate.id} value={candidate.id}>
                                                            {candidate.first_name} {candidate.last_name}
                                                        </option>
                                                    ))
                                                )}
                                            </Select>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                icon={<RefreshCcw className="w-4 h-4" />}
                                                disabled={reassignChoices.length === 0 || reassignTarget.length === 0}
                                                onClick={() => onReassignSearch(assignment.id, reassignTarget)}
                                            >
Move
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardBody>
    );

    if (embedded) {
        return content;
    }

    return (
        <Card>
            <CardHeader
                className="px-3 py-3"
                action={
                    <Button
                        size="sm"
                        icon={<ScanSearch />}
                        disabled={!canStart}
                        onClick={onStartSearch}
                    >
                        Start
                    </Button>
                }
            >
                <span>{title ?? "YOUTH"}</span><span className="sr-only">Youth Recruitment</span>
            </CardHeader>
            {content}
        </Card>
    );
}