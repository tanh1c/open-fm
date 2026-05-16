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
          <span className="text-[10px] uppercase tracking-widest text-app-text-muted">
            Tactical Style{" "}
            <span className="text-app-text font-semibold ml-1">{tacticalStyle}</span>
          </span>
        }
      >
        Tactics · {formation}
      </CardHeader>

      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        <div
          data-testid="tactics-pitch-shell"
          className="w-full max-w-[400px] sm:aspect-[4/3] min-h-[300px] bg-[#1a2e25] border-2 border-emerald-900/50 rounded-xl relative overflow-hidden flex shadow-inner m-4"
        >
          <PitchSvg />
          {players.map((player) => (
            <Jersey key={player.id} player={player} />
          ))}
        </div>

        <div className="w-full sm:w-48 shrink-0 sm:border-l border-app-border/50 p-4 flex flex-col gap-4 text-xs">
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

          <InstructionBlock label="In Possession">
            <Phrase>{instructions.inPossession}</Phrase>
          </InstructionBlock>

          <InstructionBlock label="In Transition">
            <Phrase>{instructions.inTransition}</Phrase>
          </InstructionBlock>

          <InstructionBlock label="Out Of Possession">
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function Phrase({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 rounded bg-app-bg/80 border border-app-border text-app-text text-[11px] inline-block w-fit">
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
  return (
    <div
      data-jersey={player.id}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto"
      style={{ left: `${player.x}%`, top: `${player.y}%` }}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-stat font-bold text-xs border shadow-md ${
          player.role.startsWith("SK")
            ? "bg-warn-500 text-app-bg border-warn-500/70"
            : "bg-app-green text-app-bg border-app-green/70"
        }`}
      >
        {player.number}
      </div>
      <div className="mt-1 text-center min-w-16 bg-app-bg/80 border border-app-border backdrop-blur-sm rounded px-1.5 py-1">
        <div className="text-[10px] font-semibold text-app-text leading-tight whitespace-nowrap">
          {player.name}
        </div>
        <div className="text-[9px] font-stat text-app-text-muted leading-tight">
          {player.role}
        </div>
      </div>
    </div>
  );
}
