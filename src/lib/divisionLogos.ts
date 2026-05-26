const DIVISION_LOGOS: Record<string, string> = {
  "England:Premier League": "/images/logo/england/england_english-premier-league.football-logos.cc.svg",
  "England:EFL Championship": "/images/logo/england/england_efl-championship.football-logos.cc.svg",
  "Spain:LaLiga": "/images/logo/spain/spain_la-liga.football-logos.cc.svg",
  "Spain:Segunda División": "/images/logo/spain/spain_la-liga-2.football-logos.cc.svg",
  "Italy:Serie A": "/images/logo/italy/italy_serie-a.football-logos.cc.svg",
  "Italy:Serie B": "/images/logo/italy/italy_serie-b.football-logos.cc.svg",
  "France:Ligue 1": "/images/logo/france/france_ligue-1.football-logos.cc.svg",
  "France:Ligue 2": "/images/logo/france/france_ligue-2.football-logos.cc.svg",
  "Germany:Bundesliga": "/images/logo/germany/germany_bundesliga.football-logos.cc.svg",
  "Germany:2. Bundesliga": "/images/logo/germany/germany_2-bundesliga.football-logos.cc.svg",
  "Portugal:Primeira Liga": "/images/logo/portugal/portugal_primeira-liga.football-logos.cc.svg",
  "Netherlands:Eredivisie": "/images/logo/netherlands/netherlands_eredivisie.football-logos.cc.svg",
  "Belgium:Belgian Pro League": "/images/logo/belgium/belgium_belgian-pro-league.football-logos.cc.svg",
};

export function getDivisionLogoUrl(country: string, leagueName: string): string | null {
  return DIVISION_LOGOS[`${country}:${leagueName}`] ?? null;
}
