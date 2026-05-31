export interface TeamColors {
  primary: string;
  secondary: string;
}

export interface FacilitiesData {
  training: number;
  medical: number;
  scouting: number;
}

export interface SponsorshipData {
  sponsor_name: string;
  base_value: number;
  remaining_weeks: number;
  bonus_criteria: unknown[];
}

export type TransactionKind =
  | "PrizeMoney"
  | "ContractTermination"
  | "BoardSupport"
  | "CommercialCampaign";

export interface FinancialTransactionData {
  date: string;
  description: string;
  amount: number;
  kind: TransactionKind;
}

export interface TeamSeasonRecord {
  season: number;
  league_position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
}

export interface TeamMatchRolesData {
  captain: string | null;
  vice_captain: string | null;
  penalty_taker: string | null;
  free_kick_taker: string | null;
  corner_taker: string | null;
}

export interface TacticPresetData {
  id: string;
  name: string;
  formation: string;
  slots: CustomTacticSlotData[];
}

export interface CustomTacticSlotData {
  slot_id: string;
  player_id: string | null;
  role: "GK" | "DEF" | "DM" | "MID" | "AM" | "FWD";
  x: number;
  y: number;
  tactical_role?: string | null;
  duty?: string | null;
}

export interface TeamData {
  id: string;
  name: string;
  short_name: string;
  country: string;
  domestic_tier?: number | null;
  city: string;
  stadium_name: string;
  stadium_capacity: number;
  finance: number;
  manager_id: string | null;
  reputation: number;
  wage_budget: number;
  transfer_budget: number;
  season_income: number;
  season_expenses: number;
  financial_ledger?: FinancialTransactionData[];
  formation: string;
  play_style: string;
  custom_tactic_slots?: CustomTacticSlotData[];
  saved_tactic_presets?: TacticPresetData[];
  training_focus: string;
  training_intensity: string;
  training_schedule: string;
  founded_year: number;
  colors: TeamColors;
  facilities?: FacilitiesData;
  sponsorship?: SponsorshipData | null;
  starting_xi_ids: string[];
  match_roles?: TeamMatchRolesData;
  form: string[];
  history: TeamSeasonRecord[];
}

export interface PlayerSeasonStats {
  appearances: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  yellow_cards: number;
  red_cards: number;
  avg_rating: number;
  minutes_played: number;
  shots?: number;
  shots_on_target?: number;
  passes_completed?: number;
  passes_attempted?: number;
  tackles_won?: number;
  interceptions?: number;
  fouls_committed?: number;
}

export interface CareerEntry {
  season: number;
  team_id: string;
  team_name: string;
  appearances: number;
  goals: number;
  assists: number;
  clean_sheets?: number;
  avg_rating?: number;
  yellow_cards?: number;
  red_cards?: number;
  minutes_played?: number;
  shots?: number;
  shots_on_target?: number;
  tackles_won?: number;
  interceptions?: number;
}

export interface ContractExitIntentData {
  kind: "let_expire";
  set_on: string;
  reason?: string | null;
}

export interface ContractRenewalStateData {
  status: "idle" | "open" | "agreed" | "blocked" | "stalled";
  manager_blocked_until?: string | null;
  last_attempt_date?: string | null;
  last_assistant_attempt_date?: string | null;
  last_outcome?: string | null;
  conversation_round: number;
  exit_intent?: ContractExitIntentData | null;
}

export interface PlayerMoraleCoreData {
  manager_trust: number;
  renewal_state?: ContractRenewalStateData | null;
}

export type PlayerSquadRole = "Senior" | "Youth";

export interface PlayerData {
  id: string;
  match_name: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  football_nation?: string;
  position: string;
  natural_position: string;
  alternate_positions: string[];
  footedness?: string;
  weak_foot?: number;
  training_focus: string | null;
  attributes: {
    pace: number;
    stamina: number;
    strength: number;
    agility: number;
    passing: number;
    shooting: number;
    tackling: number;
    dribbling: number;
    defending: number;
    positioning: number;
    vision: number;
    decisions: number;
    composure: number;
    aggression: number;
    teamwork: number;
    leadership: number;
    handling: number;
    reflexes: number;
    aerial: number;
  };
  condition: number;
  morale: number;
  injury: null | { name: string; days_remaining: number };
  team_id: string | null;
  squad_role?: PlayerSquadRole;
  contract_end: string | null;
  wage: number;
  market_value: number;
  stats: PlayerSeasonStats;
  career: CareerEntry[];
  transfer_listed: boolean;
  loan_listed: boolean;
  shortlisted?: boolean;
  loan_parent_team_id?: string | null;
  loan_until?: string | null;
  loan_wage_share_percent?: number | null;
  transfer_offers: TransferOfferData[];
  traits: string[];
  morale_core?: PlayerMoraleCoreData;
  /** Position-weighted overall rating (1–99). Computed by the backend from the player's natural position. */
  ovr?: number;
  /** Player's potential ceiling (1–99). Set at generation; higher than ovr for young players. */
  potential?: number;
}

export interface TransferOfferData {
  id: string;
  from_team_id: string;
  fee: number;
  wage_offered: number;
  kind?: "Permanent" | "Loan";
  contract_years?: number | null;
  loan_months?: number | null;
  wage_share_percent?: number | null;
  agreed_fee?: number | null;
  last_manager_fee: number | null;
  negotiation_round: number;
  suggested_counter_fee: number | null;
  status: "Pending" | "Accepted" | "Rejected" | "Withdrawn";
  date: string;
}

export interface StaffData {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  football_nation?: string;
  role: "AssistantManager" | "Coach" | "Scout" | "Physio";
  attributes: {
    coaching: number;
    judging_ability: number;
    judging_potential: number;
    physiotherapy: number;
  };
  team_id: string | null;
  specialization: string | null;
  wage: number;
  contract_end: string | null;
}

export interface MessageAction {
  id: string;
  label: string;
  action_type:
  | "Acknowledge"
  | "Dismiss"
  | { NavigateTo: { route: string } }
  | { ChooseOption: { options: MessageActionOption[] } };
  resolved: boolean;
  label_key?: string;
}

export interface MessageActionOption {
  id: string;
  label: string;
  description: string;
  label_key?: string;
  description_key?: string;
}

export interface ScoutReportData {
  player_id: string;
  player_name: string;
  position: string;
  nationality: string;
  dob: string;
  team_name: string | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  condition: number | null;
  morale: number | null;
  avg_rating: number | null;
  rating_key: string;
  potential_key: string;
  confidence_key: string;
}

export interface DelegatedRenewalCaseMessageData {
  player_id: string;
  player_name: string;
  status: string;
  agreed_wage?: number | null;
  agreed_years?: number | null;
  note_key?: string;
  note_params?: Record<string, string>;
}

export interface DelegatedRenewalReportMessageData {
  success_count: number;
  failure_count: number;
  stalled_count: number;
  cases: DelegatedRenewalCaseMessageData[];
}

export interface PlayerSelectionOptions {
  openRenewal?: boolean;
  openTermination?: boolean;
}

export interface MessageContext {
  team_id: string | null;
  player_id: string | null;
  fixture_id: string | null;
  youth_target_position?: string | null;
  youth_search_region?: string | null;
  youth_search_objective?: string | null;
  youth_prospects?: PlayerData[];
  match_result: null | {
    home_team_id: string;
    away_team_id: string;
    home_goals: number;
    away_goals: number;
  };
  scout_report?: ScoutReportData;
  delegated_renewal_report?: DelegatedRenewalReportMessageData;
}

export interface MessageData {
  id: string;
  subject: string;
  body: string;
  sender: string;
  sender_role: string;
  date: string;
  read: boolean;
  category: string;
  priority: string;
  actions: MessageAction[];
  context: MessageContext;
  subject_key?: string;
  body_key?: string;
  sender_key?: string;
  sender_role_key?: string;
  i18n_params?: Record<string, string>;
}

export interface ManagerCareerStats {
  matches_managed: number;
  wins: number;
  draws: number;
  losses: number;
  trophies: number;
  best_finish: number | null;
}

export interface ManagerCareerEntry {
  team_id: string;
  team_name: string;
  start_date: string;
  end_date: string | null;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  best_league_position: number | null;
}

export type FixtureCompetitionData =
  | "League"
  | "DomesticLeague"
  | "DomesticCup"
  | "ContinentalLeague"
  | "Friendly"
  | "PreseasonTournament";

export interface FixtureData {
  id: string;
  matchday: number;
  date: string;
  home_team_id: string;
  away_team_id: string;
  competition_id?: string | null;
  season?: number | null;
  competition: FixtureCompetitionData;
  status: "Scheduled" | "InProgress" | "Completed";
  result: null | {
    home_goals: number;
    away_goals: number;
    home_scorers: { player_id: string; minute: number }[];
    away_scorers: { player_id: string; minute: number }[];
    report?: CompactMatchReportData | null;
  };
}

export interface CompactMatchEventData {
  minute: number;
  event_type: string;
  side: "Home" | "Away";
  player_id: string | null;
  secondary_player_id: string | null;
}

export interface CompactTeamMatchStatsData {
  possession_pct: number;
  shots: number;
  shots_on_target: number;
  fouls: number;
  corners: number;
  yellow_cards: number;
  red_cards: number;
}

export interface CompactMatchReportData {
  total_minutes: number;
  home_stats: CompactTeamMatchStatsData;
  away_stats: CompactTeamMatchStatsData;
  events: CompactMatchEventData[];
}

export interface StandingData {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

export interface LeagueData {
  id: string;
  name: string;
  season: number;
  fixtures: FixtureData[];
  standings: StandingData[];
}

export type CompetitionKindData = "DomesticLeague" | "DomesticCup" | "ContinentalLeague" | "Friendly" | "PreseasonTournament";

export type CompetitionFormatData = "RoundRobin" | "GroupStageKnockout" | "Knockout";

export interface CompetitionData {
  id: string;
  name: string;
  season: number;
  kind: CompetitionKindData;
  format: CompetitionFormatData;
  country?: string | null;
  tier?: number | null;
  team_ids: string[];
  fixtures: FixtureData[];
  standings: StandingData[];
}

export type CompetitionLikeData = CompetitionData | LeagueData;

export type SeasonPhase = "Preseason" | "InSeason" | "PostSeason";

export type TransferWindowStatus = "Closed" | "Open" | "DeadlineDay";

export interface TransferWindowContextData {
  status: TransferWindowStatus;
  opens_on: string | null;
  closes_on: string | null;
  days_until_opens: number | null;
  days_remaining: number | null;
}

export interface SeasonContextData {
  phase: SeasonPhase;
  season_start: string | null;
  season_end: string | null;
  days_until_season_start: number | null;
  transfer_window: TransferWindowContextData;
}

export interface NewsMatchScore {
  home_team_id: string;
  away_team_id: string;
  home_goals: number;
  away_goals: number;
}

export interface NewsArticle {
  id: string;
  headline: string;
  body: string;
  source: string;
  date: string;
  category: string;
  team_ids: string[];
  player_ids: string[];
  match_score: NewsMatchScore | null;
  read: boolean;
  headline_key?: string;
  body_key?: string;
  source_key?: string;
  i18n_params?: Record<string, string>;
}

export interface BoardObjective {
  id: string;
  description: string;
  target: number;
  objective_type: string;
  met: boolean;
}

export interface ScoutingAssignment {
  id: string;
  scout_id: string;
  player_id: string;
  days_remaining: number;
}

export interface YouthScoutingAssignment {
  id: string;
  scout_id: string;
  region?: string;
  objective?: string;
  target_position?: string | null;
  days_remaining: number;
}

export interface GameStateData {
  clock: {
    current_date: string;
    start_date: string;
  };
  manager: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    nationality: string;
    football_nation?: string;
    reputation: number;
    satisfaction: number;
    fan_approval: number;
    team_id: string | null;
    career_stats: ManagerCareerStats;
    career_history: ManagerCareerEntry[];
  };
  teams: TeamData[];
  players: PlayerData[];
  staff: StaffData[];
  messages: MessageData[];
  news: NewsArticle[];
  league: LeagueData | null;
  competitions?: CompetitionData[];
  scouting_assignments: ScoutingAssignment[];
  youth_scouting_assignments?: YouthScoutingAssignment[];
  board_objectives: BoardObjective[];
  season_context?: SeasonContextData;
}

export function getCompetitionForTeam(gameState: GameStateData, teamId: string | null | undefined): CompetitionLikeData | null {
  const domesticCompetition = gameState.competitions?.find((competition) => {
    return competition.kind === "DomesticLeague" && !!teamId && competition.team_ids.includes(teamId);
  });

  return domesticCompetition ?? gameState.league ?? null;
}

export function getPrimaryCompetition(gameState: GameStateData): CompetitionLikeData | null {
  return getCompetitionForTeam(gameState, gameState.manager.team_id) ?? gameState.competitions?.[0] ?? null;
}

export function getCompetitionDisplayName(competition: CompetitionLikeData): string {
  if (!("kind" in competition)) {
    return competition.name;
  }

  if (competition.kind === "DomesticLeague" && competition.tier) {
    return `${competition.name} (Tier ${competition.tier})`;
  }

  if (competition.kind === "DomesticCup") {
    return `${competition.name} (Cup)`;
  }

  if (competition.kind === "ContinentalLeague") {
    return `${competition.name} (Continental)`;
  }

  return competition.name;
}
