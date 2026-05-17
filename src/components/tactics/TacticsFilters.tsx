import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import {
  CORE_POSITIONS,
  translatePositionAbbreviation,
} from "../squad/SquadTab.helpers";
import { Select } from "../ui";

interface TacticsFiltersProps {
  onClear: () => void;
  onPlayerSearchChange: (value: string) => void;
  onPositionFilterChange: (value: string) => void;
  playerSearch: string;
  positionFilter: string;
}

function getClearButtonClassName(isEnabled: boolean): string {
  if (isEnabled) {
    return "rounded-lg border border-app-border bg-[#151d28] px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-app-text transition-all hover:border-primary-500/40 hover:text-app-green";
  }

  return "cursor-not-allowed rounded-lg border border-app-border bg-[#151d28] px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider text-app-text-muted opacity-50 transition-all";
}

export default function TacticsFilters({
  onClear,
  onPlayerSearchChange,
  onPositionFilterChange,
  playerSearch,
  positionFilter,
}: TacticsFiltersProps): JSX.Element {
  const { t } = useTranslation();
  const canClear = playerSearch.trim().length > 0 || positionFilter !== "All";

  return (
    <div className="rounded-xl border border-app-border bg-app-card p-4">
      <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(0,1.3fr)_220px_auto]">
        <div>
          <label className="mb-2 block text-[10px] font-heading font-bold uppercase tracking-widest text-app-text-muted">
            {t("common.search")}
          </label>
          <input
            type="text"
            value={playerSearch}
            onChange={(event) => onPlayerSearchChange(event.target.value)}
            placeholder={t("squad.filterPlayers")}
            className="w-full rounded-lg border border-app-border bg-[#151d28] px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-heading font-bold uppercase tracking-widest text-app-text-muted">
            {t("squad.pos")}
          </label>
          <Select
            value={positionFilter}
            onChange={(event) => onPositionFilterChange(event.target.value)}
            fullWidth
          >
            <option value="All">{t("common.all")}</option>
            {CORE_POSITIONS.map((position) => (
              <option key={position} value={position}>
                {translatePositionAbbreviation(t, position)}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!canClear}
          className={getClearButtonClassName(canClear)}
        >
          {t("common.clear")}
        </button>
      </div>
    </div>
  );
}
