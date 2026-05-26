import { TeamData } from "../store/types";

const PREMIER_LEAGUE_LOGO_BASE = "/images/logo/english-premier-league-2026-2027.football-logos.cc/128x128";
const CHAMPIONSHIP_LOGO_BASE = "/images/logo/england-efl-championship-2026-2027.football-logos.cc/128x128";
const LA_LIGA_LOGO_BASE = "/images/logo/spain-la-liga-2025-2026.football-logos.cc/128x128";
const LA_LIGA_2_LOGO_BASE = "/images/logo/spain-la-liga-2-2025-2026.football-logos.cc/128x128";
const SERIE_A_LOGO_BASE = "/images/logo/italy-serie-a-2025-2026.football-logos.cc/128x128";
const SERIE_B_LOGO_BASE = "/images/logo/italy-serie-b-2025-2026.football-logos.cc/128x128";
const LIGUE_1_LOGO_BASE = "/images/logo/france-ligue-1-2025-2026.football-logos.cc/128x128";
const LIGUE_2_LOGO_BASE = "/images/logo/france-ligue-2-2025-2026.football-logos.cc/128x128";
const BUNDESLIGA_LOGO_BASE = "/images/logo/germany-bundesliga-2025-2026.football-logos.cc/128x128";
const BUNDESLIGA_2_LOGO_BASE = "/images/logo/germany-2-bundesliga-2025-2026.football-logos.cc/128x128";
const PRIMEIRA_LIGA_LOGO_BASE = "/images/logo/portugal-primeira-liga-2025-2026.football-logos.cc/128x128";
const EREDIVISIE_LOGO_BASE = "/images/logo/netherlands-eredivisie-2025-2026.football-logos.cc/128x128";
const BELGIAN_PRO_LEAGUE_LOGO_BASE = "/images/logo/belgium-pro-league-2025-2026.football-logos.cc/128x128";

const LOGO_SLUGS_BY_TEAM: Record<string, string> = {
  Arsenal: `${PREMIER_LEAGUE_LOGO_BASE}/arsenal.football-logos.cc.png`,
  "Aston Villa": `${PREMIER_LEAGUE_LOGO_BASE}/aston-villa.football-logos.cc.png`,
  Bournemouth: `${PREMIER_LEAGUE_LOGO_BASE}/bournemouth.football-logos.cc.png`,
  Brentford: `${PREMIER_LEAGUE_LOGO_BASE}/brentford.football-logos.cc.png`,
  "Brighton & Hove Albion": `${PREMIER_LEAGUE_LOGO_BASE}/brighton.football-logos.cc.png`,
  Chelsea: `${PREMIER_LEAGUE_LOGO_BASE}/chelsea.football-logos.cc.png`,
  "Coventry City": `${PREMIER_LEAGUE_LOGO_BASE}/coventry-city.football-logos.cc.png`,
  "Crystal Palace": `${PREMIER_LEAGUE_LOGO_BASE}/crystal-palace.football-logos.cc.png`,
  Everton: `${PREMIER_LEAGUE_LOGO_BASE}/everton.football-logos.cc.png`,
  Fulham: `${PREMIER_LEAGUE_LOGO_BASE}/fulham.football-logos.cc.png`,
  "Hull City": `${PREMIER_LEAGUE_LOGO_BASE}/hull-city.football-logos.cc.png`,
  "Ipswich Town": `${PREMIER_LEAGUE_LOGO_BASE}/ipswich.football-logos.cc.png`,
  "Leeds United": `${PREMIER_LEAGUE_LOGO_BASE}/leeds-united.football-logos.cc.png`,
  Liverpool: `${PREMIER_LEAGUE_LOGO_BASE}/liverpool.football-logos.cc.png`,
  "Manchester City": `${PREMIER_LEAGUE_LOGO_BASE}/manchester-city.football-logos.cc.png`,
  "Manchester United": `${PREMIER_LEAGUE_LOGO_BASE}/manchester-united.football-logos.cc.png`,
  "Newcastle United": `${PREMIER_LEAGUE_LOGO_BASE}/newcastle.football-logos.cc.png`,
  "Nottingham Forest": `${PREMIER_LEAGUE_LOGO_BASE}/nottingham-forest.football-logos.cc.png`,
  Sunderland: `${PREMIER_LEAGUE_LOGO_BASE}/sunderland.football-logos.cc.png`,
  "Tottenham Hotspur": `${PREMIER_LEAGUE_LOGO_BASE}/tottenham.football-logos.cc.png`,
  "Birmingham City": `${CHAMPIONSHIP_LOGO_BASE}/birmingham.football-logos.cc.png`,
  "Blackburn Rovers": `${CHAMPIONSHIP_LOGO_BASE}/blackburn-rovers.football-logos.cc.png`,
  "Bolton Wanderers": `${CHAMPIONSHIP_LOGO_BASE}/bolton.football-logos.cc.png`,
  "Bristol City": `${CHAMPIONSHIP_LOGO_BASE}/bristol-city.football-logos.cc.png`,
  Burnley: `${CHAMPIONSHIP_LOGO_BASE}/burnley.football-logos.cc.png`,
  "Cardiff City": `${CHAMPIONSHIP_LOGO_BASE}/cardiff-city.football-logos.cc.png`,
  "Charlton Athletic": `${CHAMPIONSHIP_LOGO_BASE}/charlton.football-logos.cc.png`,
  "Derby County": `${CHAMPIONSHIP_LOGO_BASE}/derby-county.football-logos.cc.png`,
  "Lincoln City": `${CHAMPIONSHIP_LOGO_BASE}/lincoln-city.football-logos.cc.png`,
  Middlesbrough: `${CHAMPIONSHIP_LOGO_BASE}/middlesbrough.football-logos.cc.png`,
  Millwall: `${CHAMPIONSHIP_LOGO_BASE}/millwall.football-logos.cc.png`,
  "Norwich City": `${CHAMPIONSHIP_LOGO_BASE}/norwich-city.football-logos.cc.png`,
  Portsmouth: `${CHAMPIONSHIP_LOGO_BASE}/portsmouth.football-logos.cc.png`,
  "Preston North End": `${CHAMPIONSHIP_LOGO_BASE}/preston-north-end.football-logos.cc.png`,
  "Queens Park Rangers": `${CHAMPIONSHIP_LOGO_BASE}/queens-park-rangers.football-logos.cc.png`,
  "Sheffield United": `${CHAMPIONSHIP_LOGO_BASE}/sheffield-united.football-logos.cc.png`,
  Southampton: `${CHAMPIONSHIP_LOGO_BASE}/southampton.football-logos.cc.png`,
  "Stoke City": `${CHAMPIONSHIP_LOGO_BASE}/stoke-city.football-logos.cc.png`,
  "Swansea City": `${CHAMPIONSHIP_LOGO_BASE}/swansea-city.football-logos.cc.png`,
  Watford: `${CHAMPIONSHIP_LOGO_BASE}/watford.football-logos.cc.png`,
  "West Bromwich Albion": `${CHAMPIONSHIP_LOGO_BASE}/west-bromwich-albion.football-logos.cc.png`,
  "West Ham United": `${CHAMPIONSHIP_LOGO_BASE}/west-ham.football-logos.cc.png`,
  "Wolverhampton Wanderers": `${CHAMPIONSHIP_LOGO_BASE}/wolves.football-logos.cc.png`,
  Wrexham: `${CHAMPIONSHIP_LOGO_BASE}/wrexham.football-logos.cc.png`,
  "Athletic Club": `${LA_LIGA_LOGO_BASE}/athletic-club.football-logos.cc.png`,
  "Atlético Madrid": `${LA_LIGA_LOGO_BASE}/atletico-madrid.football-logos.cc.png`,
  Barcelona: `${LA_LIGA_LOGO_BASE}/barcelona.football-logos.cc.png`,
  "Celta Vigo": `${LA_LIGA_LOGO_BASE}/celta.football-logos.cc.png`,
  Alavés: `${LA_LIGA_LOGO_BASE}/deportivo.football-logos.cc.png`,
  Deportivo: `${LA_LIGA_LOGO_BASE}/deportivo.football-logos.cc.png`,
  "Deportivo Alavés": `${LA_LIGA_LOGO_BASE}/deportivo.football-logos.cc.png`,
  Elche: `${LA_LIGA_LOGO_BASE}/elche.football-logos.cc.png`,
  Espanyol: `${LA_LIGA_LOGO_BASE}/espanyol.football-logos.cc.png`,
  Getafe: `${LA_LIGA_LOGO_BASE}/getafe.football-logos.cc.png`,
  Girona: `${LA_LIGA_LOGO_BASE}/girona.football-logos.cc.png`,
  Levante: `${LA_LIGA_LOGO_BASE}/levante.football-logos.cc.png`,
  Mallorca: `${LA_LIGA_LOGO_BASE}/mallorca.football-logos.cc.png`,
  Osasuna: `${LA_LIGA_LOGO_BASE}/osasuna.football-logos.cc.png`,
  "Real Oviedo": `${LA_LIGA_LOGO_BASE}/oviedo.football-logos.cc.png`,
  "Rayo Vallecano": `${LA_LIGA_LOGO_BASE}/rayo-vallecano.football-logos.cc.png`,
  "Real Betis": `${LA_LIGA_LOGO_BASE}/real-betis.football-logos.cc.png`,
  "Real Madrid": `${LA_LIGA_LOGO_BASE}/real-madrid.football-logos.cc.png`,
  "Real Sociedad": `${LA_LIGA_LOGO_BASE}/real-sociedad.football-logos.cc.png`,
  Sevilla: `${LA_LIGA_LOGO_BASE}/sevilla.football-logos.cc.png`,
  Valencia: `${LA_LIGA_LOGO_BASE}/valencia.football-logos.cc.png`,
  Villarreal: `${LA_LIGA_LOGO_BASE}/villarreal.football-logos.cc.png`,
  Albacete: `${LA_LIGA_2_LOGO_BASE}/albacete.football-logos.cc.png`,
  Almería: `${LA_LIGA_2_LOGO_BASE}/almeria.football-logos.cc.png`,
  Burgos: `${LA_LIGA_2_LOGO_BASE}/burgos.football-logos.cc.png`,
  Cádiz: `${LA_LIGA_2_LOGO_BASE}/cadiz.football-logos.cc.png`,
  Castellón: `${LA_LIGA_2_LOGO_BASE}/castellon.football-logos.cc.png`,
  Ceuta: `${LA_LIGA_2_LOGO_BASE}/ceuta.football-logos.cc.png`,
  Córdoba: `${LA_LIGA_2_LOGO_BASE}/cordoba.football-logos.cc.png`,
  "Cultural Leonesa": `${LA_LIGA_2_LOGO_BASE}/cultural-leonesa.football-logos.cc.png`,
  "Deportivo La Coruña": `${LA_LIGA_2_LOGO_BASE}/deportivo-la-coruna.football-logos.cc.png`,
  Eibar: `${LA_LIGA_2_LOGO_BASE}/eibar.football-logos.cc.png`,
  Granada: `${LA_LIGA_2_LOGO_BASE}/granada.football-logos.cc.png`,
  Huesca: `${LA_LIGA_2_LOGO_BASE}/huesca.football-logos.cc.png`,
  "Las Palmas": `${LA_LIGA_2_LOGO_BASE}/las-palmas.football-logos.cc.png`,
  Leganés: `${LA_LIGA_2_LOGO_BASE}/leganes.football-logos.cc.png`,
  Málaga: `${LA_LIGA_2_LOGO_BASE}/malaga.football-logos.cc.png`,
  Mirandés: `${LA_LIGA_2_LOGO_BASE}/mirandes.football-logos.cc.png`,
  "Racing Santander": `${LA_LIGA_2_LOGO_BASE}/racing.football-logos.cc.png`,
  "Sporting Gijón": `${LA_LIGA_2_LOGO_BASE}/sporting-gijon.football-logos.cc.png`,
  Valladolid: `${LA_LIGA_2_LOGO_BASE}/valladolid.football-logos.cc.png`,
  "Real Zaragoza": `${LA_LIGA_2_LOGO_BASE}/zaragoza.football-logos.cc.png`,
  Atalanta: `${SERIE_A_LOGO_BASE}/atalanta.football-logos.cc.png`,
  Bologna: `${SERIE_A_LOGO_BASE}/bologna.football-logos.cc.png`,
  Cagliari: `${SERIE_A_LOGO_BASE}/cagliari.football-logos.cc.png`,
  Como: `${SERIE_A_LOGO_BASE}/como-1907.football-logos.cc.png`,
  "Como 1907": `${SERIE_A_LOGO_BASE}/como-1907.football-logos.cc.png`,
  Cremonese: `${SERIE_A_LOGO_BASE}/cremonese.football-logos.cc.png`,
  Fiorentina: `${SERIE_A_LOGO_BASE}/fiorentina.football-logos.cc.png`,
  Genoa: `${SERIE_A_LOGO_BASE}/genoa.football-logos.cc.png`,
  Inter: `${SERIE_A_LOGO_BASE}/inter.football-logos.cc.png`,
  "Inter Milan": `${SERIE_A_LOGO_BASE}/inter.football-logos.cc.png`,
  Juventus: `${SERIE_A_LOGO_BASE}/juventus.football-logos.cc.png`,
  Lazio: `${SERIE_A_LOGO_BASE}/lazio.football-logos.cc.png`,
  Lecce: `${SERIE_A_LOGO_BASE}/lecce.football-logos.cc.png`,
  Milan: `${SERIE_A_LOGO_BASE}/milan.football-logos.cc.png`,
  "AC Milan": `${SERIE_A_LOGO_BASE}/milan.football-logos.cc.png`,
  Napoli: `${SERIE_A_LOGO_BASE}/napoli.football-logos.cc.png`,
  Parma: `${SERIE_A_LOGO_BASE}/parma.football-logos.cc.png`,
  Pisa: `${SERIE_A_LOGO_BASE}/pisa.football-logos.cc.png`,
  Roma: `${SERIE_A_LOGO_BASE}/roma.football-logos.cc.png`,
  Sassuolo: `${SERIE_A_LOGO_BASE}/sassuolo.football-logos.cc.png`,
  Torino: `${SERIE_A_LOGO_BASE}/torino.football-logos.cc.png`,
  Udinese: `${SERIE_A_LOGO_BASE}/udinese.football-logos.cc.png`,
  Verona: `${SERIE_A_LOGO_BASE}/verona.football-logos.cc.png`,
  "Hellas Verona": `${SERIE_A_LOGO_BASE}/verona.football-logos.cc.png`,
  Bari: `${SERIE_B_LOGO_BASE}/bari.football-logos.cc.png`,
  Carrarese: `${SERIE_B_LOGO_BASE}/carrarese.football-logos.cc.png`,
  Catanzaro: `${SERIE_B_LOGO_BASE}/catanzaro.football-logos.cc.png`,
  Cesena: `${SERIE_B_LOGO_BASE}/cesena.football-logos.cc.png`,
  Empoli: `${SERIE_B_LOGO_BASE}/empoli.football-logos.cc.png`,
  Frosinone: `${SERIE_B_LOGO_BASE}/frosinone.football-logos.cc.png`,
  "Juve Stabia": `${SERIE_B_LOGO_BASE}/juve-stabia.football-logos.cc.png`,
  "Mantova 1911": `${SERIE_B_LOGO_BASE}/mantova-1911.football-logos.cc.png`,
  Mantova: `${SERIE_B_LOGO_BASE}/mantova-1911.football-logos.cc.png`,
  Modena: `${SERIE_B_LOGO_BASE}/modena.football-logos.cc.png`,
  Monza: `${SERIE_B_LOGO_BASE}/monza.football-logos.cc.png`,
  Padova: `${SERIE_B_LOGO_BASE}/padova.football-logos.cc.png`,
  Palermo: `${SERIE_B_LOGO_BASE}/palermo.football-logos.cc.png`,
  Pescara: `${SERIE_B_LOGO_BASE}/pescara.football-logos.cc.png`,
  Reggiana: `${SERIE_B_LOGO_BASE}/reggiana.football-logos.cc.png`,
  Sampdoria: `${SERIE_B_LOGO_BASE}/sampdoria.football-logos.cc.png`,
  Spezia: `${SERIE_B_LOGO_BASE}/spezia.football-logos.cc.png`,
  Südtirol: `${SERIE_B_LOGO_BASE}/suditrol.football-logos.cc.png`,
  "US Avellino 1912": `${SERIE_B_LOGO_BASE}/us-avellino-1912.football-logos.cc.png`,
  Venezia: `${SERIE_B_LOGO_BASE}/venezia.football-logos.cc.png`,
  "Virtus Entella": `${SERIE_B_LOGO_BASE}/virtus-entella.football-logos.cc.png`,
  Angers: `${LIGUE_1_LOGO_BASE}/angers.football-logos.cc.png`,
  "AS Monaco": `${LIGUE_1_LOGO_BASE}/as-monaco.football-logos.cc.png`,
  Auxerre: `${LIGUE_1_LOGO_BASE}/auxerre.football-logos.cc.png`,
  Brest: `${LIGUE_1_LOGO_BASE}/brest.football-logos.cc.png`,
  "FC Metz": `${LIGUE_1_LOGO_BASE}/fc-metz.football-logos.cc.png`,
  "Le Havre AC": `${LIGUE_1_LOGO_BASE}/le-havre-ac.football-logos.cc.png`,
  Lille: `${LIGUE_1_LOGO_BASE}/lille.football-logos.cc.png`,
  Lorient: `${LIGUE_1_LOGO_BASE}/lorient.football-logos.cc.png`,
  Lyon: `${LIGUE_1_LOGO_BASE}/lyon.football-logos.cc.png`,
  Marseille: `${LIGUE_1_LOGO_BASE}/marseille.football-logos.cc.png`,
  Nantes: `${LIGUE_1_LOGO_BASE}/nantes.football-logos.cc.png`,
  Nice: `${LIGUE_1_LOGO_BASE}/nice.football-logos.cc.png`,
  "Paris FC": `${LIGUE_1_LOGO_BASE}/paris-fc.football-logos.cc.png`,
  "Paris Saint-Germain": `${LIGUE_1_LOGO_BASE}/paris-saint-germain.football-logos.cc.png`,
  "RC Lens": `${LIGUE_1_LOGO_BASE}/rc-lens.football-logos.cc.png`,
  "RC Strasbourg Alsace": `${LIGUE_1_LOGO_BASE}/rc-strasbourg-alsace.football-logos.cc.png`,
  Rennes: `${LIGUE_1_LOGO_BASE}/rennes.football-logos.cc.png`,
  Toulouse: `${LIGUE_1_LOGO_BASE}/toulouse.football-logos.cc.png`,
  Amiens: `${LIGUE_2_LOGO_BASE}/amiens.football-logos.cc.png`,
  Annecy: `${LIGUE_2_LOGO_BASE}/annecy.football-logos.cc.png`,
  "AS Saint-Étienne": `${LIGUE_2_LOGO_BASE}/as-saint-etienne.football-logos.cc.png`,
  Bastia: `${LIGUE_2_LOGO_BASE}/bastia.football-logos.cc.png`,
  Boulogne: `${LIGUE_2_LOGO_BASE}/boulogne.football-logos.cc.png`,
  "Clermont Foot": `${LIGUE_2_LOGO_BASE}/clermont-foot.football-logos.cc.png`,
  Dunkerque: `${LIGUE_2_LOGO_BASE}/dunkerque.football-logos.cc.png`,
  "Grenoble Foot 38": `${LIGUE_2_LOGO_BASE}/grenoble-foot-38.football-logos.cc.png`,
  Guingamp: `${LIGUE_2_LOGO_BASE}/guingamp.football-logos.cc.png`,
  "Le Mans": `${LIGUE_2_LOGO_BASE}/le-mans.football-logos.cc.png`,
  Montpellier: `${LIGUE_2_LOGO_BASE}/montpellier.football-logos.cc.png`,
  Nancy: `${LIGUE_2_LOGO_BASE}/nancy.football-logos.cc.png`,
  Pau: `${LIGUE_2_LOGO_BASE}/pau.football-logos.cc.png`,
  "Red Star FC": `${LIGUE_2_LOGO_BASE}/red-star-fc.football-logos.cc.png`,
  "Rodez AF": `${LIGUE_2_LOGO_BASE}/rodez-af.football-logos.cc.png`,
  "Stade de Reims": `${LIGUE_2_LOGO_BASE}/stade-de-reims.football-logos.cc.png`,
  "Stade Lavallois": `${LIGUE_2_LOGO_BASE}/stade-lavallois.football-logos.cc.png`,
  Troyes: `${LIGUE_2_LOGO_BASE}/troyes.football-logos.cc.png`,
  Augsburg: `${BUNDESLIGA_LOGO_BASE}/augsburg.football-logos.cc.png`,
  "Bayer Leverkusen": `${BUNDESLIGA_LOGO_BASE}/bayer-leverkusen.football-logos.cc.png`,
  "Bayern München": `${BUNDESLIGA_LOGO_BASE}/bayern-munchen.football-logos.cc.png`,
  "Borussia Dortmund": `${BUNDESLIGA_LOGO_BASE}/borussia-dortmund.football-logos.cc.png`,
  "Borussia Mönchengladbach": `${BUNDESLIGA_LOGO_BASE}/borussia-monchengladbach.football-logos.cc.png`,
  "Eintracht Frankfurt": `${BUNDESLIGA_LOGO_BASE}/eintracht-frankfurt.football-logos.cc.png`,
  "FC Heidenheim": `${BUNDESLIGA_LOGO_BASE}/fc-heidenheim.football-logos.cc.png`,
  Freiburg: `${BUNDESLIGA_LOGO_BASE}/freiburg.football-logos.cc.png`,
  "Hamburger SV": `${BUNDESLIGA_LOGO_BASE}/hamburger-sv.football-logos.cc.png`,
  Hoffenheim: `${BUNDESLIGA_LOGO_BASE}/hoffenheim.football-logos.cc.png`,
  Köln: `${BUNDESLIGA_LOGO_BASE}/koln.football-logos.cc.png`,
  "Mainz 05": `${BUNDESLIGA_LOGO_BASE}/mainz-05.football-logos.cc.png`,
  "RB Leipzig": `${BUNDESLIGA_LOGO_BASE}/rb-leipzig.football-logos.cc.png`,
  "St. Pauli": `${BUNDESLIGA_LOGO_BASE}/st-pauli.football-logos.cc.png`,
  "Union Berlin": `${BUNDESLIGA_LOGO_BASE}/union-berlin.football-logos.cc.png`,
  "VfB Stuttgart": `${BUNDESLIGA_LOGO_BASE}/vfb-stuttgart.football-logos.cc.png`,
  Wolfsburg: `${BUNDESLIGA_LOGO_BASE}/wolfsburg.football-logos.cc.png`,
  "Werder Bremen": `${BUNDESLIGA_LOGO_BASE}/werder-bremen.football-logos.cc.png`,
  "1. FC Magdeburg": `${BUNDESLIGA_2_LOGO_BASE}/1-fc-magdeburg.football-logos.cc.png`,
  "Arminia Bielefeld": `${BUNDESLIGA_2_LOGO_BASE}/arminia-bielefeld.football-logos.cc.png`,
  Darmstadt: `${BUNDESLIGA_2_LOGO_BASE}/darmstadt.football-logos.cc.png`,
  "Dynamo Dresden": `${BUNDESLIGA_2_LOGO_BASE}/dynamo-dresden.football-logos.cc.png`,
  "Eintracht Braunschweig": `${BUNDESLIGA_2_LOGO_BASE}/eintracht-braunschweig.football-logos.cc.png`,
  "FC Kaiserslautern": `${BUNDESLIGA_2_LOGO_BASE}/fc-kaiserslautern.football-logos.cc.png`,
  "FC Nürnberg": `${BUNDESLIGA_2_LOGO_BASE}/fc-nurnberg.football-logos.cc.png`,
  "Fortuna Düsseldorf": `${BUNDESLIGA_2_LOGO_BASE}/fortuna-dusseldorf.football-logos.cc.png`,
  "Hannover 96": `${BUNDESLIGA_2_LOGO_BASE}/hannover-96.football-logos.cc.png`,
  "Hertha BSC": `${BUNDESLIGA_2_LOGO_BASE}/hertha-bsc.football-logos.cc.png`,
  "Holstein Kiel": `${BUNDESLIGA_2_LOGO_BASE}/holstein-kiel.football-logos.cc.png`,
  Karlsruher: `${BUNDESLIGA_2_LOGO_BASE}/karlsruher.football-logos.cc.png`,
  Paderborn: `${BUNDESLIGA_2_LOGO_BASE}/paderborn.football-logos.cc.png`,
  "Preußen Münster": `${BUNDESLIGA_2_LOGO_BASE}/preussen-munster.football-logos.cc.png`,
  "Schalke 04": `${BUNDESLIGA_2_LOGO_BASE}/schalke-04.football-logos.cc.png`,
  "SpVgg Greuther Fürth": `${BUNDESLIGA_2_LOGO_BASE}/spvgg-greuther-furth.football-logos.cc.png`,
  "SV Elversberg": `${BUNDESLIGA_2_LOGO_BASE}/sv-elversberg.football-logos.cc.png`,
  "VfL Bochum": `${BUNDESLIGA_2_LOGO_BASE}/vfl-bochum.football-logos.cc.png`,
  Alverca: `${PRIMEIRA_LIGA_LOGO_BASE}/alverca.football-logos.cc.png`,
  Arouca: `${PRIMEIRA_LIGA_LOGO_BASE}/arouca.football-logos.cc.png`,
  "AVS Futebol SAD": `${PRIMEIRA_LIGA_LOGO_BASE}/avs-futebol-sad.football-logos.cc.png`,
  Benfica: `${PRIMEIRA_LIGA_LOGO_BASE}/benfica.football-logos.cc.png`,
  "Casa Pia AC": `${PRIMEIRA_LIGA_LOGO_BASE}/casa-pia-ac.football-logos.cc.png`,
  Estoril: `${PRIMEIRA_LIGA_LOGO_BASE}/estoril.football-logos.cc.png`,
  "Estrela da Amadora": `${PRIMEIRA_LIGA_LOGO_BASE}/estrela-da-amadora.football-logos.cc.png`,
  Famalicão: `${PRIMEIRA_LIGA_LOGO_BASE}/famalicao.football-logos.cc.png`,
  "FC Porto": `${PRIMEIRA_LIGA_LOGO_BASE}/fc-porto.football-logos.cc.png`,
  "Gil Vicente": `${PRIMEIRA_LIGA_LOGO_BASE}/gil-vicente.football-logos.cc.png`,
  Moreirense: `${PRIMEIRA_LIGA_LOGO_BASE}/moreirense.football-logos.cc.png`,
  "Nacional da Madeira": `${PRIMEIRA_LIGA_LOGO_BASE}/nacional-da-madeira.football-logos.cc.png`,
  "Rio Ave": `${PRIMEIRA_LIGA_LOGO_BASE}/rio-ave.football-logos.cc.png`,
  "Santa Clara": `${PRIMEIRA_LIGA_LOGO_BASE}/santa-clara.football-logos.cc.png`,
  "SC Braga": `${PRIMEIRA_LIGA_LOGO_BASE}/sc-braga.football-logos.cc.png`,
  "Sporting CP": `${PRIMEIRA_LIGA_LOGO_BASE}/sporting-cp.football-logos.cc.png`,
  Tondela: `${PRIMEIRA_LIGA_LOGO_BASE}/tondela.football-logos.cc.png`,
  "Vitória de Guimarães": `${PRIMEIRA_LIGA_LOGO_BASE}/vitoria-de-guimaraes.football-logos.cc.png`,
  Ajax: `${EREDIVISIE_LOGO_BASE}/ajax.football-logos.cc.png`,
  "AZ Alkmaar": `${EREDIVISIE_LOGO_BASE}/az-alkmaar.football-logos.cc.png`,
  "Excelsior Rotterdam": `${EREDIVISIE_LOGO_BASE}/excelsior-rotterdam.football-logos.cc.png`,
  "FC Groningen": `${EREDIVISIE_LOGO_BASE}/fc-groningen.football-logos.cc.png`,
  "FC Utrecht": `${EREDIVISIE_LOGO_BASE}/fc-utrecht.football-logos.cc.png`,
  Feyenoord: `${EREDIVISIE_LOGO_BASE}/feyenoord.football-logos.cc.png`,
  "Fortuna Sittard": `${EREDIVISIE_LOGO_BASE}/fortuna-sittard.football-logos.cc.png`,
  "Go Ahead Eagles": `${EREDIVISIE_LOGO_BASE}/go-ahead-eagles.football-logos.cc.png`,
  "Heracles Almelo": `${EREDIVISIE_LOGO_BASE}/heracles-almelo.football-logos.cc.png`,
  "NAC Breda": `${EREDIVISIE_LOGO_BASE}/nac-breda.football-logos.cc.png`,
  "NEC Nijmegen": `${EREDIVISIE_LOGO_BASE}/nec-nijmegen.football-logos.cc.png`,
  "PEC Zwolle": `${EREDIVISIE_LOGO_BASE}/pec-zwolle.football-logos.cc.png`,
  PSV: `${EREDIVISIE_LOGO_BASE}/psv.football-logos.cc.png`,
  "SC Heerenveen": `${EREDIVISIE_LOGO_BASE}/sc-heerenveen.football-logos.cc.png`,
  "Sparta Rotterdam": `${EREDIVISIE_LOGO_BASE}/sparta-rotterdam.football-logos.cc.png`,
  Telstar: `${EREDIVISIE_LOGO_BASE}/telstar.football-logos.cc.png`,
  Twente: `${EREDIVISIE_LOGO_BASE}/twente.football-logos.cc.png`,
  Volendam: `${EREDIVISIE_LOGO_BASE}/volendam.football-logos.cc.png`,
  Anderlecht: `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/anderlecht.football-logos.cc.png`,
  Antwerp: `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/antwerp.football-logos.cc.png`,
  "Cercle Brugge": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/cercle-brugge.football-logos.cc.png`,
  Charleroi: `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/charleroi.football-logos.cc.png`,
  "Club Brugge": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/club-brugge.football-logos.cc.png`,
  "FCV Dender EH": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/fcv-dender-eh.football-logos.cc.png`,
  Genk: `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/genk.football-logos.cc.png`,
  Gent: `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/gent.football-logos.cc.png`,
  Mechelen: `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/mechelen.football-logos.cc.png`,
  "Oud-Heverlee Leuven": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/oud-heverlee-leuven.football-logos.cc.png`,
  "RAAL La Louvière": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/raal-la-louviere.football-logos.cc.png`,
  "Sint-Truidense": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/sint-truidense.football-logos.cc.png`,
  "Standard Liège": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/standard-liege.football-logos.cc.png`,
  "Union Saint-Gilloise": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/union-saint-gilloise.football-logos.cc.png`,
  Westerlo: `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/westerlo.football-logos.cc.png`,
  "Zulte Waregem": `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/zulte-waregem.football-logos.cc.png`,
};

export function getTeamLogoUrl(team: Pick<TeamData, "name" | "country" | "domestic_tier">): string | null {
  if (!["England", "ENG", "Spain", "ES", "Italy", "IT", "France", "FR", "Germany", "DE", "Portugal", "PT", "Netherlands", "NL", "Belgium", "BE"].includes(team.country)) return null;

  const mappedLogo = LOGO_SLUGS_BY_TEAM[team.name];
  if (mappedLogo) return mappedLogo;

  if (team.country === "Spain" || team.country === "ES") {
    const slug = slugifyTeamName(team.name);
    const base = team.domestic_tier === 2 ? LA_LIGA_2_LOGO_BASE : LA_LIGA_LOGO_BASE;
    return `${base}/${slug}.football-logos.cc.png`;
  }

  if (team.country === "Italy" || team.country === "IT") {
    const slug = slugifyTeamName(team.name);
    const base = team.domestic_tier === 2 ? SERIE_B_LOGO_BASE : SERIE_A_LOGO_BASE;
    return `${base}/${slug}.football-logos.cc.png`;
  }

  if (team.country === "France" || team.country === "FR") {
    const slug = slugifyTeamName(team.name);
    const base = team.domestic_tier === 2 ? LIGUE_2_LOGO_BASE : LIGUE_1_LOGO_BASE;
    return `${base}/${slug}.football-logos.cc.png`;
  }

  if (team.country === "Germany" || team.country === "DE") {
    const slug = slugifyTeamName(team.name);
    const base = team.domestic_tier === 2 ? BUNDESLIGA_2_LOGO_BASE : BUNDESLIGA_LOGO_BASE;
    return `${base}/${slug}.football-logos.cc.png`;
  }

  if (team.country === "Portugal" || team.country === "PT") {
    const slug = slugifyTeamName(team.name);
    return `${PRIMEIRA_LIGA_LOGO_BASE}/${slug}.football-logos.cc.png`;
  }

  if (team.country === "Netherlands" || team.country === "NL") {
    const slug = slugifyTeamName(team.name);
    return `${EREDIVISIE_LOGO_BASE}/${slug}.football-logos.cc.png`;
  }

  if (team.country === "Belgium" || team.country === "BE") {
    const slug = slugifyTeamName(team.name);
    return `${BELGIAN_PRO_LEAGUE_LOGO_BASE}/${slug}.football-logos.cc.png`;
  }

  return null;
}

function slugifyTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
