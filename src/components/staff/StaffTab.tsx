import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Briefcase,
  Eye,
  GraduationCap,
  Search,
  Stethoscope,
  UserCog,
  UserMinus,
  UserPlus,
  Star,
} from "lucide-react";

import { calcAge, formatVal, formatWeeklyAmount, getTeamName } from "../../lib/helpers";
import { countryName } from "../../lib/countries";
import type { GameStateData, StaffData } from "../../store/gameStore";
import { hireStaff, releaseStaff } from "../../services/staffService";
import ContextMenu, { type ContextMenuItem } from "../ContextMenu";
import type { DashboardNavigateContext } from "../dashboard/dashboardProfileNavigation";
import { Badge, Card, CardBody, CountryFlag, ProgressBar } from "../ui";

interface StaffTabProps {
  gameState: GameStateData;
  onGameUpdate?: (state: GameStateData) => void;
  onNavigate?: (tab: string, context?: DashboardNavigateContext) => void;
}

const ROLE_ICONS: Record<string, ReactNode> = {
  AssistantManager: <Briefcase className="h-4 w-4" />,
  Coach: <GraduationCap className="h-4 w-4" />,
  Scout: <Eye className="h-4 w-4" />,
  Physio: <Stethoscope className="h-4 w-4" />,
};

const ROLE_COLORS: Record<string, string> = {
  AssistantManager: "text-blue-500",
  Coach: "text-app-green",
  Scout: "text-yellow-400",
  Physio: "text-red-400",
};

const ROLES = ["AssistantManager", "Coach", "Scout", "Physio"];

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

function bestAttr(staff: StaffData): { key: string; value: number } {
  const attrs = [
    { key: "coaching", value: staff.attributes.coaching },
    { key: "judgingAbility", value: staff.attributes.judging_ability },
    { key: "judgingPotential", value: staff.attributes.judging_potential },
    { key: "physiotherapy", value: staff.attributes.physiotherapy },
  ];
  return attrs.reduce((a, b) => (b.value > a.value ? b : a));
}

function ovrRating(staff: StaffData): number {
  return Math.round(
    (staff.attributes.coaching +
      staff.attributes.judging_ability +
      staff.attributes.judging_potential +
      staff.attributes.physiotherapy) /
    4,
  );
}

function getViewButtonClassName(isActive: boolean): string {
  return cx(
    "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-heading font-bold uppercase tracking-wider transition-all",
    isActive
      ? "bg-app-green text-app-bg shadow-sm"
      : "border border-app-border bg-app-card text-app-text-muted hover:bg-white/5 hover:text-app-text",
  );
}

function getFilterButtonClassName(isActive: boolean): string {
  return cx(
    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-wider transition-all",
    isActive
      ? "bg-app-green text-app-bg shadow-sm"
      : "border border-app-border bg-app-card text-app-text-muted hover:bg-white/5 hover:text-app-text",
  );
}

export default function StaffTab({ gameState, onGameUpdate, onNavigate }: StaffTabProps) {
  const { t, i18n } = useTranslation();
  const weeklySuffix = t("finances.perWeekSuffix", "/wk");
  const openScoutingWorkflowLabel = t("staff.openScoutingWorkflow");
  const userTeamId = gameState.manager.team_id;
  const [view, setView] = useState<"mystaff" | "available">("mystaff");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const myStaff = gameState.staff.filter((staff) => staff.team_id === userTeamId);
  const availableStaff = gameState.staff.filter((staff) => !staff.team_id);
  const displayStaff = view === "mystaff" ? myStaff : availableStaff;
  const roleCounts = new Map<string, number>();

  for (const staff of displayStaff) {
    roleCounts.set(staff.role, (roleCounts.get(staff.role) ?? 0) + 1);
  }

  const filtered = displayStaff.filter((staff) => {
    if (roleFilter && staff.role !== roleFilter) {
      return false;
    }
    if (search.length >= 2) {
      const query = search.toLowerCase();
      const fullName = `${staff.first_name} ${staff.last_name}`.toLowerCase();
      if (!fullName.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const scoutCount = myStaff.filter((staff) => staff.role === "Scout").length;
  const activeScoutingAssignments =
    (gameState.scouting_assignments || []).length +
    (gameState.youth_scouting_assignments || []).length;
  const activeViewLabel = view === "mystaff" ? t("staff.myStaff", { count: myStaff.length }) : t("staff.available", { count: availableStaff.length });
  const activeFilterLabel = roleFilter ? t(`staff.roles.${roleFilter}`) : t("common.all");

  const handleHire = async (staffId: string) => {
    setActionLoading(staffId);
    try {
      const updated = await hireStaff(staffId);
      onGameUpdate?.(updated);
    } catch (err) {
      console.error("Failed to hire staff:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRelease = async (staffId: string) => {
    setActionLoading(staffId);
    try {
      const updated = await releaseStaff(staffId);
      onGameUpdate?.(updated);
    } catch (err) {
      console.error("Failed to release staff:", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-max max-w-[1700px] flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-app-text">STAFF</h1>
          <p className="text-sm text-app-text-muted">
            {activeViewLabel} &bull; {activeFilterLabel} &bull; {filtered.length} shown
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            My Staff <span className="font-bold text-app-text">{myStaff.length}</span>
          </div>
          <div className="rounded-lg border border-app-border bg-app-card px-3 py-2 text-sm font-medium text-app-text-muted">
            Available <span className="font-bold text-app-green">{availableStaff.length}</span>
          </div>
          <div className="rounded-lg bg-app-green px-4 py-2 text-sm font-bold text-app-bg">
            {filtered.length} shown
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-[800px] flex-col gap-4 xl:h-[750px] xl:flex-row">
        <aside className="hidden h-full w-full shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar lg:flex xl:w-[280px]">
          <div>
            <SectionTitle title="DEPARTMENT" action={view === "mystaff" ? "CLUB" : "MARKET"} />
            <TemplateCard className="flex flex-col gap-3 p-4">
              <StatRow label="My Staff" value={String(myStaff.length)} />
              <StatRow label="Available" value={String(availableStaff.length)} tone="text-app-green" />
              <StatRow label="Scouts" value={String(scoutCount)} />
              <StatRow label="Assignments" value={String(activeScoutingAssignments)} tone="text-app-green" />
            </TemplateCard>
          </div>

          <div>
            <SectionTitle title="ROLES" action={activeFilterLabel} />
            <TemplateCard className="overflow-hidden">
              <button
                type="button"
                onClick={() => setRoleFilter(null)}
                className={cx(
                  "flex w-full items-center justify-between px-4 py-3 text-xs font-semibold transition-colors hover:bg-white/5",
                  !roleFilter ? "bg-app-green/10 text-app-green" : "text-app-text-muted",
                )}
              >
                <span>{t("common.all")}</span>
                <span>{displayStaff.length}</span>
              </button>
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  aria-label={`Filter role ${roleCounts.get(role) ?? 0}`}
                  onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                  className={cx(
                    "flex w-full items-center justify-between border-t border-app-border/30 px-4 py-3 text-xs font-semibold transition-colors hover:bg-white/5",
                    roleFilter === role ? "bg-app-green/10 text-app-green" : "text-app-text-muted",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <span className={ROLE_COLORS[role] || "text-app-text-muted"}>{ROLE_ICONS[role]}</span>
                    <span className="truncate">{t(`staff.roles.${role}`)}</span>
                  </span>
                  <span>{roleCounts.get(role) ?? 0}</span>
                </button>
              ))}
            </TemplateCard>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-card p-3">
            <button onClick={() => setView("mystaff")} className={getViewButtonClassName(view === "mystaff")}>
              <UserCog className="h-4 w-4" /> {t("staff.myStaff", { count: myStaff.length })}
            </button>
            <button onClick={() => setView("available")} className={getViewButtonClassName(view === "available")}>
              <UserPlus className="h-4 w-4" /> {t("staff.available", { count: availableStaff.length })}
            </button>

            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
              <input
                type="text"
                placeholder={t("staff.searchStaff")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-app-border bg-app-bg py-2 pl-9 pr-3 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-app-green/30"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setRoleFilter(null)} className={getFilterButtonClassName(!roleFilter)}>
                {t("common.all")}
              </button>
              {ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                  className={getFilterButtonClassName(roleFilter === role)}
                >
                  {ROLE_ICONS[role]} {t(`staff.roles.${role}`)}
                </button>
              ))}
            </div>
          </div>

          <TemplateCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-app-border/50 bg-app-bg px-4 py-3">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">ROSTER</h3>
                <p className="mt-1 text-sm font-bold text-app-text">{activeViewLabel}</p>
              </div>
              <span className="rounded bg-app-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-bg">
                {filtered.length} Staff
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <UserCog className="h-12 w-12 text-app-text-muted" />
                  <p className="text-sm text-app-text-muted">
                    {view === "mystaff" ? t("staff.noStaffMatch") : t("staff.noAvailableStaff")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {filtered.map((staff) => (
                    <StaffCard
                      key={staff.id}
                      staff={staff}
                      view={view}
                      gameState={gameState}
                      language={i18n.language}
                      weeklySuffix={weeklySuffix}
                      actionLoading={actionLoading}
                      openScoutingWorkflowLabel={openScoutingWorkflowLabel}
                      onHire={handleHire}
                      onRelease={handleRelease}
                      onNavigate={onNavigate}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>
          </TemplateCard>
        </section>
      </div>
    </div>
  );
}

function StaffCard({
  staff,
  view,
  gameState,
  language,
  weeklySuffix,
  actionLoading,
  openScoutingWorkflowLabel,
  onHire,
  onRelease,
  onNavigate,
  t,
}: {
  staff: StaffData;
  view: "mystaff" | "available";
  gameState: GameStateData;
  language: string;
  weeklySuffix: string;
  actionLoading: string | null;
  openScoutingWorkflowLabel: string;
  onHire: (staffId: string) => Promise<void>;
  onRelease: (staffId: string) => Promise<void>;
  onNavigate?: (tab: string, context?: DashboardNavigateContext) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const roleIcon = ROLE_ICONS[staff.role] || ROLE_ICONS.Coach;
  const roleColor = ROLE_COLORS[staff.role] || ROLE_COLORS.Coach;
  const age = calcAge(staff.date_of_birth);
  const ovr = ovrRating(staff);
  const best = bestAttr(staff);
  const isLoading = actionLoading === staff.id;
  const scoutingLoad =
    gameState.scouting_assignments.filter((assignment) => assignment.scout_id === staff.id).length +
    (gameState.youth_scouting_assignments || []).filter((assignment) => assignment.scout_id === staff.id).length;
  const youthLoad = (gameState.youth_scouting_assignments || []).filter((assignment) => assignment.scout_id === staff.id).length;
  const scoutingLoadLabel = `${scoutingLoad} ${t(scoutingLoad === 1 ? "staff.activeAssignment" : "staff.activeAssignments")}`;
  const youthLoadLabel = `${youthLoad} ${t(youthLoad === 1 ? "staff.youthSearch" : "staff.youthSearches")}`;
  const contextItems: ContextMenuItem[] =
    view === "mystaff"
      ? [
        ...(staff.role === "Scout" && onNavigate
          ? [{
            label: openScoutingWorkflowLabel,
            icon: <Eye className="h-4 w-4" />,
            onClick: () => onNavigate("Scouting"),
            disabled: false,
          } satisfies ContextMenuItem]
          : []),
        {
          label: t("staff.releaseStaff"),
          icon: <UserMinus className="h-4 w-4" />,
          onClick: () => onRelease(staff.id),
          danger: true,
          disabled: isLoading,
        },
      ]
      : [
        {
          label: t("staff.hireStaff"),
          icon: <UserPlus className="h-4 w-4" />,
          onClick: () => onHire(staff.id),
          disabled: isLoading,
        },
      ];

  const staffCard = (
    <div data-testid={`staff-card-${staff.id}`} className="h-full">
      <Card className="h-full border-app-border bg-app-bg">
        <CardBody>
          <div className="flex items-start gap-4">
            <div className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-app-green/10", roleColor)}>
              {roleIcon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-heading text-sm font-bold uppercase tracking-wide text-app-text">
                  {staff.first_name} {staff.last_name}
                </h3>
                <Badge variant={ovr >= 65 ? "success" : ovr >= 45 ? "primary" : "neutral"} size="sm">
                  {ovr} OVR
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-app-text-muted">
                {t(`staff.roles.${staff.role}`)} — {t("common.age")} {age}
                <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
                  <CountryFlag code={staff.nationality} locale={language} className="text-xs leading-none" />
                  <span>{countryName(staff.nationality, language)}</span>
                </span>
                {staff.team_id && view === "available" ? (
                  <span className="ml-1.5">@ {getTeamName(gameState.teams, staff.team_id)}</span>
                ) : null}
              </p>

              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {staff.specialization ? (
                  <span className="inline-flex items-center gap-1 rounded bg-app-green/10 px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider text-app-green">
                    <Star className="h-3 w-3" /> {t(`staff.specializations.${staff.specialization}`)}
                  </span>
                ) : null}
                {staff.wage > 0 ? (
                  <span className="rounded bg-app-card px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider text-app-text-muted">
                    {formatWeeklyAmount(formatVal(staff.wage), weeklySuffix)}
                  </span>
                ) : null}
                {staff.role === "Scout" ? (
                  <span className="rounded bg-app-green/10 px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider text-app-green">
                    {scoutingLoadLabel}
                  </span>
                ) : null}
                {staff.role === "Scout" && youthLoad > 0 ? (
                  <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider text-yellow-400">
                    {youthLoadLabel}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                <AttrBar label={t("staff.attrs.coaching")} value={staff.attributes.coaching} />
                <AttrBar label={t("staff.attrs.judgingAbility")} value={staff.attributes.judging_ability} />
                <AttrBar label={t("staff.attrs.judgingPotential")} value={staff.attributes.judging_potential} />
                <AttrBar label={t("staff.attrs.physiotherapy")} value={staff.attributes.physiotherapy} />
              </div>

              <p className="mt-2 text-xs text-app-text-muted">
                {t("staff.best")}: <span className="font-medium text-app-text">{t(`staff.attrs.${best.key}`)} ({best.value})</span>
              </p>

              {staff.role === "Scout" && onNavigate ? (
                <button
                  type="button"
                  className="mt-3 text-xs font-heading font-bold uppercase tracking-wider text-app-green hover:text-app-green/80"
                  onClick={() => onNavigate("Scouting")}
                >
                  {openScoutingWorkflowLabel}
                </button>
              ) : null}
            </div>

            {view === "mystaff" ? (
              <button
                disabled={isLoading}
                onClick={() => onRelease(staff.id)}
                className={cx(
                  "rounded-lg bg-red-500/10 p-2 text-red-400 transition-colors hover:bg-red-500/20",
                  isLoading && "pointer-events-none opacity-50",
                )}
                title={t("staff.releaseStaff")}
              >
                <UserMinus className="h-4 w-4" />
              </button>
            ) : (
              <button
                disabled={isLoading}
                onClick={() => onHire(staff.id)}
                className={cx(
                  "rounded-lg bg-app-green/10 p-2 text-app-green transition-colors hover:bg-app-green/20",
                  isLoading && "pointer-events-none opacity-50",
                )}
                title={t("staff.hireStaff")}
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return <ContextMenu items={contextItems}>{staffCard}</ContextMenu>;
}

function AttrBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs">
        <span className="text-app-text-muted">{label}</span>
        <span className={cx("font-heading font-bold tabular-nums", value >= 70 ? "text-app-green" : value >= 50 ? "text-yellow-400" : "text-app-text-muted")}>
          {value}
        </span>
      </div>
      <ProgressBar value={value} variant={value >= 70 ? "success" : value >= 50 ? "primary" : "accent"} size="sm" />
    </div>
  );
}
