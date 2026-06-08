import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BedDouble,
  Brain,
  Crosshair,
  Feather,
  Flame,
  HeartPulse,
  Info,
  Scale,
  Shield,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { GameStateData } from "../../store/gameStore";
import { isSeniorSquadPlayer } from "../../lib/playerSquad";
import { setTraining, setTrainingSchedule } from "../../services/trainingService";
import { ProgressBar } from "../ui";
import TrainingGroupsCard from "./TrainingGroupsCard";
import TrainingSettingsPanel from "./TrainingSettingsPanel";
import { getTrainingStaffAdvice } from "./trainingAdvice";

interface TrainingTabProps {
  gameState: GameStateData;
  onGameUpdate?: (state: GameStateData) => void;
}

const TRAINING_FOCUS_IDS = [
  "Physical",
  "Technical",
  "Tactical",
  "Defending",
  "Attacking",
  "Recovery",
] as const;

const TRAINING_FOCUS_ICONS: Record<string, ReactNode> = {
  Physical: <HeartPulse className="w-6 h-6" />,
  Technical: <Crosshair className="w-6 h-6" />,
  Tactical: <Brain className="w-6 h-6" />,
  Defending: <Shield className="w-6 h-6" />,
  Attacking: <Zap className="w-6 h-6" />,
  Recovery: <BedDouble className="w-6 h-6" />,
};

const TRAINING_FOCUS_ATTRS: Record<string, string[]> = {
  Physical: ["pace", "stamina", "strength", "agility"],
  Technical: ["passing", "shooting", "dribbling"],
  Tactical: ["positioning", "vision", "decisions", "composure"],
  Defending: ["tackling", "defending", "strength", "positioning"],
  Attacking: ["shooting", "dribbling", "pace"],
  Recovery: [],
};

const INTENSITY_IDS = ["Low", "Medium", "High"] as const;

const INTENSITY_COLORS: Record<string, string> = {
  Low: "text-blue-500",
  Medium: "text-accent-500",
  High: "text-red-500",
};

const SCHEDULE_IDS = ["Intense", "Balanced", "Light"] as const;

const SCHEDULE_ICONS: Record<string, ReactNode> = {
  Intense: <Flame className="w-5 h-5" />,
  Balanced: <Scale className="w-5 h-5" />,
  Light: <Feather className="w-5 h-5" />,
};

const SCHEDULE_COLORS: Record<string, string> = {
  Intense: "text-red-500",
  Balanced: "text-primary-500",
  Light: "text-blue-500",
};

const SCHEDULE_TRAINING_DAYS: Record<string, number[]> = {
  Intense: [0, 1, 2, 3, 4, 5],
  Balanced: [0, 1, 3, 4],
  Light: [1, 3],
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type TrainingViewTab = "Overview" | "Groups";

function getWeekdayFromDate(dateStr: string): number {
  const date = new Date(dateStr);
  return (date.getUTCDay() + 6) % 7;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function TemplateCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-app-border bg-app-card", className)}>{children}</div>;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{children}</h3>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      {action ? <span className="text-[10px] font-semibold text-app-green">{action}</span> : null}
    </div>
  );
}

function TrainingStatRow({ label, value, tone = "text-app-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-app-text-muted">{label}</span>
      <span className={cx("font-bold", tone)}>{value}</span>
    </div>
  );
}

export default function TrainingTab({
  gameState,
  onGameUpdate,
}: TrainingTabProps) {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );

  if (!myTeam) {
    return (
      <p className="text-gray-500 dark:text-gray-400">{t("common.noTeam")}</p>
    );
  }

  const currentFocus = myTeam.training_focus || "Physical";
  const currentIntensity = myTeam.training_intensity || "Medium";
  const currentSchedule = myTeam.training_schedule || "Balanced";
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TrainingViewTab>("Overview");

  const roster = gameState.players.filter(
    (player) => player.team_id === myTeam.id && isSeniorSquadPlayer(player),
  );
  const avgCondition =
    roster.length > 0
      ? Math.round(
        roster.reduce((sum, player) => sum + player.condition, 0) / roster.length,
      )
      : 0;
  const avgMorale =
    roster.length > 0
      ? Math.round(
        roster.reduce((sum, player) => sum + player.morale, 0) / roster.length,
      )
      : 0;
  const exhaustedCount = roster.filter((player) => player.condition < 40).length;
  const criticalCount = roster.filter((player) => player.condition < 25).length;

  const todayWeekday = getWeekdayFromDate(gameState.clock.current_date);
  const trainingDays =
    SCHEDULE_TRAINING_DAYS[currentSchedule] || SCHEDULE_TRAINING_DAYS.Balanced;
  const isTodayTraining = trainingDays.includes(todayWeekday);

  const handleSetTraining = async (focus: string, intensity: string) => {
    setIsSaving(true);
    try {
      const updated = await setTraining(focus, intensity);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to set training:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetSchedule = async (schedule: string) => {
    setIsSaving(true);
    try {
      const updated = await setTrainingSchedule(schedule);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to set schedule:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const activeFocusAttrs = TRAINING_FOCUS_ATTRS[currentFocus] || [];
  const staffAdvice = getTrainingStaffAdvice(t, {
    criticalCount,
    avgCondition,
    exhaustedCount,
    currentSchedule,
    currentFocus,
  });

  const sortedFitnessRoster = [...roster].sort((left, right) => left.condition - right.condition);
  const staffAdviceTone = staffAdvice?.level === "critical"
    ? { border: "border-red-500/35", bg: "bg-red-500/10", text: "text-red-400", icon: <AlertTriangle className="h-4 w-4" /> }
    : staffAdvice?.level === "warn"
      ? { border: "border-amber-500/35", bg: "bg-amber-500/10", text: "text-amber-400", icon: <AlertTriangle className="h-4 w-4" /> }
      : { border: "border-blue-400/35", bg: "bg-blue-400/10", text: "text-blue-300", icon: <Info className="h-4 w-4" /> };
  const trainingLoad = currentSchedule === "Intense" || currentIntensity === "High" ? "High" : currentSchedule === "Light" || currentIntensity === "Low" ? "Light" : "Balanced";

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">TRAINING</h1>
          <p className="text-sm text-app-text-muted">
            {myTeam.name} &bull; {currentFocus} Focus &bull; {currentSchedule} / {currentIntensity}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            <HeartPulse className="h-4 w-4 text-app-green" />
            {t("training.avgCondition")}: <span className="font-bold text-app-text">{avgCondition}%</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            <Brain className="h-4 w-4 text-app-green" />
            {currentFocus}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg">
            {isTodayTraining ? <Flame className="h-4 w-4" /> : <BedDouble className="h-4 w-4" />}
            {isTodayTraining ? t("training.aTrainingDay") : t("training.aRestDay")}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-app-border/50 px-2">
        {(["Overview", "Groups"] as TrainingViewTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cx(
              "pb-3 -mb-[2px] text-sm whitespace-nowrap transition-colors",
              activeTab === tab ? "border-b-2 border-app-green font-semibold text-app-green" : "font-medium text-app-text-muted hover:text-white",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" ? (
        <div className="mt-2 flex flex-col gap-4 xl:h-[750px] xl:flex-row">
          {/* LEFT — Controls */}
          <section className="flex min-w-0 flex-1 flex-col xl:h-full xl:overflow-y-auto pr-1 custom-scrollbar">
            <TrainingSettingsPanel
              currentFocus={currentFocus}
              currentIntensity={currentIntensity}
              currentSchedule={currentSchedule}
              isSaving={isSaving}
              todayWeekday={todayWeekday}
              isTodayTraining={isTodayTraining}
              activeFocusAttrs={activeFocusAttrs}
              onSetTraining={handleSetTraining}
              onSetSchedule={handleSetSchedule}
              scheduleIds={SCHEDULE_IDS}
              scheduleIcons={SCHEDULE_ICONS}
              scheduleColors={SCHEDULE_COLORS}
              scheduleTrainingDays={SCHEDULE_TRAINING_DAYS}
              dayKeys={DAY_KEYS}
              trainingFocusIds={TRAINING_FOCUS_IDS}
              trainingFocusIcons={TRAINING_FOCUS_ICONS}
              trainingFocusAttrs={TRAINING_FOCUS_ATTRS}
              intensityIds={INTENSITY_IDS}
              intensityColors={INTENSITY_COLORS}
            />
          </section>

          {/* RIGHT — Status */}
          <aside className="w-full shrink-0 xl:h-full xl:w-[420px] xl:overflow-y-auto pr-1 custom-scrollbar">
            <TemplateCard className="flex flex-col">
              {staffAdvice ? (
                <div className={cx("flex items-start gap-3 border-b border-app-border/50 p-4", staffAdviceTone.bg)}>
                  <div className={cx("mt-0.5", staffAdviceTone.text)}>{staffAdviceTone.icon}</div>
                  <div>
                    <p className={cx("text-[10px] font-bold uppercase tracking-wider", staffAdviceTone.text)}>
                      {staffAdvice.level === "critical"
                        ? t("training.staffAlert")
                        : staffAdvice.level === "warn"
                          ? t("training.staffWarning")
                          : t("training.staffSuggestion")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-app-text-muted">{staffAdvice.message}</p>
                  </div>
                </div>
              ) : null}

              {/* Squad fitness summary */}
              <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                  <SectionLabel>{t("training.avgCondition")}</SectionLabel>
                  <span className="text-[10px] font-semibold text-app-green">{roster.length} {t("training.players")}</span>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-app-text-muted">{t("training.avgCondition")}</span>
                    <span className="font-bold text-app-text">{avgCondition}%</span>
                  </div>
                  <ProgressBar value={avgCondition} variant="auto" size="md" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-app-text-muted">{t("training.avgMorale")}</span>
                    <span className="font-bold text-app-text">{avgMorale}%</span>
                  </div>
                  <ProgressBar value={avgMorale} variant="auto" size="md" />
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-app-border/50 pt-3">
                  <div className="rounded-lg bg-app-bg p-2.5 text-center">
                    <p className={cx("text-lg font-bold", criticalCount > 0 ? "text-red-400" : "text-app-green")}>{criticalCount}</p>
                    <p className="text-[10px] uppercase tracking-wider text-app-text-muted">Critical</p>
                  </div>
                  <div className="rounded-lg bg-app-bg p-2.5 text-center">
                    <p className={cx("text-lg font-bold", exhaustedCount > 0 ? "text-amber-400" : "text-app-green")}>{exhaustedCount}</p>
                    <p className="text-[10px] uppercase tracking-wider text-app-text-muted">Exhausted</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-app-border/50 pt-3">
                  <TrainingStatRow label="Today" value={isTodayTraining ? t("training.aTrainingDay") : t("training.aRestDay")} tone={isTodayTraining ? "text-app-green" : "text-blue-300"} />
                  <TrainingStatRow label="Training Load" value={trainingLoad} tone={trainingLoad === "High" ? "text-red-400" : trainingLoad === "Light" ? "text-blue-300" : "text-app-green"} />
                  <TrainingStatRow label="Intensity" value={currentIntensity} tone={INTENSITY_COLORS[currentIntensity]} />
                </div>
                {criticalCount > 0 ? (
                  <p className="flex items-center gap-2 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{t("training.criticalCondition", { count: criticalCount })}</p>
                ) : null}
                {exhaustedCount > 0 ? (
                  <p className="flex items-center gap-2 text-xs text-amber-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{t("training.exhaustedPlayers", { count: exhaustedCount })}</p>
                ) : null}
              </div>

              {/* Player fitness list */}
              <div className="border-t border-app-border/50">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <SectionLabel>PLAYER FITNESS</SectionLabel>
                  <span className="text-[10px] font-semibold text-app-green">Lowest first</span>
                </div>
                <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  {sortedFitnessRoster.map((player) => (
                    <div key={player.id} className="flex items-center gap-3 border-b border-app-border/30 px-4 py-2.5 last:border-b-0 hover:bg-white/5">
                      <div className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                        player.condition < 25 ? "border-red-500/30 bg-red-500/10 text-red-400" : player.condition < 40 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-app-border bg-app-bg text-app-green",
                      )}>
                        {player.condition}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-app-text">{player.match_name}</span>
                      <ProgressBar value={player.condition} variant="auto" size="sm" showLabel className="w-24" />
                    </div>
                  ))}
                </div>
              </div>
            </TemplateCard>
          </aside>
        </div>
      ) : null}

      {activeTab === "Groups" ? (
        <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
          <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar sm:flex xl:w-[280px]">
            {staffAdvice ? (
              <div>
                <SectionTitle title="STAFF ADVICE" action={staffAdvice.level.toUpperCase()} />
                <TemplateCard className={cx("flex items-start gap-3 p-4", staffAdviceTone.border, staffAdviceTone.bg)}>
                  <div className={cx("mt-0.5", staffAdviceTone.text)}>{staffAdviceTone.icon}</div>
                  <div>
                    <p className={cx("text-[10px] font-bold uppercase tracking-wider", staffAdviceTone.text)}>
                      {staffAdvice.level === "critical"
                        ? t("training.staffAlert")
                        : staffAdvice.level === "warn"
                          ? t("training.staffWarning")
                          : t("training.staffSuggestion")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-app-text-muted">{staffAdvice.message}</p>
                  </div>
                </TemplateCard>
              </div>
            ) : null}

            <div>
              <SectionTitle title="SQUAD FITNESS" action={`${roster.length} Players`} />
              <TemplateCard className="flex flex-col gap-4 p-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-app-text-muted">{t("training.avgCondition")}</span>
                    <span className="font-bold text-app-text">{avgCondition}%</span>
                  </div>
                  <ProgressBar value={avgCondition} variant="auto" size="md" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-app-text-muted">{t("training.avgMorale")}</span>
                    <span className="font-bold text-app-text">{avgMorale}%</span>
                  </div>
                  <ProgressBar value={avgMorale} variant="auto" size="md" />
                </div>
                <div className="border-t border-app-border/50 pt-3">
                  <TrainingStatRow label="Critical" value={String(criticalCount)} tone={criticalCount > 0 ? "text-red-400" : "text-app-green"} />
                  <TrainingStatRow label="Exhausted" value={String(exhaustedCount)} tone={exhaustedCount > 0 ? "text-amber-400" : "text-app-green"} />
                </div>
              </TemplateCard>
            </div>

            <div>
              <SectionTitle title="WEEKLY STATUS" action={currentSchedule} />
              <TemplateCard className="flex flex-col gap-3 p-4">
                <TrainingStatRow label="Today" value={isTodayTraining ? t("training.aTrainingDay") : t("training.aRestDay")} tone={isTodayTraining ? "text-app-green" : "text-blue-300"} />
                <TrainingStatRow label="Training Load" value={trainingLoad} tone={trainingLoad === "High" ? "text-red-400" : trainingLoad === "Light" ? "text-blue-300" : "text-app-green"} />
                <TrainingStatRow label="Current Focus" value={currentFocus} tone="text-app-green" />
                <TrainingStatRow label="Schedule" value={currentSchedule} tone="text-app-green" />
                <TrainingStatRow label="Recovery Watch" value={`${criticalCount + exhaustedCount}`} tone={criticalCount + exhaustedCount > 0 ? "text-amber-400" : "text-app-green"} />
                <TrainingStatRow label="Intensity" value={currentIntensity} tone={INTENSITY_COLORS[currentIntensity]} />
                <div className="flex flex-wrap gap-1 border-t border-app-border/50 pt-3">
                  {activeFocusAttrs.length > 0 ? activeFocusAttrs.map((attribute) => (
                    <span key={attribute} className="rounded bg-app-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                      {t(`common.attributes.${attribute}`)}
                    </span>
                  )) : <span className="text-[10px] text-app-text-muted">{t("training.recoveryNote")}</span>}
                </div>
              </TemplateCard>
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col gap-4 h-full overflow-y-auto pr-1 custom-scrollbar">
            <TrainingGroupsCard
              gameState={gameState}
              onGameUpdate={onGameUpdate}
              roster={roster}
              isSaving={isSaving}
              setIsSaving={setIsSaving}
              trainingFocusIds={TRAINING_FOCUS_IDS}
              trainingFocusIcons={TRAINING_FOCUS_ICONS}
            />
          </section>

          <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[380px]">
            <div>
              <SectionTitle title="PLAYER FITNESS" action="Lowest first" />
              <TemplateCard className="overflow-hidden">
                <div className="max-h-[410px] overflow-y-auto custom-scrollbar">
                  {sortedFitnessRoster.map((player) => (
                    <div key={player.id} className="flex items-center gap-3 border-b border-app-border/30 px-4 py-3 last:border-b-0 hover:bg-white/5">
                      <div className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                        player.condition < 25 ? "border-red-500/30 bg-red-500/10 text-red-400" : player.condition < 40 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-app-border bg-app-bg text-app-green",
                      )}>
                        {player.condition}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-app-text">{player.match_name}</span>
                      <ProgressBar value={player.condition} variant="auto" size="sm" showLabel className="w-24" />
                    </div>
                  ))}
                </div>
              </TemplateCard>
            </div>

            <div>
              <SectionTitle title="RECOVERY WATCH" action={criticalCount > 0 ? "Critical" : exhaustedCount > 0 ? "Monitor" : "Clear"} />
              <TemplateCard className="flex flex-col gap-3 p-4">
                {criticalCount > 0 ? (
                  <p className="flex items-center gap-2 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5" />{t("training.criticalCondition", { count: criticalCount })}</p>
                ) : null}
                {exhaustedCount > 0 ? (
                  <p className="flex items-center gap-2 text-xs text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{t("training.exhaustedPlayers", { count: exhaustedCount })}</p>
                ) : null}
                {criticalCount === 0 && exhaustedCount === 0 ? <p className="text-xs text-app-text-muted">Squad load is under control.</p> : null}
              </TemplateCard>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
