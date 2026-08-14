// ---------------------------------------------------------------------------
// Public data model. Implemented exactly as specified in the brief.
// ---------------------------------------------------------------------------

export type TeamId = number; // OpenDota team_id
/**
 * "unconfirmed" is the C.2 status: games have been played and no side has hit the
 * win threshold, but nothing corroborates that the series is still running right
 * now. It is deliberately NOT "live" — a Bo3 sitting at 1-1 because OpenDota
 * never reported game 3 would otherwise read LIVE forever on the loudest element
 * of the page. It renders with its real score and no badge.
 */
export type Status = "tbd" | "scheduled" | "live" | "unconfirmed" | "completed";
export type Section = "swiss" | "elimination" | "upper" | "lower" | "grand_final";
export type Source = "override" | "live" | "opendota" | "schedule" | "tbd";

export interface Team {
  id: TeamId;
  name: string;
  short: string;
  logo: string;
}

export interface SlotRef {
  kind: "team" | "winner_of" | "loser_of" | "tbd";
  teamId?: TeamId;
  matchId?: string;
  label?: string;
}

export interface GameSummary {
  matchId: number;
  gameNumber: number;
  radiantTeamId: TeamId;
  direTeamId: TeamId;
  winnerId: TeamId;
  startUtc: string;
  durationSeconds: number;
  radiantKills: number;
  direKills: number;
  openDotaUrl: string;
}

export interface LiveGameSummary {
  gameNumber: number;
  radiantTeamId: TeamId;
  direTeamId: TeamId;
  radiantKills: number;
  direKills: number;
  gameTimeSeconds: number;
  observedUtc: string;
}

export interface Series {
  id: string;
  seriesId?: number;
  section: Section;
  round: number;
  roundLabel: string;
  bestOf: 1 | 3 | 5;
  a: SlotRef;
  b: SlotRef;
  scoreA: number;
  scoreB: number;
  status: Status;
  startUtc: string | null;
  winnerId: TeamId | null;
  gameIds: number[];
  /** Additive detail; legacy snapshots may omit it. */
  games?: GameSummary[];
  liveGame?: LiveGameSummary;
  streamUrl?: string;
  source: Source;
  updatedUtc: string;
  /**
   * The data/schedule.json row this series was matched to, stamped by the merge
   * layer. Once stamped, that row is dropped by id rather than by re-running a
   * fuzzy time comparison — see mergeSchedule (C.3).
   */
  scheduleId?: string;
}

export interface SwissRow {
  teamId: TeamId;
  wins: number;
  losses: number;
  state: "active" | "advanced" | "elimination_round" | "eliminated";
  /**
   * True when `state` was DERIVED from the W-L sort rather than set by hand.
   *
   * The official Swiss ranking breaks ties on opponent strength (Buchholz) and
   * then game win %, neither of which this site computes. So a derived fate near
   * the 3/10/3 boundary can be wrong, and the UI must show it at reduced
   * emphasis. A fate set in overrides.json is authoritative and clears this.
   */
  provisional?: boolean;
}

export type SourceStatus = "ok" | "error" | "managed";
export type ServedMode = "live" | "degraded" | "manual";

export interface SourceObservation {
  status: SourceStatus;
  observedUtc: string;
}

export interface SourceHealth {
  matches: SourceObservation;
  live: SourceObservation;
  schedule: SourceObservation;
  /** When the currently available last-known-good snapshot was generated. */
  snapshotGeneratedUtc: string | null;
  /** What the visitor is receiving now, independent of individual source status. */
  mode: ServedMode;
}

export interface Tournament {
  leagueId: 19719;
  teams: Team[];
  swiss: SwissRow[];
  series: Series[];
  championId: TeamId | null;
  lastSyncUtc: string;
  syncState: "ok" | "degraded" | "manual";
  sourceHealth: SourceHealth;
}

// ---------------------------------------------------------------------------
// Raw OpenDota shapes. Field-for-field what the API actually returns — verified
// against the live endpoints in Phase 0. Note the nulls and the string/number
// mismatch on match_id between the two endpoints; both are load-bearing.
// ---------------------------------------------------------------------------

/** GET /api/leagues/{id}/matches — one element is one GAME, not one series. */
export interface RawMatch {
  match_id: number;
  radiant_win: boolean;
  start_time: number; // unix seconds
  duration: number; // seconds
  leagueid: number;
  radiant_score: number; // kills
  dire_score: number; // kills
  radiant_team_id: TeamId;
  radiant_team_name: string | null; // ALWAYS null — never read this
  dire_team_id: TeamId;
  dire_team_name: string | null; // ALWAYS null — never read this
  series_id: number;
  series_type: number; // 0 = Bo1, 1 = Bo3, 2 = Bo5
}

/** GET /api/live — filtered to our league. Scores here are KILL COUNTS. */
export interface RawLive {
  league_id: number;
  match_id: string; // string here, number on /matches
  series_id: number;
  game_time: number;
  activate_time: number;
  deactivate_time: number;
  last_update_time: number;
  spectators: number;
  team_id_radiant: TeamId;
  team_id_dire: TeamId;
  team_name_radiant: string | null;
  team_name_dire: string | null;
  radiant_score: number; // KILLS — never a series score
  dire_score: number; // KILLS — never a series score
}

/** GET /api/leagues/{id}/teams — carries name, tag and logo_url for all 16. */
export interface RawLeagueTeam {
  team_id: TeamId;
  name: string;
  tag: string;
  logo_url: string | null;
  wins: number;
  losses: number;
}

// ---------------------------------------------------------------------------
// Hand-maintained input files.
// ---------------------------------------------------------------------------

/** One hand-entered upcoming match in data/schedule.json. */
export interface ScheduleEntry {
  id: string;
  section: Section;
  round: number;
  roundLabel: string;
  bestOf: 1 | 3 | 5;
  /** Omit or null when the matchup is not known yet — renders as TBD. */
  aTeamId?: TeamId | null;
  bTeamId?: TeamId | null;
  aLabel?: string;
  bLabel?: string;
  /** UTC ISO 8601. Never a local time. */
  startUtc: string | null;
}

export interface ScheduleFile {
  streamUrl?: string;
  matches: ScheduleEntry[];
}

/** data/overrides.json — beats every other source. See the file's own _readme. */
export interface OverridesFile {
  syncState?: Tournament["syncState"] | null;
  streamUrl?: string | null;
  championId?: TeamId | null;
  /** Keyed by Series.id. Any subset of Series fields; merged over the computed one. */
  series?: Record<string, Partial<Series>>;
  /** Keyed by TeamId as a string. Any subset of SwissRow fields. */
  swiss?: Record<string, Partial<SwissRow>>;
  /** Series ids to drop from the site entirely (bad data, remade series). */
  hide?: string[];
}
