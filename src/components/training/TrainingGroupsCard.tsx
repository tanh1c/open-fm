import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Users } from "lucide-react";

import type { GameStateData } from "../../store/gameStore";
import {
  setPlayerTrainingFocus,
  setTrainingGroups,
  type TrainingGroupData,
} from "../../services/trainingService";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { Select } from "../ui";
import {
  buildPlayerGroupMap,
  reassignPlayerTrainingGroup,
  sortTrainingRoster,
} from "./trainingGroupsModel";

type TrainingGroup = TrainingGroupData;

interface TrainingGroupsCardProps {
  gameState: GameStateData;
  onGameUpdate?: (state: GameStateData) => void;
  roster: GameStateData["players"];
  isSaving: boolean;
  setIsSaving: (value: boolean) => void;
  trainingFocusIds: readonly string[];
  trainingFocusIcons: Record<string, React.ReactNode>;
}

export default function TrainingGroupsCard({
  gameState,
  onGameUpdate,
  roster,
  isSaving,
  setIsSaving,
  trainingFocusIds,
  trainingFocusIcons,
}: TrainingGroupsCardProps) {
  const { t } = useTranslation();
  const myTeam = gameState.teams.find(
    (team) => team.id === gameState.manager.team_id,
  );
  const groups: TrainingGroup[] = (myTeam as any)?.training_groups ?? [];
  const teamFocus = myTeam?.training_focus || "Physical";

  const saveGroups = useCallback(
    async (nextGroups: TrainingGroup[]) => {
      setIsSaving(true);
      try {
        const updated = await setTrainingGroups(nextGroups);
        onGameUpdate?.(updated);
      } catch (error) {
        console.error("Failed to save training groups:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [onGameUpdate, setIsSaving],
  );

  const addGroup = () => {
    if (groups.length >= 5) {
      return;
    }

    const index = groups.length;
    const defaultName = t(`training.groups.defaultGroupNames.${index}`);

    saveGroups([
      ...groups,
      {
        id: `grp_${Date.now()}`,
        name: defaultName,
        focus: "Physical",
        player_ids: [],
      },
    ]);
  };

  const removeGroup = (groupId: string) => {
    saveGroups(groups.filter((group) => group.id !== groupId));
  };

  const updateGroupFocus = (groupId: string, focus: string) => {
    saveGroups(
      groups.map((group) =>
        group.id === groupId ? { ...group, focus } : group,
      ),
    );
  };

  const updateGroupName = (groupId: string, name: string) => {
    saveGroups(
      groups.map((group) =>
        group.id === groupId ? { ...group, name } : group,
      ),
    );
  };

  const setPlayerFocus = async (playerId: string, focus: string) => {
    setIsSaving(true);
    try {
      const updated = await setPlayerTrainingFocus(playerId, focus || null);
      onGameUpdate?.(updated);
    } catch (error) {
      console.error("Failed to set player training focus:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const setPlayerGroup = (playerId: string, groupId: string) => {
    saveGroups(reassignPlayerTrainingGroup(groups, playerId, groupId));
  };

  const playerGroupMap = buildPlayerGroupMap(groups);
  const sortedRoster = sortTrainingRoster(roster);

  return (
    <div className="rounded-xl border border-app-border bg-app-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{t("training.groups.trainingGroups")}</h2>
        {groups.length < 5 ? (
          <button
            onClick={addGroup}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded border border-app-border px-3 py-1.5 text-xs font-bold text-app-green transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {t("training.groups.addGroup")}
          </button>
        ) : null}
      </div>
        {groups.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {groups.map((group) => {
              const count = group.player_ids.length;

              return (
                <div
                  key={group.id}
                  className="flex items-center gap-2 rounded-lg border border-app-border bg-app-bg px-3 py-1.5"
                >
                  <div className="text-app-text-muted">
                    {trainingFocusIcons[group.focus] ? (
                      <span className="[&>svg]:w-4 [&>svg]:h-4">
                        {trainingFocusIcons[group.focus]}
                      </span>
                    ) : (
                      <Users className="w-4 h-4" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(event) =>
                      updateGroupName(group.id, event.target.value)
                    }
                    className="w-20 border-none bg-transparent font-heading text-xs font-bold uppercase tracking-wider text-app-text outline-none"
                  />
                  <Select
                    value={group.focus}
                    onChange={(event) =>
                      updateGroupFocus(group.id, event.target.value)
                    }
                    disabled={isSaving}
                    variant="muted"
                    selectSize="xs"
                    className="w-28"
                  >
                    {trainingFocusIds.map((focusId) => (
                      <option key={focusId} value={focusId}>
                        {t(`training.focuses.${focusId}.label`)}
                      </option>
                    ))}
                  </Select>
                  <span className="text-[10px] tabular-nums text-app-text-muted">
                    {count}
                  </span>
                  <button
                    onClick={() => removeGroup(group.id)}
                    disabled={isSaving}
                    className="text-red-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title={t("training.groups.removeGroup")}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {groups.length === 0 ? (
          <p className="mb-3 text-sm text-app-text-muted">
            {t("training.groups.noGroups")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-app-border custom-scrollbar">
            <table className="w-full min-w-[620px] text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-app-bg">
                <tr className="text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                  <th className="px-3 py-2.5">
                    {t("common.player")}
                  </th>
                  <th className="px-3 py-2.5">
                    {t("common.position")}
                  </th>
                  <th className="px-3 py-2.5">
                    {t("training.groups.group")}
                  </th>
                  <th className="px-3 py-2.5">
                    {t("training.effectiveFocus")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/30 text-app-text">
                {sortedRoster.map((player) => {
                  const playerGroup = playerGroupMap.get(player.id);
                  const hasIndividualFocus = !!player.training_focus;
                  const effectiveFocus =
                    player.training_focus || (playerGroup ? playerGroup.focus : teamFocus);

                  return (
                    <tr
                      key={player.id}
                      className="transition-colors hover:bg-white/5"
                    >
                      <td className="max-w-[160px] truncate px-3 py-2 text-xs font-semibold text-app-text">
                        {player.match_name}
                      </td>
                      <td className="px-3 py-2 text-xs text-app-text-muted">
                        {translatePositionAbbreviation(
                          t,
                          player.natural_position || player.position,
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={playerGroup?.id || ""}
                          onChange={(event) =>
                            setPlayerGroup(player.id, event.target.value)
                          }
                          disabled={isSaving}
                          variant="muted"
                          selectSize="xs"
                          fullWidth
                          wrapperClassName="w-full max-w-[120px]"
                        >
                          <option value="">
                            {t("training.groups.teamDefault")}
                          </option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={player.training_focus || ""}
                          onChange={(event) =>
                            setPlayerFocus(player.id, event.target.value)
                          }
                          disabled={isSaving}
                          variant={
                            hasIndividualFocus ? "highlighted" : "placeholder"
                          }
                          selectSize="xs"
                          fullWidth
                          wrapperClassName="w-full max-w-[110px]"
                        >
                          <option value="">
                            {t(`training.focuses.${effectiveFocus}.label`)} ↩
                          </option>
                          {trainingFocusIds.map((focusId) => (
                            <option key={focusId} value={focusId}>
                              {t(`training.focuses.${focusId}.label`)}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-app-text-muted">
          {t("training.groups.trainingGroupsDesc")}
        </p>
    </div>
  );
}