import { countryName } from "../../lib/countries";
import {
  calcAge,
  formatVal,
  getPlayerOvr,
  positionBadgeVariant,
} from "../../lib/helpers";
import type { PlayerData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { buildViewProfileMenuItem } from "../playerActions/playerContextMenuItems";
import { Badge, Card, CardBody, CardHeader, CountryFlag, ProgressBar } from "../ui";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import type { TeamProfileTranslate } from "./TeamProfile.types";

interface TeamProfileRosterCardProps {
  roster: PlayerData[];
  isOwnTeam: boolean;
  locale: string;
  t: TeamProfileTranslate;
  onSelectPlayer?: (id: string) => void;
}

export default function TeamProfileRosterCard({
  roster,
  isOwnTeam,
  locale,
  t,
  onSelectPlayer,
}: TeamProfileRosterCardProps) {
  return (
    <Card>
      <CardHeader>
        {t("teams.squad")} ({roster.length})
      </CardHeader>
      <CardBody className="p-0">
        <div className="max-h-[460px] overflow-y-auto overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-app-bg border-b border-app-border text-[10px]">
                <th className="py-2.5 px-4 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                  {t("common.position")}
                </th>
                <th className="py-2.5 px-4 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                  {t("common.name")}
                </th>
                <th className="py-2.5 px-4 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                  {t("common.age")}
                </th>
                <th className="py-2.5 px-4 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                  {t("common.nationality")}
                </th>
                <th className="py-2.5 px-4 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                  {t("common.value")}
                </th>
                {isOwnTeam && (
                  <th className="py-2.5 px-4 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                    {t("common.condition")}
                  </th>
                )}
                <th className="py-2.5 px-4 font-heading font-bold uppercase tracking-wider text-app-text-muted">
                  {t("common.ovr")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30">
              {roster.map((player) => {
                const ovr = getPlayerOvr(player);
                const age = calcAge(player.date_of_birth);
                const contextItems = onSelectPlayer
                  ? [buildViewProfileMenuItem(t, () => onSelectPlayer(player.id))]
                  : [];
                const playerRow = (
                  <tr
                    key={player.id}
                    data-testid={`team-profile-roster-${player.id}`}
                    onClick={() => onSelectPlayer?.(player.id)}
                    className={`group transition-colors ${onSelectPlayer
                      ? "hover:bg-white/5 cursor-pointer"
                      : ""
                      }`}
                  >
                    <td className="py-2.5 px-4">
                      <Badge
                        variant={positionBadgeVariant(
                          player.natural_position || player.position,
                        )}
                      >
                        {translatePositionAbbreviation(
                          t,
                          player.natural_position || player.position,
                        )}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-sm text-app-text group-hover:text-app-green transition-colors">
                        {player.full_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-sm text-app-text-muted tabular-nums">
                      {age}
                    </td>
                    <td className="py-2.5 px-4 text-sm text-app-text-muted">
                      <div className="flex items-center gap-1">
                        <CountryFlag
                          code={player.nationality}
                          locale={locale}
                          className="text-lg leading-none"
                        />
                        <span>{countryName(player.nationality, locale)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-sm text-app-text-muted tabular-nums">
                      {formatVal(player.market_value)}
                    </td>
                    {isOwnTeam && (
                      <td className="py-2.5 px-4">
                        <ProgressBar
                          value={player.condition}
                          variant="auto"
                          size="sm"
                          showLabel
                          className="max-w-[100px]"
                        />
                      </td>
                    )}
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-heading font-bold text-lg tabular-nums ${isOwnTeam
                          ? ovr >= 75
                            ? "text-app-green"
                            : ovr >= 55
                              ? "text-accent-500"
                              : "text-app-text-muted"
                          : "text-app-text-muted"
                          }`}
                      >
                        {isOwnTeam ? ovr : "??"}
                      </span>
                    </td>
                  </tr>
                );

                if (contextItems.length > 0) {
                  return (
                    <ContextMenu items={contextItems} key={player.id}>
                      {playerRow}
                    </ContextMenu>
                  );
                }

                return playerRow;
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
