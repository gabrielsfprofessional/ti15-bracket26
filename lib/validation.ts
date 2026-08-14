import { TEAMS } from "@/data/teams";
import { winsNeeded } from "./series";
import type { Series, TeamId, Tournament } from "./types";

export interface TournamentValidation {
  valid: boolean;
  errors: string[];
}

type ValidationBaseline = Tournament | number;

const SECTIONS = new Set(["swiss", "elimination", "upper", "lower", "grand_final"]);
const STATUSES = new Set(["tbd", "scheduled", "live", "unconfirmed", "completed"]);
const SOURCES = new Set(["override", "live", "opendota", "schedule", "tbd"]);
const SYNC_STATES = new Set(["ok", "degraded", "manual"]);
const SLOT_KINDS = new Set(["team", "winner_of", "loser_of", "tbd"]);
const SWISS_STATES = new Set(["active", "advanced", "elimination_round", "eliminated"]);
const SOURCE_STATUSES = new Set(["ok", "error", "managed"]);
const SERVED_MODES = new Set(["live", "degraded", "manual"]);
const BEST_OFS = new Set([1, 3, 5]);
const EXPECTED_TEAM_IDS = new Set(TEAMS.map((team) => team.id));
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** A typed error lets fallback logging report safe, structured reasons. */
export class TournamentValidationError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super("Tournament payload failed validation");
    this.name = "TournamentValidationError";
    this.reasons = reasons;
  }
}

/**
 * The last line of defence between an upstream anomaly and the public site.
 * Results are append-only, so both series and completed game history must never
 * regress relative to the committed last-known-good snapshot.
 */
export function validateTournament(
  candidate: Tournament,
  baseline: ValidationBaseline = 0,
): TournamentValidation {
  const errors: string[] = [];
  const add = (code: string, detail: string) => errors.push(`${code}: ${detail}`);
  const baselineSeriesCount = typeof baseline === "number" ? baseline : baseline.series.length;
  const baselineTournament = typeof baseline === "number" ? null : baseline;

  if (candidate.leagueId !== 19719) add("league_id", `expected 19719, received ${candidate.leagueId}`);
  if (!SYNC_STATES.has(candidate.syncState)) add("sync_state", `invalid value ${String(candidate.syncState)}`);
  if (!isUtcIso(candidate.lastSyncUtc)) add("timestamp", `lastSyncUtc is not UTC ISO 8601`);
  validateSourceHealth(candidate, add);

  const teamIds = candidate.teams.map((team) => team.id);
  const uniqueTeamIds = new Set(teamIds);
  if (candidate.teams.length !== 16 || uniqueTeamIds.size !== 16) {
    add(
      "team_count",
      `expected exactly 16 unique teams, received ${candidate.teams.length} rows and ${uniqueTeamIds.size} ids`,
    );
  }
  const missingTeamIds = [...EXPECTED_TEAM_IDS].filter((id) => !uniqueTeamIds.has(id));
  const unexpectedTeamIds = [...uniqueTeamIds].filter((id) => !EXPECTED_TEAM_IDS.has(id));
  if (missingTeamIds.length || unexpectedTeamIds.length) {
    add(
      "team_ids",
      `missing [${missingTeamIds.join(",")}] unexpected [${unexpectedTeamIds.join(",")}]`,
    );
  }

  if (candidate.series.length < baselineSeriesCount) {
    add("series_regression", `count fell from ${baselineSeriesCount} to ${candidate.series.length}`);
  }

  const seriesIds = new Set<string>();
  const completedGameOwners = new Map<number, string>();
  const candidateById = new Map<string, Series>();

  for (const item of candidate.series) {
    candidateById.set(item.id, item);
    if (seriesIds.has(item.id)) add("duplicate_series_id", item.id);
    seriesIds.add(item.id);

    if (!SECTIONS.has(item.section)) add("series_section", `${item.id} has ${String(item.section)}`);
    if (!STATUSES.has(item.status)) add("series_status", `${item.id} has ${String(item.status)}`);
    if (!SOURCES.has(item.source)) add("series_source", `${item.id} has ${String(item.source)}`);
    if (!BEST_OFS.has(item.bestOf)) add("best_of", `${item.id} has ${String(item.bestOf)}`);
    if (!Number.isInteger(item.round) || item.round < 0) add("round", `${item.id} has ${String(item.round)}`);
    if (!isUtcIso(item.updatedUtc)) add("timestamp", `${item.id}.updatedUtc is not UTC ISO 8601`);
    if (item.startUtc !== null && !isUtcIso(item.startUtc)) {
      add("timestamp", `${item.id}.startUtc is not UTC ISO 8601`);
    }

    for (const [side, slot] of [["a", item.a], ["b", item.b]] as const) {
      if (!SLOT_KINDS.has(slot.kind)) add("slot_kind", `${item.id}.${side} has ${String(slot.kind)}`);
      if (slot.kind === "team") {
        if (slot.teamId == null || !uniqueTeamIds.has(slot.teamId)) {
          add("unknown_team", `${item.id}.${side} has ${String(slot.teamId)}`);
        }
      }
    }

    validateScore(item, add);

    if (item.status === "completed") {
      for (const gameId of item.gameIds) {
        if (!Number.isSafeInteger(gameId) || gameId <= 0) {
          add("game_id", `${item.id} has invalid game id ${String(gameId)}`);
          continue;
        }
        const owner = completedGameOwners.get(gameId);
        if (owner) add("duplicate_game_id", `${gameId} appears in ${owner} and ${item.id}`);
        else completedGameOwners.set(gameId, item.id);
      }
    }
  }

  validateSwiss(candidate, uniqueTeamIds, add);
  validateCompletedHistory(baselineTournament, candidateById, add);

  return { valid: errors.length === 0, errors };
}

function validateScore(item: Series, add: (code: string, detail: string) => void): void {
  const validScore = (score: number) => Number.isInteger(score) && score >= 0;
  if (!validScore(item.scoreA) || !validScore(item.scoreB) || !BEST_OFS.has(item.bestOf)) {
    add("score", `${item.id} has invalid ${String(item.scoreA)}-${String(item.scoreB)}`);
    return;
  }

  const need = winsNeeded(item.bestOf);
  if (item.scoreA > need || item.scoreB > need || (item.scoreA === need && item.scoreB === need)) {
    add("score", `${item.id} has impossible Bo${item.bestOf} score ${item.scoreA}-${item.scoreB}`);
  }

  const teamA = item.a.kind === "team" ? item.a.teamId : undefined;
  const teamB = item.b.kind === "team" ? item.b.teamId : undefined;
  if (item.winnerId !== null && item.winnerId !== teamA && item.winnerId !== teamB) {
    add("winner", `${item.id} winner ${item.winnerId} is not a participant`);
  }

  if (item.status === "completed") {
    if (item.winnerId == null || teamA == null || teamB == null) {
      add("completed_winner", `${item.id} has no valid concrete winner`);
      return;
    }
    const winningScore = item.winnerId === teamA ? item.scoreA : item.scoreB;
    const losingScore = item.winnerId === teamA ? item.scoreB : item.scoreA;
    if (winningScore !== need || losingScore >= need) {
      add("completed_score", `${item.id} winner does not match ${item.scoreA}-${item.scoreB}`);
    }
  } else if (item.status === "scheduled" || item.status === "tbd") {
    if (item.winnerId !== null) add("future_winner", `${item.id} claims winner ${item.winnerId}`);
    if (item.scoreA !== 0 || item.scoreB !== 0) {
      add("future_score", `${item.id} claims score ${item.scoreA}-${item.scoreB}`);
    }
  } else {
    if (item.winnerId !== null) add("unfinished_winner", `${item.id} claims winner ${item.winnerId}`);
    if (item.scoreA >= need || item.scoreB >= need) {
      add("unfinished_score", `${item.id} has already reached the Bo${item.bestOf} threshold`);
    }
  }
}

function validateSwiss(
  candidate: Tournament,
  teamIds: Set<TeamId>,
  add: (code: string, detail: string) => void,
): void {
  const rowsByTeam = new Map<TeamId, (typeof candidate.swiss)[number]>();
  if (candidate.swiss.length !== 16) add("swiss_count", `expected 16 rows, received ${candidate.swiss.length}`);

  for (const row of candidate.swiss) {
    if (rowsByTeam.has(row.teamId)) add("swiss_duplicate", String(row.teamId));
    rowsByTeam.set(row.teamId, row);
    if (!teamIds.has(row.teamId)) add("swiss_team", `unknown team ${row.teamId}`);
    if (!Number.isInteger(row.wins) || row.wins < 0 || !Number.isInteger(row.losses) || row.losses < 0) {
      add("swiss_record", `${row.teamId} has ${row.wins}-${row.losses}`);
    }
    if (!SWISS_STATES.has(row.state)) add("swiss_state", `${row.teamId} has ${String(row.state)}`);
    if (row.provisional !== undefined && typeof row.provisional !== "boolean") {
      add("swiss_provisional", `${row.teamId} has ${String(row.provisional)}`);
    }
  }

  const recomputed = new Map<TeamId, { wins: number; losses: number }>();
  for (const id of teamIds) recomputed.set(id, { wins: 0, losses: 0 });

  for (const item of candidate.series) {
    if (item.section !== "swiss" || item.status !== "completed" || item.winnerId == null) continue;
    if (item.a.kind !== "team" || item.b.kind !== "team") continue;
    if (item.a.teamId == null || item.b.teamId == null) continue;
    const loserId = item.winnerId === item.a.teamId ? item.b.teamId : item.a.teamId;
    const winner = recomputed.get(item.winnerId);
    const loser = recomputed.get(loserId);
    if (winner) winner.wins++;
    if (loser) loser.losses++;
  }

  for (const [teamId, record] of recomputed) {
    const row = rowsByTeam.get(teamId);
    if (!row) {
      add("swiss_missing", String(teamId));
      continue;
    }
    if (row.wins !== record.wins || row.losses !== record.losses) {
      add(
        "swiss_mismatch",
        `${teamId} stores ${row.wins}-${row.losses}, recomputed ${record.wins}-${record.losses}`,
      );
    }
  }
}

function validateSourceHealth(
  candidate: Tournament,
  add: (code: string, detail: string) => void,
): void {
  const health = (candidate as Partial<Tournament>).sourceHealth;
  if (!health || typeof health !== "object") {
    add("source_health", "metadata is missing");
    return;
  }

  for (const key of ["matches", "live", "schedule"] as const) {
    const observation = health[key];
    if (!observation || !SOURCE_STATUSES.has(observation.status)) {
      add("source_health", `${key} has invalid status ${String(observation?.status)}`);
    }
    if (!observation || !isUtcIso(observation.observedUtc)) {
      add("timestamp", `sourceHealth.${key}.observedUtc is not UTC ISO 8601`);
    }
  }

  if (!SERVED_MODES.has(health.mode)) add("served_mode", `invalid value ${String(health.mode)}`);
  if (health.snapshotGeneratedUtc === null || !isUtcIso(health.snapshotGeneratedUtc)) {
    add("timestamp", "sourceHealth.snapshotGeneratedUtc is not UTC ISO 8601");
  }

  const expectedMode =
    candidate.syncState === "manual" ? "manual" : candidate.syncState === "degraded" ? "degraded" : "live";
  if (health.mode !== expectedMode) {
    add("served_mode", `${health.mode} does not match syncState ${candidate.syncState}`);
  }
}

function validateCompletedHistory(
  baseline: Tournament | null,
  candidateById: Map<string, Series>,
  add: (code: string, detail: string) => void,
): void {
  if (!baseline) return;
  const previousCompleted = baseline.series.filter((item) => item.status === "completed");
  let candidateCompleted = 0;
  for (const item of candidateById.values()) if (item.status === "completed") candidateCompleted++;
  if (candidateCompleted < previousCompleted.length) {
    add("completed_regression", `count fell from ${previousCompleted.length} to ${candidateCompleted}`);
  }

  for (const previous of previousCompleted) {
    const current = candidateById.get(previous.id);
    if (!current || current.status !== "completed") {
      add("completed_regression", `${previous.id} is no longer completed`);
      continue;
    }
    const currentGames = new Set(current.gameIds);
    for (const gameId of previous.gameIds) {
      if (!currentGames.has(gameId)) {
        add("completed_game_regression", `${previous.id} lost game ${gameId}`);
      }
    }
  }
}

function isUtcIso(value: unknown): value is string {
  if (typeof value !== "string" || !UTC_ISO.test(value)) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const canonical = new Date(parsed).toISOString();
  return value === canonical || value === canonical.replace(".000Z", "Z");
}

export function assertTournamentValid(
  candidate: Tournament,
  baseline: ValidationBaseline = 0,
): void {
  const result = validateTournament(candidate, baseline);
  if (!result.valid) throw new TournamentValidationError(result.errors);
}

/** The observation timestamp is metadata, not a tournament-state change. */
export function tournamentDataChanged(candidate: Tournament, committed: Tournament): boolean {
  const stable = (tournament: Tournament) => ({
    ...tournament,
    lastSyncUtc: "",
    sourceHealth: tournament.sourceHealth
      ? {
          ...tournament.sourceHealth,
          matches: { ...tournament.sourceHealth.matches, observedUtc: "" },
          live: { ...tournament.sourceHealth.live, observedUtc: "" },
          schedule: { ...tournament.sourceHealth.schedule, observedUtc: "" },
          snapshotGeneratedUtc: null,
        }
      : undefined,
  });
  const candidateData = stable(candidate);
  const committedData = stable(committed);
  return JSON.stringify(candidateData) !== JSON.stringify(committedData);
}
