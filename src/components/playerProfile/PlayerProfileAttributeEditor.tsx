import { useState } from "react";
import { X } from "lucide-react";
import type { PlayerData, GameStateData } from "../../store/gameStore";
import type { PlayerEdits } from "../../services/attributeService";
import { Button } from "../ui";

const POSITIONS = [
    "Goalkeeper",
    "Defender",
    "Midfielder",
    "Forward",
    "RightBack",
    "CenterBack",
    "LeftBack",
    "RightWingBack",
    "LeftWingBack",
    "DefensiveMidfielder",
    "CentralMidfielder",
    "AttackingMidfielder",
    "RightMidfielder",
    "LeftMidfielder",
    "RightWinger",
    "LeftWinger",
    "Striker",
] as const;

const ATTRIBUTE_KEYS = [
    "pace",
    "stamina",
    "strength",
    "agility",
    "passing",
    "shooting",
    "tackling",
    "dribbling",
    "defending",
    "positioning",
    "vision",
    "decisions",
    "composure",
    "aggression",
    "teamwork",
    "leadership",
    "handling",
    "reflexes",
    "aerial",
] as const;

type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface PlayerProfileAttributeEditorProps {
    player: PlayerData;
    teams: GameStateData["teams"];
    submitting: boolean;
    error?: string | null;
    onSubmit: (edits: PlayerEdits) => void;
    onClose: () => void;
    t: TranslateFn;
}

function clamp0to100(value: number): number {
    if (Number.isNaN(value)) {
        return 0;
    }
    return Math.min(100, Math.max(0, Math.round(value)));
}

export default function PlayerProfileAttributeEditor({
    player,
    teams,
    submitting,
    error,
    onSubmit,
    onClose,
    t,
}: PlayerProfileAttributeEditorProps) {
    const [attributes, setAttributes] = useState<Record<AttributeKey, number>>(() => {
        const initial = {} as Record<AttributeKey, number>;
        for (const key of ATTRIBUTE_KEYS) {
            initial[key] = player.attributes[key];
        }
        return initial;
    });
    const [condition, setCondition] = useState(player.condition);
    const [morale, setMorale] = useState(player.morale);
    const [potential, setPotential] = useState(player.potential ?? 0);
    const [position, setPosition] = useState(player.position);
    const [naturalPosition, setNaturalPosition] = useState(
        player.natural_position || player.position,
    );
    const [dateOfBirth, setDateOfBirth] = useState(player.date_of_birth);
    const [teamId, setTeamId] = useState<string>(player.team_id ?? "");
    const [wage, setWage] = useState(player.wage);
    const [marketValue, setMarketValue] = useState(player.market_value);
    const [contractEnd, setContractEnd] = useState(player.contract_end ?? "");

    const inputClass =
        "w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text focus:border-primary-500 focus:outline-none";
    const labelClass =
        "text-xs font-heading font-bold uppercase tracking-wider text-app-text-muted";

    function handleAttributeChange(key: AttributeKey, raw: string): void {
        setAttributes((current) => ({
            ...current,
            [key]: clamp0to100(Number(raw)),
        }));
    }

    function handleSubmit(): void {
        const edits: PlayerEdits = {
            attributes: { ...attributes },
            condition: clamp0to100(condition),
            morale: clamp0to100(morale),
            potential: clamp0to100(potential),
            position,
            natural_position: naturalPosition,
            date_of_birth: dateOfBirth,
            wage: Math.max(0, Math.round(wage)),
            market_value: Math.max(0, Math.round(marketValue)),
            team_id: teamId === "" ? null : teamId,
            contract_end: contractEnd === "" ? null : contractEnd,
        };
        onSubmit(edits);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-app-border bg-app-card shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
                    <div>
                        <h2 className="text-base font-bold uppercase tracking-tight text-app-text">
                            {t("playerProfile.godModeEditor", { defaultValue: "God Mode Editor" })}
                        </h2>
                        <p className="text-xs text-app-text-muted">{player.full_name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
                        aria-label={t("common.close", { defaultValue: "Close" })}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar">
                    <div className="flex flex-col gap-6">
                        {error ? (
                            <div className="rounded-lg border border-app-red/40 bg-app-red/10 px-4 py-3 text-sm text-app-red">
                                {error}
                            </div>
                        ) : null}
                        <section>
                            <h4 className={`${labelClass} mb-3`}>
                                {t("playerProfile.attributes")}
                            </h4>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                {ATTRIBUTE_KEYS.map((key) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-xs text-app-text-muted">
                                            {t(`common.attributes.${key}`)}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={attributes[key]}
                                            onChange={(e) => handleAttributeChange(key, e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h4 className={`${labelClass} mb-3`}>
                                {t("playerProfile.godModeCondition", { defaultValue: "Condition & Potential" })}
                            </h4>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("common.condition")}</label>
                                    <input type="number" min={0} max={100} value={condition} onChange={(e) => setCondition(clamp0to100(Number(e.target.value)))} className={inputClass} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("common.morale")}</label>
                                    <input type="number" min={0} max={100} value={morale} onChange={(e) => setMorale(clamp0to100(Number(e.target.value)))} className={inputClass} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("scouting.potential", { defaultValue: "Potential" })}</label>
                                    <input type="number" min={0} max={100} value={potential} onChange={(e) => setPotential(clamp0to100(Number(e.target.value)))} className={inputClass} />
                                </div>
                            </div>
                        </section>

                        <section>
                            <h4 className={`${labelClass} mb-3`}>
                                {t("playerProfile.godModeProfile", { defaultValue: "Profile & Club" })}
                            </h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("playerProfile.position", { defaultValue: "Position" })}</label>
                                    <select value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass}>
                                        {POSITIONS.map((pos) => (
                                            <option key={pos} value={pos}>{t(`common.posAbbr.${pos}`, { defaultValue: pos })}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("playerProfile.naturalPosition", { defaultValue: "Natural Position" })}</label>
                                    <select value={naturalPosition} onChange={(e) => setNaturalPosition(e.target.value)} className={inputClass}>
                                        {POSITIONS.map((pos) => (
                                            <option key={pos} value={pos}>{t(`common.posAbbr.${pos}`, { defaultValue: pos })}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("common.dateOfBirth", { defaultValue: "Date of Birth" })}</label>
                                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("common.club", { defaultValue: "Club" })}</label>
                                    <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputClass}>
                                        <option value="">{t("common.freeAgent", { defaultValue: "Free Agent" })}</option>
                                        {teams.map((team) => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h4 className={`${labelClass} mb-3`}>
                                {t("playerProfile.godModeContract", { defaultValue: "Contract & Value" })}
                            </h4>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("common.wage")}</label>
                                    <input type="number" min={0} value={wage} onChange={(e) => setWage(Number(e.target.value))} className={inputClass} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("common.value")}</label>
                                    <input type="number" min={0} value={marketValue} onChange={(e) => setMarketValue(Number(e.target.value))} className={inputClass} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-app-text-muted">{t("finances.contractEnd", { defaultValue: "Contract End" })}</label>
                                    <input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} className={inputClass} />
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-app-border px-5 py-4">
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        {t("common.cancel", { defaultValue: "Cancel" })}
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting
                            ? t("common.saving", { defaultValue: "Saving..." })
                            : t("playerProfile.godModeSave", { defaultValue: "Apply Changes" })}
                    </Button>
                </div>
            </div>
        </div>
    );
}
