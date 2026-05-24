import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, ScanSearch } from "lucide-react";

import { calcAge, positionBadgeVariant } from "../../lib/helpers";
import { countryName } from "../../lib/countries";
import { canDelegateToYouthAcademy, isYouthAcademyPlayer } from "../../lib/playerSquad";
import type { GameStateData } from "../../store/gameStore";
import { setPlayerSquadRole } from "../../services/squadService";
import {
  cancelYouthScouting,
  reassignYouthScouting,
  startYouthScouting,
} from "../../services/scoutingService";
import type { DashboardNavigateContext } from "../dashboard/dashboardProfileNavigation";
import ContextMenu from "../ContextMenu";
import { buildPromoteToSeniorSquadMenuItem, buildViewProfileMenuItem } from "../playerActions/playerContextMenuItems";
import { calculateAvailableScouts } from "../scouting/ScoutingTab.helpers";
import ScoutingYouthRecruitmentCard from "../scouting/ScoutingYouthRecruitmentCard";
import { translatePositionAbbreviation } from "../squad/SquadTab.helpers";
import { TraitList } from "../TraitBadge";
import { Badge, Button, CountryFlag, ProgressBar } from "../ui";

interface YouthAcademyTabProps {
  gameState: GameStateData;
  onSelectPlayer?: (id: string) => void;
  onGameUpdate?: (game: GameStateData) => void;
  onNavigate?: (tab: string, context?: DashboardNavigateContext) => void;
}

type YouthAcademyViewTab = "Prospects" | "Development";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function TemplateCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-app-border bg-app-card", className)}>{children}</div>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">{title}</h3>
      {action ? <span className="text-[10px] font-semibold text-app-green">{action}</span> : null}
    </div>
  );
}

function StatRow({ label, value, tone = "text-app-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-app-text-muted">{label}</span>
      <span className={cx("font-bold", tone)}>{value}</span>
    </div>
  );
}

function getPotentialLabel(
  potential: number,
  t: (key: string) => string,
): { label: string; color: string } {
  if (potential >= 85) {
    return { label: t("youthAcademy.potWorldClass"), color: "text-yellow-400" };
  }
  if (potential >= 75) {
    return { label: t("youthAcademy.potExcellent"), color: "text-green-400" };
  }
  if (potential >= 65) {
    return { label: t("youthAcademy.potPromising"), color: "text-app-green" };
  }
  if (potential >= 55) {
    return { label: t("youthAcademy.potDecent"), color: "text-app-text-muted" };
  }
  return { label: t("youthAcademy.potLimited"), color: "text-app-text-muted" };
}

export default function YouthAcademyTab({
  gameState,
  onSelectPlayer,
  onGameUpdate,
  onNavigate,
}: YouthAcademyTabProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<YouthAcademyViewTab>("Prospects");
  const [selectedYouthScoutId, setSelectedYouthScoutId] = useState("");
  const [youthRegion, setYouthRegion] = useState("Domestic");
  const [youthObjective, setYouthObjective] = useState("Balanced");
  const [youthTargetPosition, setYouthTargetPosition] = useState("");
  const [startingYouthSearch, setStartingYouthSearch] = useState(false);
  const [youthSearchError, setYouthSearchError] = useState<string | null>(null);
  const myTeam = gameState.teams.find((team) => team.id === gameState.manager.team_id);
  const scouts = gameState.staff.filter(
    (staffMember) => staffMember.role === "Scout" && staffMember.team_id === gameState.manager.team_id,
  );
  const youthAssignments = gameState.youth_scouting_assignments || [];
  const availableScouts = calculateAvailableScouts(
    scouts,
    [...(gameState.scouting_assignments || []), ...youthAssignments],
  );

  useEffect(() => {
    if (selectedYouthScoutId && availableScouts.some((scout) => scout.id === selectedYouthScoutId)) {
      return;
    }

    setSelectedYouthScoutId(availableScouts[0]?.id ?? "");
  }, [availableScouts, selectedYouthScoutId]);

  const roster = myTeam ? gameState.players.filter((player) => player.team_id === myTeam.id) : [];
  const youthPlayers = roster
    .filter((player) => isYouthAcademyPlayer(player))
    .map((player) => ({
      ...player,
      age: calcAge(player.date_of_birth),
      ovr: player.ovr ?? 0,
      potential: player.potential ?? 1,
    }))
    .sort((a, b) => b.potential - a.potential);
  const eligibleSeniorPlayers = roster
    .filter((player) => canDelegateToYouthAcademy(player))
    .map((player) => ({
      ...player,
      age: calcAge(player.date_of_birth),
    }))
    .sort((left, right) => left.age - right.age || left.full_name.localeCompare(right.full_name));

  const avgOvr = youthPlayers.length > 0
    ? Math.round(youthPlayers.reduce((sum, player) => sum + player.ovr, 0) / youthPlayers.length)
    : 0;
  const avgPotential = youthPlayers.length > 0
    ? Math.round(youthPlayers.reduce((sum, player) => sum + player.potential, 0) / youthPlayers.length)
    : 0;
  const highPotential = youthPlayers.filter((player) => player.potential >= 75).length;
  const youthCoach = gameState.staff.filter(
    (staffMember) => staffMember.team_id === myTeam?.id && staffMember.specialization === "Youth",
  );

  const handleDelegatePlayer = async (playerId: string) => {
    try {
      const updated = await setPlayerSquadRole(playerId, "Youth");
      onGameUpdate?.(updated);
    } catch {
      return;
    }
  };

  const handleStartYouthScouting = async () => {
    if (!selectedYouthScoutId || !onGameUpdate) {
      return;
    }

    setStartingYouthSearch(true);
    setYouthSearchError(null);
    try {
      const updated = await startYouthScouting({
        scoutId: selectedYouthScoutId,
        region: youthRegion,
        objective: youthObjective,
        targetPosition: youthTargetPosition || null,
      });
      onGameUpdate(updated);
      setSelectedYouthScoutId("");
    } catch (err) {
      setYouthSearchError(String(err));
    } finally {
      setStartingYouthSearch(false);
    }
  };

  const handleCancelYouthScouting = async (assignmentId: string) => {
    if (!onGameUpdate) {
      return;
    }

    setYouthSearchError(null);
    try {
      const updated = await cancelYouthScouting(assignmentId);
      onGameUpdate(updated);
    } catch (err) {
      setYouthSearchError(String(err));
    }
  };

  const handleReassignYouthScouting = async (assignmentId: string, scoutId: string) => {
    if (!onGameUpdate) {
      return;
    }

    setYouthSearchError(null);
    try {
      const updated = await reassignYouthScouting(assignmentId, scoutId);
      onGameUpdate(updated);
    } catch (err) {
      setYouthSearchError(String(err));
    }
  };

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">YOUTH ACADEMY</h1>
          <p className="text-sm text-app-text-muted">
            {t("youthAcademy.playersUnder21", { count: youthPlayers.length })} &bull; {t("youthAcademy.avgPotential")} {avgPotential} &bull; {youthAssignments.length} active searches
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HeaderChip label={t("youthAcademy.youthPlayers")} value={String(youthPlayers.length)} />
          <HeaderChip label={t("youthAcademy.avgOvr")} value={String(avgOvr)} />
          <HeaderChip label={t("youthAcademy.avgPotential")} value={String(avgPotential)} tone="text-app-green" />
          <div className="rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg">
            {highPotential} {t("youthAcademy.highPotential")}
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[280px]">
          <div>
            <SectionTitle title="ACADEMY" action={myTeam?.short_name ?? myTeam?.name} />
            <TemplateCard className="flex flex-col gap-3 p-4">
              <StatRow label={t("youthAcademy.youthPlayers")} value={String(youthPlayers.length)} />
              <StatRow label={t("youthAcademy.avgOvr")} value={String(avgOvr)} />
              <StatRow label={t("youthAcademy.avgPotential")} value={String(avgPotential)} tone="text-app-green" />
              <StatRow label={t("youthAcademy.highPotential")} value={String(highPotential)} tone="text-app-green" />
            </TemplateCard>
          </div>

          <div>
            <SectionTitle title="STAFF" action={`${youthCoach.length}`} />
            <TemplateCard className="p-4">
              {youthCoach.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {youthCoach.map((staff) => (
                    <div key={staff.id} className="rounded-lg bg-app-bg px-3 py-2">
                      <p className="text-xs font-bold text-app-text">{staff.first_name} {staff.last_name}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-app-text-muted">
                        {t("youthAcademy.youthCoach")} &bull; {staff.attributes.coaching}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-app-text-muted">{t("youthAcademy.youthCoach")}: 0</p>
              )}
            </TemplateCard>
          </div>

          <div>
            <SectionTitle title="SCOUTING" action={`${availableScouts.length}/${scouts.length}`} />
            <TemplateCard className="flex flex-col gap-3 p-4">
              <StatRow label="Scouts" value={String(scouts.length)} />
              <StatRow label="Available" value={String(availableScouts.length)} tone="text-app-green" />
              <StatRow label="Searches" value={String(youthAssignments.length)} />
            </TemplateCard>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <TemplateCard className="shrink-0 px-4 pt-3">
            <div className="flex items-center gap-6 border-b border-app-border/50">
              {(["Prospects", "Development"] as YouthAcademyViewTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cx(
                    "pb-3 text-[11px] uppercase tracking-wider transition-colors",
                    activeTab === tab
                      ? "border-b-2 border-app-green font-semibold text-app-green"
                      : "font-medium text-app-text-muted hover:text-white",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </TemplateCard>

          {activeTab === "Prospects" ? (
            <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-app-border/50 bg-app-bg px-4 py-3">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
                  {t("youthAcademy.youthProspects")}
                </h3>
                <p className="mt-1 text-sm font-bold text-app-text">{youthPlayers.length} prospects</p>
              </div>
              {onNavigate ? (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<ScanSearch className="h-4 w-4" />}
                  onClick={() => onNavigate("Scouting")}
                  aria-label="Open scouting from prospects"
                >
                  {t("youthAcademy.openScouting")}
                </Button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
              {youthPlayers.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-12">
                  <GraduationCap className="h-10 w-10 text-app-text-muted" />
                  <p className="text-sm text-app-text-muted">{t("youthAcademy.noYouthPlayers")}</p>
                </div>
              ) : (
                <table className="w-full min-w-[860px] border-collapse text-left text-[11px]">
                  <thead className="sticky top-0 z-10 bg-app-card">
                    <tr className="border-b border-app-border/50 text-[9px] font-bold uppercase tracking-wider text-app-text-muted">
                      <th className="px-4 py-3">{t("youthAcademy.player")}</th>
                      <th className="px-4 py-3">{t("youthAcademy.pos")}</th>
                      <th className="px-4 py-3 text-center">{t("youthAcademy.age")}</th>
                      <th className="px-4 py-3 text-center">{t("youthAcademy.ovr")}</th>
                      <th className="px-4 py-3 text-center">{t("youthAcademy.potential")}</th>
                      <th className="px-4 py-3">{t("youthAcademy.growth")}</th>
                      <th className="px-4 py-3">{t("youthAcademy.traits")}</th>
                      <th className="px-4 py-3 text-center">{t("youthAcademy.condition")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/30">
                    {youthPlayers.map((player) => {
                      const potLabel = getPotentialLabel(player.potential, t);
                      const growthRoom = player.potential - player.ovr;
                      const contextItems = [
                        buildViewProfileMenuItem(t, () => onSelectPlayer?.(player.id)),
                        buildPromoteToSeniorSquadMenuItem(t, async () => {
                          try {
                            const updated = await setPlayerSquadRole(player.id, "Senior");
                            onGameUpdate?.(updated);
                          } catch {
                            return;
                          }
                        }),
                      ];

                      return (
                        <ContextMenu items={contextItems} key={player.id}>
                          <tr
                            onClick={() => onSelectPlayer?.(player.id)}
                            className="cursor-pointer transition-colors hover:bg-white/5"
                          >
                            <td className="px-4 py-2.5">
                              <div>
                                <p className="text-sm font-medium text-app-text">{player.full_name}</p>
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-app-text-muted">
                                  <CountryFlag code={player.nationality} locale={i18n.language} className="text-xs leading-none" />
                                  <span>{countryName(player.nationality, i18n.language)}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={positionBadgeVariant(player.natural_position || player.position)} size="sm">
                                {translatePositionAbbreviation(t, player.natural_position || player.position)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="font-heading text-sm font-bold tabular-nums text-app-text-muted">{player.age}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="font-heading text-sm font-bold tabular-nums text-app-text">{player.ovr}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={cx("font-heading text-sm font-bold tabular-nums", potLabel.color)}>{player.potential}</span>
                              <p className={cx("text-[9px] font-heading uppercase tracking-wider", potLabel.color)}>{potLabel.label}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <ProgressBar
                                  value={Math.min(100, (player.ovr / player.potential) * 100)}
                                  variant={growthRoom > 15 ? "accent" : growthRoom > 5 ? "primary" : "auto"}
                                  size="sm"
                                />
                                <span className="w-6 text-[10px] font-heading font-bold tabular-nums text-app-text-muted">+{growthRoom}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <TraitList traits={player.traits || []} max={2} />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={cx(
                                  "text-xs font-heading font-bold tabular-nums",
                                  player.condition >= 70 ? "text-green-500" : player.condition >= 40 ? "text-yellow-500" : "text-red-500",
                                )}
                              >
                                {player.condition}%
                              </span>
                            </td>
                          </tr>
                        </ContextMenu>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </TemplateCard>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <SectionTitle title="RECOVERY" action={`${eligibleSeniorPlayers.length}`} />
            <TemplateCard className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-heading font-bold text-app-text">{t("youthAcademy.recoveryTitle")}</h3>
                  <p className="mt-1 text-sm text-app-text-muted">{t("youthAcademy.recoveryDescription")}</p>
                </div>
                {onNavigate ? (
                  <Button size="sm" variant="outline" icon={<ScanSearch className="h-4 w-4" />} onClick={() => onNavigate("Scouting")}>
                    {t("youthAcademy.openScouting")}
                  </Button>
                ) : null}
              </div>

              {eligibleSeniorPlayers.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3">
                  <Badge variant="primary" size="sm" className="w-fit">
                    {t("youthAcademy.eligibleSeniorPlayers", { count: eligibleSeniorPlayers.length })}
                  </Badge>

                  <div className="grid grid-cols-1 gap-3">
                    {eligibleSeniorPlayers.slice(0, 4).map((player) => (
                      <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-bg px-4 py-3">
                        <div className="min-w-0">
                          <button
                            onClick={() => onSelectPlayer?.(player.id)}
                            className="block truncate text-left text-sm font-heading font-bold text-app-text transition-colors hover:text-app-green"
                          >
                            {player.full_name}
                          </button>
                          <p className="mt-0.5 text-xs text-app-text-muted">
                            {translatePositionAbbreviation(t, player.natural_position || player.position)} · {t("youthAcademy.age")} {player.age}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            void handleDelegatePlayer(player.id);
                          }}
                        >
                          {t("youthAcademy.delegateToYouthAcademy")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-app-text-muted">{t("youthAcademy.noEligibleSeniorPlayers")}</p>
              )}
            </TemplateCard>
          </div>

                {scouts.length > 0 ? (
                  <div>
                    <SectionTitle title="RECRUITMENT" action={`${youthAssignments.length}`} />
              <ScoutingYouthRecruitmentCard
                title={t("youthAcademy.recruitmentWorkflowTitle")}
                hint={t("youthAcademy.recruitmentWorkflowHint")}
                youthAssignments={youthAssignments}
                scouts={scouts}
                availableScouts={availableScouts}
                isStarting={startingYouthSearch}
                selectedScoutId={selectedYouthScoutId}
                region={youthRegion}
                objective={youthObjective}
                targetPosition={youthTargetPosition}
                errorMessage={youthSearchError}
                embedded
                onScoutChange={setSelectedYouthScoutId}
                onRegionChange={setYouthRegion}
                onObjectiveChange={setYouthObjective}
                onTargetPositionChange={setYouthTargetPosition}
                onStartSearch={() => {
                  void handleStartYouthScouting();
                }}
                onCancelSearch={(assignmentId) => {
                  void handleCancelYouthScouting(assignmentId);
                }}
                onReassignSearch={(assignmentId, scoutId) => {
                  void handleReassignYouthScouting(assignmentId, scoutId);
                }}
              />
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HeaderChip({ label, value, tone = "text-app-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
      {label} <span className={cx("font-bold", tone)}>{value}</span>
    </div>
  );
}
