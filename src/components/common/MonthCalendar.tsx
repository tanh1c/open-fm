import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getLocale } from "../../lib/dateFormatting";

export interface CalendarEvent {
  /** YYYY-MM-DD */
  date: string;
  /** Dot/marker colour class, e.g. "bg-app-green". */
  tone?: string;
  /** Short label shown inside the day cell (e.g. "2-1" or "vs RIV"). */
  label?: string;
  /** Short competition code shown as a chip (e.g. "LGE", "CUP", "FRN"). */
  competitionCode?: string;
  /** Tailwind classes for the competition chip background/border/text. */
  competitionTone?: string;
  /** Optional richer title for accessibility / tooltip. */
  title?: string;
}

interface MonthCalendarProps {
  /** Currently selected day (YYYY-MM-DD) or null. */
  value: string | null;
  onSelect?: (date: string) => void;
  /** Events keyed by their YYYY-MM-DD date; multiple per day allowed. */
  events?: CalendarEvent[];
  /** In-game "today" (YYYY-MM-DD) highlighted distinctly from selection. */
  today?: string;
  /** Inclusive earliest selectable day (YYYY-MM-DD). Earlier days are disabled. */
  minDate?: string;
  /** Inclusive latest selectable day (YYYY-MM-DD). Later days are disabled. */
  maxDate?: string;
  /** Month to show first (YYYY-MM-DD); defaults to value, then today, then now. */
  initialMonth?: string;
  /** Render a custom cell footer (e.g. multiple event chips). */
  renderDayFooter?: (date: string, events: CalendarEvent[]) => ReactNode;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function toIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseIsoParts(value: string): { year: number; monthIndex: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Day-of-week index (0=Sun..6=Sat) for the 1st of the given month. */
function firstWeekday(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

export default function MonthCalendar({
  value,
  onSelect,
  events = [],
  today,
  minDate,
  maxDate,
  initialMonth,
  renderDayFooter,
}: MonthCalendarProps) {
  const { i18n } = useTranslation();
  const locale = getLocale(i18n.language);

  const seed =
    parseIsoParts(initialMonth ?? value ?? today ?? "") ??
    (() => {
      const now = new Date();
      return { year: now.getFullYear(), monthIndex: now.getMonth(), day: 1 };
    })();

  const [view, setView] = useState<{ year: number; monthIndex: number }>({
    year: seed.year,
    monthIndex: seed.monthIndex,
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.date.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  const weekdayLabels = useMemo(() => {
    // Build short weekday names starting Sunday using a known Sunday date.
    const reference = new Date(2024, 0, 7); // Jan 7 2024 is a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(reference.getTime() + i * DAY_MS);
      return d.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  const monthLabel = useMemo(
    () =>
      new Date(view.year, view.monthIndex, 1).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
    [locale, view.year, view.monthIndex],
  );

  const totalDays = daysInMonth(view.year, view.monthIndex);
  const leadingBlanks = firstWeekday(view.year, view.monthIndex);
  const cells: Array<number | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  function goToMonth(delta: number): void {
    setView((current) => {
      const next = new Date(current.year, current.monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });
  }

  function isDisabled(iso: string): boolean {
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          className="rounded-lg border border-app-border bg-app-card p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-heading text-sm font-bold uppercase tracking-wide text-app-text">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          className="rounded-lg border border-app-border bg-app-card p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="py-1 text-[10px] font-bold uppercase tracking-wider text-app-text-muted"
          >
            {label}
          </div>
        ))}

        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`blank-${index}`} className="aspect-square" />;
          }

          const iso = toIso(view.year, view.monthIndex, day);
          const dayEvents = eventsByDate.get(iso) ?? [];
          const disabled = isDisabled(iso);
          const isSelected = value === iso;
          const isToday = today === iso;

          let cellClass =
            "relative flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg border p-1 text-xs transition-colors";

          if (disabled) {
            cellClass += " cursor-not-allowed border-transparent text-app-text-muted/40";
          } else if (isSelected) {
            cellClass += " border-app-green bg-app-green/20 text-app-text";
          } else if (isToday) {
            cellClass += " border-app-green/60 bg-app-green/10 text-app-text";
          } else {
            cellClass +=
              " border-app-border/50 bg-app-bg text-app-text hover:border-app-green/50 hover:bg-white/5";
          }

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled || !onSelect}
              onClick={() => onSelect?.(iso)}
              className={cellClass}
              title={dayEvents[0]?.title}
              data-testid={`calendar-day-${iso}`}
            >
              <span className={isToday ? "font-bold text-app-green" : "font-semibold"}>
                {day}
              </span>

              {renderDayFooter ? (
                renderDayFooter(iso, dayEvents)
              ) : dayEvents.length > 0 ? (
                <div className="mt-auto flex w-full flex-col items-center gap-0.5">
                  {dayEvents[0].competitionCode ? (
                    <span
                      className={`w-full truncate rounded border px-1 py-px text-center text-[8px] font-bold uppercase leading-tight tracking-wide ${dayEvents[0].competitionTone ?? "border-app-border bg-app-bg text-app-text-muted"}`}
                    >
                      {dayEvents[0].competitionCode}
                    </span>
                  ) : null}
                  {dayEvents[0].label ? (
                    <span className="w-full truncate text-center text-[9px] font-bold leading-tight text-app-text">
                      {dayEvents[0].label}
                    </span>
                  ) : null}
                  {dayEvents.length > 1 ? (
                    <span className="flex items-center gap-0.5">
                      {dayEvents.slice(0, 3).map((event, i) => (
                        <span
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full ${event.tone ?? "bg-app-green"}`}
                        />
                      ))}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
