import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MatchModeType } from "../hooks/useAdvanceTime";
import { useGameStore } from "../store/gameStore";
import type { GameStateData, PlayerSelectionOptions } from "../store/gameStore";
import DashboardOverlays from "../components/dashboard/DashboardOverlays";
import FiredModal from "../components/dashboard/FiredModal";
import DashboardWorkspaceContent from "../components/dashboard/DashboardWorkspaceContent";
import { TemplateHeader, type TemplateHeaderMatchModeMeta } from "../components/templateDashboard/TemplateHeader";
import { TemplateSidebar, type TemplateSidebarItem } from "../components/templateDashboard/TemplateSidebar";
import {
  Briefcase,
  Mail as MailIcon,
  Newspaper,
  Calendar as CalendarIcon,
  Users,
  Crosshair,
  Dumbbell,
  UserCog,
  GraduationCap,
  DollarSign,
  ArrowRightLeft,
  UsersRound,
  Building2,
  Trophy,
  Settings,
} from "lucide-react";
import {
  createDashboardProfileNavigationState,
  goBackDashboardProfile,
  hasDashboardProfileHistory,
  navigateDashboardProfiles,
  openDashboardSearchPlayer,
  openDashboardSearchTeam,
  selectDashboardPlayer,
  selectDashboardTeam,
  type DashboardNavigateContext,
} from "../components/dashboard/dashboardProfileNavigation";
import { createDashboardTabContentModel } from "../components/dashboard/dashboardTabContentModel";
import {
  isOnboardingPageTab,
  loadVisitedOnboardingTabs,
  saveVisitedOnboardingTabs,
} from "../components/home/HomeTab.helpers";
import {
  getDashboardAlerts,
  getDashboardSearchResults,
  getManagerTeamName,
  getTodayMatchFixture,
  getUnreadMessagesCount,
} from "../components/dashboard/dashboardHelpers";
import { useAdvanceTime } from "../hooks/useAdvanceTime";
import { Cpu, Eye, Gamepad2, Eye as EyeIcon } from "lucide-react";
import {
  formatDateFull,
  isSeasonComplete as isLeagueSeasonComplete,
} from "../lib/helpers";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../store/settingsStore";

const CLUB_TABS = new Set(["Squad", "Tactics", "Training", "Staff", "Scouting", "Youth", "Finances", "Transfers"]);

const DASHBOARD_TAB_PATHS: Record<string, string> = {
  Home: "/dashboard",
  Inbox: "/inbox",
  News: "/news",
  Schedule: "/schedule",
  Squad: "/squad",
  Tactics: "/tactics",
  Training: "/training",
  Staff: "/staff",
  Scouting: "/scouting",
  Youth: "/youth",
  Finances: "/finances",
  Transfers: "/transfers",
  Players: "/players",
  Teams: "/teams",
  Tournaments: "/tournaments",
  Settings: "/settings",
};

const DASHBOARD_PATH_TABS = Object.fromEntries(
  Object.entries(DASHBOARD_TAB_PATHS).map(([tab, path]) => [path, tab]),
) as Record<string, string>;

export function getDashboardPathForTab(tab: string): string | null {
  return DASHBOARD_TAB_PATHS[tab] ?? null;
}

export function getDashboardTabFromPath(pathname: string): string {
  return DASHBOARD_PATH_TABS[pathname] ?? "Home";
}

const TAB_TRANSLATION_KEYS: Record<string, string> = {
  Home: "dashboard.home",
  Inbox: "dashboard.inbox",
  Manager: "dashboard.manager",
  Squad: "dashboard.squad",
  Tactics: "dashboard.tactics",
  Training: "dashboard.training",
  Staff: "dashboard.staff",
  Finances: "dashboard.finances",
  Transfers: "dashboard.transfers",
  Players: "dashboard.players",
  Teams: "dashboard.teams",
  Tournaments: "dashboard.tournaments",
  Schedule: "dashboard.schedule",
  News: "dashboard.news",
  Scouting: "dashboard.scouting",
  Youth: "dashboard.youthAcademy",
};

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const routeTab = getDashboardTabFromPath(location.pathname);
  const {
    hasActiveGame,
    managerName,
    gameState,
    setGameState,
    clearGame,
    isDirty,
    markClean,
  } = useGameStore();
  const { t } = useTranslation();
  const { settings, loaded: settingsLoaded, loadSettings } = useSettingsStore();

  // Load settings on mount
  useEffect(() => {
    if (!settingsLoaded) loadSettings();
  }, [settingsLoaded, loadSettings]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [profileNavigation, setProfileNavigation] = useState(() =>
    createDashboardProfileNavigationState(routeTab),
  );
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExitingToMenu, setIsExitingToMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [visitedOnboardingTabs, setVisitedOnboardingTabs] = useState<
    Set<string>
  >(new Set<string>());

  // Fetch initial state
  useEffect(() => {
    if (!hasActiveGame) {
      navigate("/");
      return;
    }

    const fetchState = async () => {
      try {
        const state = await invoke<GameStateData>("get_active_game");
        setGameState(state);
      } catch (err) {
        console.error("Failed to fetch game state:", err);
      }
    };

    fetchState();
  }, [hasActiveGame, navigate, setGameState]);

  const isUnemployed = gameState?.manager.team_id === null;
  const todayMatchFixture = gameState ? getTodayMatchFixture(gameState) : null;

  useEffect(() => {
    setProfileNavigation((currentState) => {
      if (
        currentState.activeTab === routeTab &&
        !currentState.selectedPlayerId &&
        !currentState.selectedTeamId &&
        currentState.navHistory.length === 0
      ) {
        return currentState;
      }

      return navigateDashboardProfiles(currentState, routeTab);
    });
  }, [routeTab]);
  const hasMatchToday = todayMatchFixture !== null;

  useEffect(() => {
    if (!gameState) {
      return;
    }

    console.info("[Dashboard] matchDayStatus", {
      currentDate: gameState.clock.current_date,
      fixtureDate: todayMatchFixture?.date ?? null,
      fixtureId: todayMatchFixture?.id ?? null,
      fixtureStatus: todayMatchFixture?.status ?? null,
      hasMatchToday,
      managerTeamId: gameState.manager.team_id,
      matchMode: settings.default_match_mode,
    });
  }, [
    gameState,
    hasMatchToday,
    settings.default_match_mode,
    todayMatchFixture,
  ]);

  useEffect(() => {
    if (!gameState) {
      setVisitedOnboardingTabs(new Set<string>());
      return;
    }

    setVisitedOnboardingTabs(loadVisitedOnboardingTabs(gameState));
  }, [gameState]);

  useEffect(() => {
    if (!isOnboardingPageTab(profileNavigation.activeTab)) {
      return;
    }

    if (!gameState) {
      return;
    }

    setVisitedOnboardingTabs((currentTabs) => {
      if (currentTabs.has(profileNavigation.activeTab)) {
        return currentTabs;
      }

      const nextTabs = new Set(currentTabs);
      nextTabs.add(profileNavigation.activeTab);
      saveVisitedOnboardingTabs(gameState, nextTabs);
      return nextTabs;
    });
  }, [gameState, profileNavigation.activeTab]);

  // Reset to Home tab if current tab is a club tab and manager is unemployed
  useEffect(() => {
    if (isUnemployed && profileNavigation.activeTab && CLUB_TABS.has(profileNavigation.activeTab)) {
      navigate("/dashboard");
      setProfileNavigation((s) => navigateDashboardProfiles(s, "Home"));
    }
  }, [isUnemployed, navigate, profileNavigation.activeTab]);

  const seasonComplete = isLeagueSeasonComplete(gameState?.league);

  // Advance-time hook
  const {
    isAdvancing,
    showContinueMenu,
    setShowContinueMenu,
    showMatchConfirm,
    setShowMatchConfirm,
    matchMode,
    setMatchMode,
    blockerModal,
    setBlockerModal,
    showVacationPicker,
    openVacationPicker,
    closeVacationPicker,
    handleVacation,
    handleContinue,
    handleConfirmMatch,
    handleSkipToMatchDay,
  } = useAdvanceTime(
    setGameState,
    hasMatchToday,
    settings.default_match_mode,
    settingsLoaded,
    isUnemployed ?? false,
    settings.auto_save_mode,
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await invoke("save_game");
      markClean();
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 2000);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }, [markClean]);

  // Intercept window close to warn about unsaved changes
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const isClosingRef = useRef(false);
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      if (isClosingRef.current) return;
      if (isDirty) {
        event.preventDefault();
        setShowCloseConfirm(true);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isDirty]);

  const handleCloseQuit = async (save: boolean) => {
    isClosingRef.current = true;
    setShowCloseConfirm(false);
    if (save) {
      try {
        await invoke("save_game");
        markClean();
      } catch (err) {
        console.error("Auto-save on close failed:", err);
      }
    }
    await getCurrentWindow().destroy();
  };

  const MODE_META: Record<MatchModeType, TemplateHeaderMatchModeMeta> = {
    live: {
      label: t("continueMenu.goToField"),
      icon: <Gamepad2 className="w-4 h-4" />,
      desc: t("continueMenu.goToFieldDesc"),
      buttonColorClass: "from-primary-500 to-primary-600",
      dropdownColorClass: "from-primary-600 to-primary-700",
    },
    spectator: {
      label: t("continueMenu.watchSpectator"),
      icon: <Eye className="w-4 h-4" />,
      desc: t("continueMenu.watchSpectatorDesc"),
      buttonColorClass: "from-indigo-500 to-indigo-600",
      dropdownColorClass: "from-indigo-600 to-indigo-700",
    },
    delegate: {
      label: t("continueMenu.delegateAssistant"),
      icon: <Cpu className="w-4 h-4" />,
      desc: t("continueMenu.delegateAssistantDesc"),
      buttonColorClass: "from-amber-500 to-amber-600",
      dropdownColorClass: "from-amber-600 to-amber-700",
    },
  };

  const currentModeMeta = MODE_META[matchMode];

  function handleNavClick(tab: string): void {
    const path = getDashboardPathForTab(tab);
    if (path) {
      navigate(path);
    }

    setProfileNavigation((currentState) =>
      navigateDashboardProfiles(currentState, tab),
    );
  }

  function handleNavigate(tab: string, context?: DashboardNavigateContext): void {
    if (tab !== "__selectPlayer" && tab !== "__selectTeam") {
      const path = getDashboardPathForTab(tab);
      if (path) {
        navigate(path);
      }
    }

    setProfileNavigation((currentState) =>
      navigateDashboardProfiles(currentState, tab, context),
    );
  }

  function handleBack(): void {
    setProfileNavigation((currentState) =>
      goBackDashboardProfile(currentState),
    );
  }

  const handleExitToMenu = async () => {
    if (isExitingToMenu) {
      return;
    }

    setIsExitingToMenu(true);
    try {
      await invoke("exit_to_menu");
      clearGame();
      navigate("/");
    } catch (err) {
      console.error("Failed to exit:", err);
      clearGame();
      navigate("/");
    }
  };

  function selectPlayer(id: string, options?: PlayerSelectionOptions): void {
    setProfileNavigation((currentState) =>
      selectDashboardPlayer(currentState, id, options),
    );
  }

  function selectTeam(id: string): void {
    setProfileNavigation((currentState) =>
      selectDashboardTeam(currentState, id),
    );
  }

  function handleSearchFocus(): void {
    setSearchOpen(true);
  }

  function handleSearchBlur(): void {
    setTimeout(() => setSearchOpen(false), 200);
  }

  function handleSearchQueryChange(query: string): void {
    setSearchQuery(query);
  }

  function handleSelectSearchPlayer(playerId: string): void {
    setProfileNavigation((currentState) =>
      openDashboardSearchPlayer(currentState, playerId),
    );
    setSearchQuery("");
  }

  function handleSelectSearchTeam(teamId: string): void {
    setProfileNavigation((currentState) =>
      openDashboardSearchTeam(currentState, teamId),
    );
    setSearchQuery("");
  }

  function handleToggleContinueMenu(): void {
    setShowContinueMenu((currentValue) => !currentValue);
  }

  function handleSelectMatchMode(mode: MatchModeType): void {
    setMatchMode(mode);
    setShowContinueMenu(false);
  }

  function handleNavigateSettings(): void {
    navigate("/settings", { state: { from: "/dashboard" } });
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-surface-900 flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 dark:text-gray-400 font-heading uppercase tracking-wider text-sm">
            {t("dashboard.loading")}
          </span>
        </div>
      </div>
    );
  }

  const currentDate = formatDateFull(
    gameState.clock.current_date,
    settings.language,
  );
  const unreadMessagesCount = getUnreadMessagesCount(gameState);
  const myTeamName = getManagerTeamName(gameState);
  const searchResults = getDashboardSearchResults(gameState, searchQuery);
  const dashboardAlerts = getDashboardAlerts(gameState, hasMatchToday, t);
  const hasProfileHistory = hasDashboardProfileHistory(profileNavigation);
  const activeTabLabel = TAB_TRANSLATION_KEYS[profileNavigation.activeTab]
    ? t(TAB_TRANSLATION_KEYS[profileNavigation.activeTab])
    : profileNavigation.activeTab;
  const dashboardTabContentModel = createDashboardTabContentModel({
    activeTab: profileNavigation.activeTab,
    gameState,
    seasonComplete,
    visitedOnboardingTabs,
    initialMessageId: profileNavigation.initialMessageId,
    handlers: {
      onSelectPlayer: selectPlayer,
      onSelectTeam: selectTeam,
      onGameUpdate: setGameState,
      onNavigate: handleNavigate,
    },
  });

  return (
    <div
      data-testid="dashboard-shell"
      className="flex h-screen w-full overflow-hidden text-app-text selection:bg-app-green selection:text-app-bg bg-app-bg"
    >
      <TemplateSidebar
        activeId={profileNavigation.activeTab}
        onSelect={handleNavClick}
        onBrandClick={() => handleNavClick("Home")}
        items={[
          { id: "Home", label: t("dashboard.home"), icon: <Briefcase /> },
          { id: "Inbox", label: t("dashboard.inbox"), icon: <MailIcon />, badge: unreadMessagesCount },
          { id: "News", label: t("dashboard.news"), icon: <Newspaper /> },
          { id: "Schedule", label: t("dashboard.schedule"), icon: <CalendarIcon /> },
          ...(isUnemployed
            ? []
            : ([
                { id: "Squad", label: t("dashboard.squad"), icon: <Users /> },
                { id: "Tactics", label: t("dashboard.tactics"), icon: <Crosshair /> },
                { id: "Training", label: t("dashboard.training"), icon: <Dumbbell /> },
                { id: "Staff", label: t("dashboard.staff"), icon: <UserCog /> },
                { id: "Scouting", label: t("dashboard.scouting"), icon: <EyeIcon /> },
                { id: "Youth", label: t("dashboard.youthAcademy"), icon: <GraduationCap /> },
                { id: "Finances", label: t("dashboard.finances"), icon: <DollarSign /> },
                { id: "Transfers", label: t("dashboard.transfers"), icon: <ArrowRightLeft /> },
              ] as TemplateSidebarItem[])),
          { id: "Players", label: t("dashboard.players"), icon: <UsersRound /> },
          { id: "Teams", label: t("dashboard.teams"), icon: <Building2 /> },
          { id: "Tournaments", label: t("dashboard.tournaments"), icon: <Trophy /> },
          { id: "Settings", label: t("settings.title", { defaultValue: "Settings" }), icon: <Settings /> },
        ]}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TemplateHeader
          seasonLabel={t("dashboard.season", { defaultValue: "Season" })}
          seasonDate={currentDate}
          reputationLabel={myTeamName ?? t("dashboard.unemployed", { defaultValue: "Unemployed" })}
          reputationStars={Math.min(
            5,
            Math.max(1, Math.round((gameState.teams.find((tm) => tm.id === gameState.manager.team_id)?.reputation ?? 0) / 200)),
          )}
          managerName={managerName ?? ""}
          managerRole={myTeamName ? t("dashboard.manager") : t("dashboard.unemployed", { defaultValue: "Unemployed" })}
          unreadCount={unreadMessagesCount}
          searchValue={searchQuery}
          onSearchChange={handleSearchQueryChange}
          onSearchFocus={handleSearchFocus}
          onSearchBlur={handleSearchBlur}
          onInbox={() => handleNavClick("Inbox")}
          onHelp={handleNavigateSettings}
          activeTabLabel={activeTabLabel}
          hasProfileHistory={hasProfileHistory}
          matchedPlayers={searchResults.matchedPlayers}
          matchedTeams={searchResults.matchedTeams}
          onBack={handleBack}
          onSelectSearchPlayer={handleSelectSearchPlayer}
          onSelectSearchTeam={handleSelectSearchTeam}
          searchOpen={searchOpen}
          teams={gameState.teams}
          hasMatchToday={hasMatchToday}
          isAdvancing={isAdvancing}
          isSaving={isSaving}
          isUnemployed={isUnemployed ?? false}
          matchMode={matchMode}
          modeMeta={MODE_META}
          onContinue={handleContinue}
          onSave={handleSave}
          onSelectMatchMode={handleSelectMatchMode}
          onSkipToMatchDay={handleSkipToMatchDay}
          onVacation={openVacationPicker}
          onToggleContinueMenu={handleToggleContinueMenu}
          saveFlash={saveFlash}
          seasonComplete={seasonComplete}
          showContinueMenu={showContinueMenu}
          labels={{
            continue: t("dashboard.continue"),
            saved: t("dashboard.saved"),
            saving: t("dashboard.saving"),
            save: t("common.save"),
            saveGame: t("dashboard.saveGame"),
            simulating: t("dashboard.simulating"),
            seasonComplete: t("endOfSeason.seasonComplete"),
            skipToMatchDay: t("continueMenu.skipToMatchDay"),
            skipToMatchDayDesc: t("continueMenu.skipToMatchDayDesc"),
            vacation: t("continueMenu.vacation", { defaultValue: "Vacation" }),
            vacationDesc: t("continueMenu.vacationDesc", {
              defaultValue: "Fast-forward to a date you choose",
            }),
          }}
        />

        <DashboardOverlays
          blockerModal={blockerModal}
          currentModeMeta={currentModeMeta}
          gameState={gameState}
          handleConfirmMatch={handleConfirmMatch}
          handleExitToMenu={handleExitToMenu}
          handleNavigate={handleNavigate}
          handleCloseQuit={handleCloseQuit}
          handleVacation={handleVacation}
          isExitingToMenu={isExitingToMenu}
          matchMode={matchMode}
          setBlockerModal={setBlockerModal}
          setShowCloseConfirm={setShowCloseConfirm}
          setShowExitConfirm={setShowExitConfirm}
          setShowMatchConfirm={setShowMatchConfirm}
          showCloseConfirm={showCloseConfirm}
          showExitConfirm={showExitConfirm}
          showMatchConfirm={showMatchConfirm}
          showVacationPicker={showVacationPicker}
          closeVacationPicker={closeVacationPicker}
          teams={gameState.teams}
          todayMatchFixture={todayMatchFixture}
        />
        <FiredModal />

        {/* Main Content Area */}
        <main data-testid="dashboard-main" className="flex-1 overflow-auto p-4 custom-scrollbar">
          <div className="flex flex-col min-h-full">
            <DashboardWorkspaceContent
              dashboardAlerts={dashboardAlerts}
              gameState={gameState}
              profileNavigation={profileNavigation}
              dashboardTabContentModel={dashboardTabContentModel}
              onBack={handleBack}
              onNavigate={handleNavigate}
              onSelectPlayer={selectPlayer}
              onSelectTeam={selectTeam}
              onGameUpdate={setGameState}
              isUnemployed={isUnemployed ?? false}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
