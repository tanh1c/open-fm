import type { TFunction } from "i18next";

import type { FixtureCompetitionData } from "../store/types";

export interface CompetitionTag {
  /** Short uppercase code shown on compact chips (e.g. calendar cells). */
  code: string;
  /** Full translated label for legends / tooltips. */
  label: string;
  /** Background tone class for the chip. */
  tone: string;
  /** Dot tone class (used for calendar markers). */
  dotTone: string;
}

// Maps each competition kind to a short code, full label and a distinct colour
// so league / cup / continental / friendly matches read at a glance. Codes are
// abbreviations (not translated, like position codes); labels go through i18n.
export function getCompetitionTag(
  t: TFunction,
  competition: FixtureCompetitionData,
): CompetitionTag {
  switch (competition) {
    case "DomesticCup":
      return {
        code: "CUP",
        label: t("schedule.competition.domesticCup", { defaultValue: "Domestic Cup" }),
        tone: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        dotTone: "bg-amber-400",
      };
    case "ContinentalLeague":
      return {
        code: "CL",
        label: t("schedule.competition.continental", { defaultValue: "Continental" }),
        tone: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        dotTone: "bg-indigo-400",
      };
    case "Friendly":
      return {
        code: "FRN",
        label: t("season.friendly", { defaultValue: "Friendly" }),
        tone: "bg-app-text-muted/20 text-app-text-muted border-app-border",
        dotTone: "bg-app-text-muted",
      };
    case "PreseasonTournament":
      return {
        code: "PRE",
        label: t("season.preseasonTournament", { defaultValue: "Preseason Tournament" }),
        tone: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        dotTone: "bg-purple-400",
      };
    case "League":
    case "DomesticLeague":
    default:
      return {
        code: "LGE",
        label: t("schedule.competition.league", { defaultValue: "League" }),
        tone: "bg-app-green/20 text-app-green border-app-green/30",
        dotTone: "bg-app-green",
      };
  }
}
