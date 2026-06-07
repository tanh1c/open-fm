import type { ReactNode } from "react";
import { ChevronRight, Crosshair } from "lucide-react";
import { TemplateCard, TemplateCardHeader } from "../Card";
import { cn } from "../templateUtils";

export interface TemplatePlayerSlot {
  id: string;
  name: string;
  number: number;
  role: string;
  x: number;
  y: number;
}

interface TemplateTacticsProps {
  formation: string;
  tacticalStyle: string;
  players: TemplatePlayerSlot[];
  instructions: {
    teamInstructions: string[];
    inPossession: string;
    inTransition: string;
    outOfPossession: string;
  };
  onOpenTactics?: () => void;
}

export function TemplateTactics({ formation, tacticalStyle, players, instructions, onOpenTactics }: TemplateTacticsProps) {
  return (
    <TemplateCard className="flex flex-col h-full">
      <TemplateCardHeader
        title={`Tactics • ${formation}`}
        action={
          <button
            type="button"
            onClick={onOpenTactics}
            className="flex items-center gap-2 text-left hover:text-app-green transition-colors disabled:hover:text-inherit"
            disabled={!onOpenTactics}
          >
            <span className="text-[10px] text-app-text-muted">TACTICAL STYLE</span>
            <span className="text-xs font-semibold">{tacticalStyle}</span>
            <ChevronRight className="w-3 h-3 text-app-text-muted rotate-90" />
          </button>
        }
      />
      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        <div className="flex-1 p-4 flex items-center justify-center min-w-0 min-h-0">
          <div data-testid="template-tactics-pitch" className="w-full max-w-[400px] sm:aspect-[4/3] min-h-[300px] bg-surface-800 border-2 border-primary-700/50 rounded-xl relative overflow-hidden flex shadow-inner">
            <div className="absolute inset-0 flex flex-col">
              <div className="h-1/2 w-full border-b-2 border-primary-700/50 flex justify-center">
                <div className="h-16 w-32 border-2 border-t-0 border-primary-700/50 flex justify-center">
                  <div className="h-6 w-12 border-2 border-t-0 border-primary-700/50" />
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-primary-700/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="h-1/2 w-full flex justify-center items-end">
                <div className="h-16 w-32 border-2 border-b-0 border-primary-700/50 flex justify-center items-end">
                  <div className="h-6 w-12 border-2 border-b-0 border-primary-700/50" />
                </div>
              </div>
            </div>

            {players.map((player) => (
              <PlayerNode key={player.id} num={player.number} name={player.name} role={player.role} x={`${player.x}%`} y={`${player.y}%`} color={player.role.startsWith("GK") || player.role.startsWith("SK") ? "accent" : "primary"} />
            ))}
          </div>
        </div>

        <div className="w-full sm:w-48 shrink-0 sm:border-l sm:border-t-0 border-t border-app-border/50 p-4 flex flex-col gap-4 overflow-y-auto min-h-0">
          <Section title="TEAM INSTRUCTIONS">
            {instructions.teamInstructions.map((text) => (
              <InstructionItem key={text} text={text} />
            ))}
          </Section>

          <Section title="IN POSSESSION" icon={<Crosshair className="w-3 h-3" />}>
            <InstructionItem text={instructions.inPossession} />
          </Section>

          <Section title="IN TRANSITION" icon={<Crosshair className="w-3 h-3" />}>
            <InstructionItem text={instructions.inTransition} />
          </Section>

          <Section title="OUT OF POSSESSION" icon={<Crosshair className="w-3 h-3" />}>
            <InstructionItem text={instructions.outOfPossession} />
          </Section>
        </div>
      </div>
    </TemplateCard>
  );
}

function PlayerNode({
  num,
  name,
  role,
  x,
  y,
  color = "primary",
}: {
  num: number;
  name: string;
  role: string;
  x: string;
  y: string;
  color?: "primary" | "accent";
}) {
  const [roleName, duty] = role.split(" - ");

  return (
    <div
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 w-16"
      style={{ left: x, top: y }}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-lg ring-1 ring-white/10 mb-1",
          color === "primary" ? "bg-primary-500 text-white" : "bg-accent-500 text-surface-950",
        )}
      >
        {num}
      </div>
      <div className="w-[120%] rounded px-1 py-0.5 text-center flex flex-col items-center [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
        <span className="text-[9px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis w-full">{name}</span>
        <span className="text-[8px] text-white/80 whitespace-nowrap font-medium">
          {roleName}
          {duty && (
            <>
              {" · "}
              <span className={role.includes("De") ? "text-app-red" : role.includes("At") ? "text-app-green" : "text-amber-400"}>{duty}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 cursor-pointer group">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-app-text-muted group-hover:text-white transition-colors uppercase tracking-wider">
          {icon}
          {title}
        </div>
        <ChevronRight className="w-3 h-3 text-app-text-muted group-hover:text-white transition-colors" />
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function InstructionItem({ text }: { text: string }) {
  return <div className="text-xs text-app-text bg-app-bg border border-app-border/50 rounded px-2.5 py-1.5">{text}</div>;
}
