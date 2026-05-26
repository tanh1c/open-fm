import { getTeamLogoUrl } from "../../lib/teamLogos";
import { TeamData } from "../../store/types";

interface TeamLogoProps {
  team: Pick<TeamData, "name" | "short_name" | "country" | "domestic_tier">;
  selected?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-8 w-8 rounded-lg p-1",
  md: "h-12 w-12 rounded-lg p-1.5",
};

export default function TeamLogo({
  team,
  selected = false,
  size = "md",
  className = "",
}: TeamLogoProps) {
  const logoUrl = getTeamLogoUrl(team);
  const initials = team.short_name || team.name.slice(0, 3).toUpperCase();
  const fallbackClassName = `${SIZE_CLASSES[size]} flex items-center justify-center font-heading font-bold ${size === "sm" ? "text-xs" : "text-lg"} ${selected
    ? "bg-white/20 text-white"
    : "bg-white/10 text-gray-300"
    } ${className}`;

  if (!logoUrl) {
    return <div className={fallbackClassName}>{initials}</div>;
  }

  return (
    <div className={`${SIZE_CLASSES[size]} flex shrink-0 items-center justify-center bg-white/90 shadow-sm ${className}`}>
      <img
        src={logoUrl}
        alt={`${team.name} logo`}
        className="h-full w-full object-contain"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          event.currentTarget.nextElementSibling?.classList.remove("hidden");
        }}
      />
      <span className="hidden font-heading text-xs font-bold text-surface-800">
        {initials}
      </span>
    </div>
  );
}
