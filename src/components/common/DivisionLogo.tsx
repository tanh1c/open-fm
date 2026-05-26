import { Layers3 } from "lucide-react";
import { getDivisionLogoUrl } from "../../lib/divisionLogos";

interface DivisionLogoProps {
  country: string;
  leagueName: string;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-9 w-9 rounded-lg p-1.5",
  md: "h-14 w-14 rounded-xl p-2",
};

export default function DivisionLogo({
  country,
  leagueName,
  size = "md",
  className = "",
}: DivisionLogoProps) {
  const logoUrl = getDivisionLogoUrl(country, leagueName);

  if (!logoUrl) {
    return (
      <div className={`${SIZE_CLASSES[size]} flex items-center justify-center bg-accent-500/10 text-accent-600 dark:text-accent-300 ${className}`}>
        <Layers3 className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      </div>
    );
  }

  return (
    <div className={`${SIZE_CLASSES[size]} flex shrink-0 items-center justify-center bg-white shadow-sm ring-1 ring-gray-200 dark:bg-white dark:ring-white/20 ${className}`}>
      <img src={logoUrl} alt={`${leagueName} logo`} className="h-full w-full object-contain" loading="lazy" />
    </div>
  );
}
