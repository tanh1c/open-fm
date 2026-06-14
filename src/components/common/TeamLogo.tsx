import { CountryFlag } from "../ui/CountryFlag";
import { getTeamLogoUrl } from "../../lib/teamLogos";
import { isValidCountryCode, normaliseNationality } from "../../lib/countries";
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
  const initials = team.short_name || team.name.slice(0, 3).toUpperCase();
  const countryCode = normaliseNationality(team.country ?? "").toUpperCase();
  const isNationalTeam = team.domestic_tier == null && isValidCountryCode(countryCode);
  const fallbackClassName = `${SIZE_CLASSES[size]} flex items-center justify-center font-heading font-bold ${size === "sm" ? "text-xs" : "text-lg"} ${selected
    ? "bg-white/20 text-white"
    : "bg-white/10 text-gray-300"
    } ${className}`;

  if (isNationalTeam) {
    return (
      <div className={`${SIZE_CLASSES[size]} flex shrink-0 items-center justify-center overflow-hidden bg-white/95 shadow-sm ${className}`}>
        <CountryFlag code={countryCode} className={size === "sm" ? "text-lg leading-none" : "text-2xl leading-none"} title={`${team.name} flag`} />
      </div>
    );
  }

  const logoUrl = getTeamLogoUrl(team);

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
