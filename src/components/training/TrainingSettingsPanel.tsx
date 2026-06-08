import { Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";


function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{children}</h2>;
}

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
  isTodayTraining,
  activeFocusAttrs,
  onSetTraining,
  onSetSchedule,
  scheduleIds,
  scheduleIcons,
  scheduleColors,
  dayKeys,
  trainingFocusIds,
  trainingFocusIcons,
  trainingFocusAttrs,
  intensityIds,
  intensityColors,
}: TrainingSettingsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col rounded-xl border border-app-border bg-app-card">
      {/* Weekly schedule */}
      <div className="p-4">
        <SectionLabel>{t("training.weeklySchedule")}</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {scheduleIds.map((scheduleId) => (
            <button
              key={scheduleId}
              disabled={isSaving}
              onClick={() => onSetSchedule(scheduleId)}
              className={cx(
                "rounded-xl border p-3 text-left transition-all",
                currentSchedule === scheduleId
                  ? "border-app-green/50 bg-app-green/10 shadow-md shadow-app-green/10"
                  : "border-app-border bg-app-bg hover:bg-white/5",
                isSaving && "pointer-events-none opacity-60",
              )}
            >
              <div className={cx("mb-1.5", scheduleColors[scheduleId])}>
                {scheduleIcons[scheduleId]}
              </div>
              <p className="font-heading text-sm font-bold uppercase tracking-wider text-app-text">
                {t(`training.schedules.${scheduleId}.label`)}
              </p>
              <p className="mt-1 text-[11px] text-app-text-muted">
                {t(`training.schedules.${scheduleId}.desc`)}
              </p>
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-app-text-muted">
          {t(`training.schedules.${currentSchedule}.detail`)}{" "}
          <span
            dangerouslySetInnerHTML={{
              __html: t("training.todayIs", {
                day: t(`training.days.${dayKeys[todayWeekday]}`),
                type: isTodayTraining
                  ? t("training.aTrainingDay")
                  : t("training.aRestDay"),
              }),
            }}
          />
        </p>
      </div>

      <div className="h-px bg-app-border/50" />

      {/* Training focus */}
      <div className="p-4">
        <SectionLabel>{t("training.trainingFocus")}</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trainingFocusIds.map((focusId) => (
            <button
              key={focusId}
              disabled={isSaving}
              onClick={() => onSetTraining(focusId, currentIntensity)}
              className={cx(
                "rounded-xl border p-4 text-left transition-all",
                currentFocus === focusId
                  ? "border-app-green/50 bg-app-green/10 shadow-md shadow-app-green/10"
                  : "border-app-border bg-app-bg hover:bg-white/5",
                isSaving && "pointer-events-none opacity-60",
              )}
            >
              <div className={cx("mb-2 [&>svg]:h-5 [&>svg]:w-5", currentFocus === focusId ? "text-app-green" : "text-app-text-muted")}>
                {trainingFocusIcons[focusId]}
              </div>
              <p className="font-heading text-sm font-bold uppercase tracking-wider text-app-text">
                {t(`training.focuses.${focusId}.label`)}
              </p>
              <p className="mt-1 text-xs text-app-text-muted">
                {t(`training.focuses.${focusId}.desc`)}
              </p>
              {trainingFocusAttrs[focusId].length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {trainingFocusAttrs[focusId].map((attribute) => (
                    <span
                      key={attribute}
                      className="rounded bg-app-card px-1.5 py-0.5 font-heading text-[10px] uppercase tracking-wider text-app-text-muted"
                    >
                      {t(`common.attributes.${attribute}`)}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-app-border/50" />

      {/* Intensity */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-app-text-muted" />
          <span className="font-heading text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
            {t("training.intensity")}
          </span>
        </div>
        <div className="flex gap-3">
          {intensityIds.map((intensityId) => (
            <button
              key={intensityId}
              disabled={isSaving}
              onClick={() => onSetTraining(currentFocus, intensityId)}
              className={cx(
                "flex-1 rounded-lg border p-3 text-left transition-all",
                currentIntensity === intensityId
                  ? "border-app-green/50 bg-app-green/10"
                  : "border-app-border bg-app-bg hover:bg-white/5",
                isSaving && "pointer-events-none opacity-60",
              )}
            >
              <p
                className={`font-heading font-bold text-sm uppercase tracking-wider ${intensityColors[intensityId]}`}
              >
                {t(`training.intensities.${intensityId}.label`)}
              </p>
              <p className="mt-0.5 text-[10px] text-app-text-muted">
                {t(`training.intensities.${intensityId}.desc`)}
              </p>
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-app-text-muted">
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
      </div>
    </div>
  );
}
