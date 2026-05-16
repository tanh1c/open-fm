import { TemplateGoalsAnalysis, type TemplateGoalSegment } from "./widgets/TemplateGoalsAnalysis";
import { TemplateRightSidebar, type TemplateFixtureRow, type TemplateLeagueTableRow, type TemplateTrainingRow } from "./widgets/TemplateRightSidebar";
import { TemplateSquadOverview, type TemplateSquadRow } from "./widgets/TemplateSquadOverview";
import { TemplateTactics, type TemplatePlayerSlot } from "./widgets/TemplateTactics";
import { TemplateTeamForm } from "./widgets/TemplateTeamForm";
import { TemplateTransferActivity, type TemplateTransferActivityItem } from "./widgets/TemplateTransferActivity";
import { TemplateUpcomingMatch } from "./widgets/TemplateUpcomingMatch";

export interface TemplateDashboardProps {
  upcomingMatch: {
    competitionLabel: string;
    fixtureLabel: string;
    dateLabel: string;
    timeLabel?: string;
    homeTeamName: string;
    awayTeamName: string;
    homeSideLabel: string;
    awaySideLabel: string;
    homeForm: string[];
    awayForm: string[];
    weatherLabel?: string;
  };
  tactics: {
    formation: string;
    tacticalStyle: string;
    players: TemplatePlayerSlot[];
    instructions: {
      teamInstructions: string[];
      inPossession: string;
      inTransition: string;
      outOfPossession: string;
    };
  };
  squad: {
    players: TemplateSquadRow[];
    activeTab: string;
    onTabChange: (tab: string) => void;
  };
  form: {
    results: Array<"W" | "D" | "L">;
    totals: { won: number; drawn: number; lost: number };
    pointsPerGame: number;
  };
  goals: TemplateGoalSegment[];
  transferActivity: TemplateTransferActivityItem[];
  rightSidebar: {
    leagueRows: TemplateLeagueTableRow[];
    squadStatus: {
      injured: number;
      matchFit: number;
      tired: number;
      internationalDuty: number;
      moraleLabel: string;
    };
    fixtures: TemplateFixtureRow[];
    trainingRows: TemplateTrainingRow[];
    trainingScheduleLabel: string;
  };
  onNavigate?: (tab: string) => void;
}

export function TemplateDashboard({ upcomingMatch, tactics, squad, form, goals, transferActivity, rightSidebar, onNavigate }: TemplateDashboardProps) {
  return (
    <div data-testid="template-dashboard" className="flex flex-col xl:flex-row gap-4 min-h-full">
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 min-h-[360px]">
            <TemplateUpcomingMatch {...upcomingMatch} onPreview={() => onNavigate?.("Schedule")} />
          </div>
          <div className="col-span-1 lg:col-span-2 min-h-[360px]">
            <TemplateTactics {...tactics} />
          </div>
        </div>

        <div className="min-h-[280px]">
          <TemplateSquadOverview
            players={squad.players}
            activeTab={squad.activeTab}
            onTabChange={squad.onTabChange}
            onPlayerClick={() => onNavigate?.("Squad")}
            onViewFullSquad={() => onNavigate?.("Squad")}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TemplateTeamForm {...form} />
          <TemplateGoalsAnalysis data={goals} onViewFullAnalysis={() => onNavigate?.("Stats")} />
          <TemplateTransferActivity items={transferActivity} onViewAllTransfers={() => onNavigate?.("Transfers")} />
        </div>
      </div>

      <div data-testid="template-right-sidebar" className="w-full xl:w-[320px] shrink-0 flex flex-col gap-4">
        <TemplateRightSidebar
          {...rightSidebar}
          onViewTable={() => onNavigate?.("Tournaments")}
          onViewSchedule={() => onNavigate?.("Schedule")}
          onViewTraining={() => onNavigate?.("Training")}
        />
      </div>
    </div>
  );
}
