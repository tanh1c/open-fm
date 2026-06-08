import { CalendarDays, Check, Dumbbell, Gauge, Target } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function PanelBlock({
  icon,
  title,
  value,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.4rem] border border-app-border bg-app-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-app-green/25 bg-app-green/10 text-app-green [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-app-text-muted">
              {title}
            </p>
            <p className="mt-0.5 font-heading text-base font-black uppercase tracking-wide text-app-text">
              {value}
            </p>
          </div>
        </div>
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

const INTENSITY_BAR: Record<string, string> = {
  Low: "from-blue-500 to-sky-400",
  Medium: "from-amber-500 to-app-green",
  High: "from-orange-500 to-red-500",
};

const INTENSITY_PCT: Record<string, string> = {
  Low: "34%",
  Medium: "67%",
  High: "100%",
};

interface TrainingSettingsPanelProps {
  currentFocus: string;
  currentIntensity: string;
  currentSchedule: string;
  isSaving: boolean;
  todayWeekday: number;
  isTodayTraining: boolean;
  activeFocusAttrs: string[];
  onSetTraining: (focus: string, intensity: string) => void;
  onSetSchedule: (schedule: string) => void;
  scheduleIds: readonly string[];
  scheduleIcons: Record<string, React.ReactNode>;
  scheduleColors: Record<string, string>;
  scheduleTrainingDays: Record<string, number[]>;
  dayKeys: readonly string[];
  trainingFocusIds: readonly string[];
  trainingFocusIcons: Record<string, React.ReactNode>;
  trainingFocusAttrs: Record<string, string[]>;
  intensityIds: readonly string[];
  intensityColors: Record<string, string>;
}

export default function TrainingSettingsPanel({
  currentFocus,
  currentIntensity,
  currentSchedule,
  isSaving,
  todayWeekday,
  activeFocusAttrs,
  onSetTraining,
  onSetSchedule,
  scheduleIds,
  scheduleIcons,
  scheduleColors,
  scheduleTrainingDays,
  dayKeys,
  trainingFocusIds,
  trainingFocusIcons,
  trainingFocusAttrs,
  intensityIds,
  intensityColors,
}: TrainingSettingsPanelProps) {
  const { t } = useTranslation();
  const currentTrainingDays =
    scheduleTrainingDays[currentSchedule] || scheduleTrainingDays.Balanced || [];

  return (
    <div className="flex flex-col gap-4">
      <PanelBlock
        icon={<CalendarDays />}
        title={t("training.weeklySchedule")}
        value={t(`training.schedules.${currentSchedule}.label`)}
      >
        <div className="grid gap-2.5">
          {scheduleIds.map((scheduleId) => {
            const selected = currentSchedule === scheduleId;
            const days = scheduleTrainingDays[scheduleId] || [];
            return (
              <button
                key={scheduleId}
                disabled={isSaving}
                onClick={() => onSetSchedule(scheduleId)}
                className={cx(
                  "group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                  selected
                    ? "border-app-green/60 bg-app-green/10"
                    : "border-app-border/70 bg-app-bg/80 hover:border-app-green/30 hover:bg-white/5",
                  isSaving && "pointer-events-none opacity-60",
                )}
              >
                <div
                  className={cx(
                    "flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors [&>svg]:h-5 [&>svg]:w-5",
                    selected
                      ? "border-app-green/30 bg-app-green/20 text-app-green"
                      : "border-app-border bg-app-card",
                    scheduleColors[scheduleId],
                  )}
                >
                  {scheduleIcons[scheduleId]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-heading text-sm font-black uppercase tracking-wider text-app-text">
                      {t(`training.schedules.${scheduleId}.label`)}
                    </p>
                    <span className="rounded-full bg-app-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                      {days.length}/7
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-app-text-muted">
                    {t(`training.schedules.${scheduleId}.desc`)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {dayKeys.map((_, idx) => (
                    <span
                      key={idx}
                      className={cx(
                        "h-8 w-1.5 rounded-full transition-colors",
                        days.includes(idx) ? "bg-app-green" : "bg-app-border",
                        selected && days.includes(idx) && "bg-app-green",
                      )}
                    />
                  ))}
                  {selected ? <Check className="ml-1 h-4 w-4 text-app-green" /> : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-2xl border border-app-border/70 bg-app-bg/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-app-text-muted">
              {t("training.thisWeek")}
            </span>
            <span className="truncate text-[10px] text-app-text-muted">
              {t(`training.schedules.${currentSchedule}.detail`)}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {dayKeys.map((dayKey, idx) => {
              const training = currentTrainingDays.includes(idx);
              const today = idx === todayWeekday;
              return (
                <div
                  key={dayKey}
                  className={cx(
                    "flex min-h-[58px] flex-col items-center justify-between rounded-xl border px-1.5 py-2",
                    training
                      ? "border-app-green/25 bg-app-green/10 text-app-green"
                      : "border-app-border bg-app-card text-app-text-muted/60",
                    today && "ring-1 ring-app-green",
                  )}
                >
                  <span className="text-[9px] font-black uppercase tracking-wider">
                    {t(`training.days.${dayKey}`).slice(0, 2)}
                  </span>
                  {training ? (
                    <Dumbbell className="h-3.5 w-3.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PanelBlock>

      <PanelBlock
        icon={<Target />}
        title={t("training.trainingFocus")}
        value={t(`training.focuses.${currentFocus}.label`)}
      >
        <div className="grid grid-cols-2 gap-2.5">
          {trainingFocusIds.map((focusId) => {
            const selected = currentFocus === focusId;
            const attrs = trainingFocusAttrs[focusId] || [];
            return (
              <button
                key={focusId}
                disabled={isSaving}
                onClick={() => onSetTraining(focusId, currentIntensity)}
                className={cx(
                  "group min-h-[128px] overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200",
                  selected
                    ? "border-app-green/60 bg-app-green/10"
                    : "border-app-border/70 bg-app-bg/80 hover:border-app-green/30 hover:bg-white/5",
                  isSaving && "pointer-events-none opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cx(
                      "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors [&>svg]:h-5 [&>svg]:w-5",
                      selected
                        ? "border-app-green/30 bg-app-green/20 text-app-green"
                        : "border-app-border bg-app-card text-app-text-muted",
                    )}
                  >
                    {trainingFocusIcons[focusId]}
                  </div>
                  {selected ? <Check className="h-4 w-4 text-app-green" /> : null}
                </div>
                <p className="mt-3 font-heading text-sm font-black uppercase tracking-wider text-app-text">
                  {t(`training.focuses.${focusId}.label`)}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-app-text-muted">
                  {t(`training.focuses.${focusId}.desc`)}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {attrs.slice(0, 3).map((attribute) => (
                    <span
                      key={attribute}
                      className={cx(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        selected ? "bg-app-green/20 text-app-green" : "bg-app-card text-app-text-muted",
                      )}
                    >
                      {t(`common.attributes.${attribute}`)}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </PanelBlock>

      <PanelBlock
        icon={<Gauge />}
        title={t("training.intensity")}
        value={t(`training.intensities.${currentIntensity}.label`)}
      >
        <div className="rounded-2xl border border-app-border bg-app-bg p-3">
          <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-app-border">
            <div
              className={cx(
                "h-full rounded-full bg-gradient-to-r transition-all duration-300",
                INTENSITY_BAR[currentIntensity] || "from-app-green to-app-green",
              )}
              style={{ width: INTENSITY_PCT[currentIntensity] || "67%" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {intensityIds.map((intensityId) => {
              const selected = currentIntensity === intensityId;
              return (
                <button
                  key={intensityId}
                  disabled={isSaving}
                  onClick={() => onSetTraining(currentFocus, intensityId)}
                  className={cx(
                    "rounded-xl border px-3 py-3 text-center transition-all duration-200",
                    selected
                      ? "border-app-green/50 bg-app-card"
                      : "border-transparent bg-transparent hover:bg-white/5",
                    isSaving && "pointer-events-none opacity-60",
                  )}
                >
                  <p
                    className={cx(
                      "font-heading text-sm font-black uppercase tracking-wider transition-colors",
                      selected ? intensityColors[intensityId] : "text-app-text-muted",
                    )}
                  >
                    {t(`training.intensities.${intensityId}.label`)}
                  </p>
                  <p className="mt-1 text-[10px] leading-tight text-app-text-muted">
                    {t(`training.intensities.${intensityId}.desc`)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-app-text-muted">
          {t("training.trainingAppliedNote")}
          {activeFocusAttrs.length > 0 && (
            <>
              {" "}
              <span
                dangerouslySetInnerHTML={{
                  __html: t("training.currentlyTraining", {
                    attrs: activeFocusAttrs
                      .map((attribute) => t(`common.attributes.${attribute}`))
                      .join(", "),
                    intensity: t(`training.intensities.${currentIntensity}.label`),
                  }),
                }}
              />
            </>
          )}
          {currentFocus === "Recovery" && <> {t("training.recoveryNote")}</>}
        </p>
      </PanelBlock>
    </div>
  );
}
