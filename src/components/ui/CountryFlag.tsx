import * as FlagIcons from "country-flag-icons/react/3x2";
import {
  countryName,
  isValidCountryCode,
  normaliseNationality,
  resolveCountryFlagCode,
} from "../../lib/countries";

type FlagComponent = (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;

const flagIcons = FlagIcons as Record<string, FlagComponent>;

interface CountryFlagProps {
  code: string;
  locale?: string;
  className?: string;
  title?: string;
}

export function CountryFlag({
  code,
  locale = "en",
  className = "",
  title,
}: CountryFlagProps) {
  const normalisedCode = normaliseNationality(code).toUpperCase();

  if (!isValidCountryCode(normalisedCode)) {
    return null;
  }

  const flagCode = resolveCountryFlagCode(normalisedCode);
  const FlagIcon = flagCode ? flagIcons[flagCode.replace(/-/g, "_")] : null;

  const accessibleLabel =
    title ?? countryName(normalisedCode, locale) ?? normalisedCode;
  const classes = [
    "inline-flex",
    "items-center",
    "justify-center",
    "shrink-0",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!FlagIcon) {
    return (
      <span
        role="img"
        aria-label={accessibleLabel}
        title={accessibleLabel}
        className={[
          classes,
          "rounded border border-white/15 bg-black/10 px-1 py-0.5 font-heading text-[0.65em] font-bold leading-none tracking-wide",
        ].join(" ")}
      >
        {normalisedCode}
      </span>
    );
  }

  return (
    <span className={classes} title={accessibleLabel}>
      <FlagIcon
        role="img"
        aria-label={accessibleLabel}
        focusable="false"
        className="h-[1em] w-[1.5em] rounded-[2px] shadow-sm"
      />
    </span>
  );
}
