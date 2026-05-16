import { ChevronRight, Crosshair } from "lucide-react";
import { Card, CardHeader } from "../ui";

export interface PlayerSlot {
  id: string;
  name: string;
  number: number;
  /** Role label, e.g. "PF - At" / "DLP - De". */
  role: string;
  /** 0-100 percent across pitch width (0 = left touchline). */
  x: number;
  /** 0-100 percent down pitch (0 = opposition goal, 100 = own goal). */
  y: number;
}

interface TacticsFormationCardProps {
  formation: string;
  tacticalStyle: string;
  players: PlayerSlot[];
  instructions: {
    teamInstructions: string[];
    inPossession: string;
    inTransition: string;
    outOfPossession: string;
  };
  className?: string;
}

/**
 * FM25-style tactics card. Pitch SVG on the left fills 2/3 of the card width
 * with player jerseys positioned by (x, y) percent of the pitch. Right column
 * shows team instructions + 3 phase boxes (in / out / transition).
 */
export function TacticsFormationCard({
  formation,
  tacticalStyle,
  players,
  instructions,
  className = "",
}: TacticsFormationCardProps) {
  return (
    <Card className={className}>
      <CardHeader
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-app-text-muted uppercase tracking-wider">
              Tactical Style
            </span>
            <span className="text-xs font-semibold text-app-text">{tacticalStyle}</span>
            <ChevronRight className="w-3 h-3 text-app-text-muted rotate-90" />
          </div>
        }
      >
        Tactics · {formation}
      </CardHeader>

      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        <div className="flex-1 p-4 flex items-center justify-center min-w-0 min-h-0">
          <div
            data-testid="tactics-pitch-shell"
            className="w-full max-w-[400px] sm:aspect-[4/3] min-h-[300px] bg-[#1a2e25] border-2 border-emerald-900/50 rounded-xl relative overflow-hidden flex shadow-inner"
          >
            <PitchSvg />
            {players.map((player) => (
              <Jersey key={player.id} player={player} />
            ))}
          </div>
        </div>

        <div className="w-full sm:w-48 shrink-0 sm:border-l sm:border-t-0 border-t border-app-border/50 p-4 flex flex-col gap-4 overflow-y-auto min-h-0 text-xs">
          <InstructionBlock label="Team Instructions">
            <div className="flex flex-col gap-1.5">
              {instructions.teamInstructions.map((phrase) => (
                <span
                  key={phrase}
                  className="px-2 py-1 rounded bg-app-bg/80 border border-app-border text-app-text text-[11px]"
                >
                  {phrase}
                </span>
              ))}
            </div>
          </InstructionBlock>

          <InstructionBlock label="In Possession" icon={<Crosshair className="w-3 h-3" />}>
            <Phrase>{instructions.inPossession}</Phrase>
          </InstructionBlock>

          <InstructionBlock label="In Transition" icon={<Crosshair className="w-3 h-3" />}>
            <Phrase>{instructions.inTransition}</Phrase>
          </InstructionBlock>

          <InstructionBlock label="Out Of Possession" icon={<Crosshair className="w-3 h-3" />}>
            <Phrase>{instructions.outOfPossession}</Phrase>
          </InstructionBlock>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function InstructionBlock({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 cursor-pointer group">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-app-text-muted group-hover:text-white transition-colors uppercase tracking-wider">
          {icon}
          {label}
        </div>
        <ChevronRight className="w-3 h-3 text-app-text-muted group-hover:text-white transition-colors" />
      </div>
      <div className="flex flex-col gap-1.5">
        {children}
      </div>
    </div>
  );
}

function Phrase({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs text-app-text bg-app-bg border border-app-border/50 rounded px-2.5 py-1.5 inline-block w-fit">
      {children}
    </span>
  );
}

function PitchSvg() {
  return (
    <svg
      viewBox="0 0 100 130"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Football pitch"
    >
      <defs>
        <linearGradient id="pitch-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f5d3b" />
          <stop offset="50%" stopColor="#1a4f33" />
          <stop offset="100%" stopColor="#1f5d3b" />
        </linearGradient>
        <pattern id="pitch-stripes" width="100" height="13" patternUnits="userSpaceOnUse">
          <rect width="100" height="13" fill="url(#pitch-grad)" />
          <rect width="100" height="6.5" fill="rgba(255,255,255,0.025)" />
        </pattern>
      </defs>

      {/* Field */}
      <rect width="100" height="130" fill="url(#pitch-stripes)" rx="2" />

      {/* Outer line + halfway */}
      <g
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="0.4"
        fill="none"
      >
        <rect x="2" y="2" width="96" height="126" rx="0.5" />
        <line x1="2" y1="65" x2="98" y2="65" />
        <circle cx="50" cy="65" r="9" />
        <circle cx="50" cy="65" r="0.6" fill="rgba(255,255,255,0.45)" stroke="none" />

        {/* Top penalty box (away goal) */}
        <rect x="22" y="2" width="56" height="14" />
        <rect x="36" y="2" width="28" height="6" />
        <circle cx="50" cy="11" r="0.6" fill="rgba(255,255,255,0.45)" stroke="none" />
        <path d="M 38 16 A 14 14 0 0 0 62 16" />

        {/* Bottom penalty box (home goal) */}
        <rect x="22" y="114" width="56" height="14" />
        <rect x="36" y="122" width="28" height="6" />
        <circle cx="50" cy="119" r="0.6" fill="rgba(255,255,255,0.45)" stroke="none" />
        <path d="M 38 114 A 14 14 0 0 1 62 114" />
      </g>
    </svg>
  );
}

function Jersey({ player }: { player: PlayerSlot }) {
  const dutyClass = player.role.includes("De")
    ? "text-app-red"
    : player.role.includes("At")
      ? "text-app-green"
      : "text-amber-400";

  return (
    <div
      data-jersey={player.id}
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 w-16 pointer-events-auto"
      style={{ left: `${player.y}%`, top: `${player.x}%` }}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-lg ring-1 ring-white/10 mb-1 ${
          player.role.startsWith("SK")
            ? "bg-amber-500 text-white"
            : "bg-app-green text-app-bg"
        }`}
      >
        {player.number}
      </div>
      <div className="w-[120%] bg-app-bg/80 border border-app-border backdrop-blur-sm rounded px-1 py-0.5 text-center flex flex-col items-center shadow-sm">
        <span className="text-[9px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis w-full">
          {player.name}
        </span>
        <span className="text-[8px] text-app-text-muted whitespace-nowrap font-medium">
          {player.role.split(" - ")[0]}
          {player.role.includes(" - ") && (
            <>
              {" · "}
              <span className={dutyClass}>{player.role.split(" - ")[1]}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
