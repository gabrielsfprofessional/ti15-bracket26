import overridesFile from "@/data/overrides.json";
import scheduleFile from "@/data/schedule.json";
import { TEAMS } from "@/data/teams";
import { resolve } from "./resolve";
import { bestOfFor, toSeries, unixToIso } from "./series";
import type {
  OverridesFile,
  RawLive,
  RawMatch,
  ScheduleFile,
  Series,
  SwissRow,
  TeamId,
  Tournament,
} from "./types";

export const TI_LEAGUE_ID = 19719 as const;
const BASE = "https://api.opendota.com";

/** A real, identifying User-Agent, as a good citizen of a free keyless API. */
const USER_AGENT =
  "TI15-Bracket/1.0 (+https://github.com/gabrielsfprofessional/ti15-bracket; gabrielsfprofessional@gmail.com)";

const DEFAULT_STREAM_URL = "https://www.twitch.tv/dota2ti";

/**
 * How many Swiss rounds the group stage runs. Valve has not published this and
 * it is not derivable from the API, so team fate is deliberately left as
 * "active" until it is known. Set this number and every team's advanced /
 * elimination_round / eliminated state falls out of the final standings.
 * Until then, overrides.json.swiss is the way to mark a team's fate.
 */
const SWISS_ROUNDS: number | null = null;

const overrides = overridesFile as unknown as OverridesFile;
const schedule = scheduleFile as unknown as ScheduleFile;

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

async function getJson<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Ignored outside Next (scripts/sync.ts runs this under plain node).
    next: { revalidate },
  } as RequestInit);

  if (!res.ok) throw new Error(`OpenDota ${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Every played GAME of the league. One request. */
export function fetchLeagueMatches(): Promise<RawMatch[]> {
  return getJson<RawMatch[]>(`/api/leagues/${TI_LEAGUE_ID}/matches`, 60);
}

/** In-progress games across all of Dota, filtered down to this league. */
export async function fetchLive(): Promise<RawLive[]> {
  // Short cache: this is the only genuinely volatile endpoint.
  const all = await getJson<RawLive[]>("/api/live", 30);
  return all.filter((g) => g.league_id === TI_LEAGUE_ID);
}

/**
 * Two requests per sync. The league/teams endpoint is deliberately NOT called at
 * runtime — it already told us everything we need once, and those 16 names, tags
 * and logos are baked into data/teams.ts and public/logos/.
 */
export async function buildTournament(nowMs: number): Promise<Tournament> {
  const [matchesResult, liveResult] = await Promise.allSettled([fetchLeagueMatches(), fetchLive()]);

  const matches = matchesResult.status === "fulfilled" ? matchesResult.value : [];
  const live = liveResult.status === "fulfilled" ? liveResult.value : [];

  // Losing the matches feed is degraded; losing only the live feed is too, but
  // the page is still broadly correct, so both are reported the same way.
  const degraded = matchesResult.status === "rejected" || liveResult.status === "rejected";

  return assembleTournament({ matches, live, nowMs, degraded });
}

// ---------------------------------------------------------------------------
// Assembly — PURE. Everything above this line does the I/O; everything below
// is a deterministic function of its inputs, which is what makes it testable.
// ---------------------------------------------------------------------------

export interface AssembleInput {
  matches: RawMatch[];
  live: RawLive[];
  nowMs: number;
  degraded?: boolean;
}

export function assembleTournament(input: AssembleInput): Tournament {
  const { matches, live, nowMs } = input;

  const played = toSeries(matches);
  const withLive = mergeLive(played, live);
  const withSchedule = mergeSchedule(withLive);
  const streamUrl = overrides.streamUrl ?? schedule.streamUrl ?? DEFAULT_STREAM_URL;

  let series: Series[] = withSchedule.map((s) => ({ ...s, streamUrl: s.streamUrl ?? streamUrl }));
  series = applySeriesOverrides(series);
  series = series.sort(bySeriesOrder);

  const swiss = applySwissOverrides(computeSwiss(series));

  const tournament: Tournament = {
    leagueId: TI_LEAGUE_ID,
    teams: TEAMS,
    swiss,
    series,
    championId: overrides.championId ?? null,
    lastSyncUtc: new Date(nowMs).toISOString(),
    syncState: overrides.syncState ?? (input.degraded ? "degraded" : "ok"),
  };

  return resolve(tournament);
}

/**
 * Fold the live feed in.
 *
 * Two things matter here:
 *  1. The live feed's radiant_score / dire_score are KILL COUNTS. They are read
 *     for nothing. Every series score on this site comes from completed games.
 *  2. The live feed lags on removal — a finished game keeps showing up with
 *     deactivate_time 0 after /matches has already recorded it as complete.
 *     A live game whose match_id is already a completed game is dropped, or the
 *     site invents a phantom extra game of a series that is already over.
 */
function mergeLive(series: Series[], live: RawLive[]): Series[] {
  const completedGameIds = new Set<string>();
  for (const s of series) for (const id of s.gameIds) completedGameIds.add(String(id));

  const stillLive = live.filter((g) => !completedGameIds.has(String(g.match_id)));
  if (stillLive.length === 0) return series;

  const out = series.map((s) => ({ ...s }));
  const byKey = new Map(out.map((s) => [s.id, s]));

  for (const g of stillLive) {
    const key = g.series_id ? `s-${g.series_id}` : `g-${g.match_id}`;
    const existing = byKey.get(key);

    if (existing) {
      // Live outranks completed in the source precedence: a genuinely new game
      // in a series means that series is not actually over.
      existing.status = "live";
      existing.source = "live";
      existing.winnerId = null;
      continue;
    }

    // A series we have never seen a completed game for: game 1 is in progress.
    const fresh: Series = {
      id: key,
      seriesId: g.series_id || undefined,
      section: "swiss",
      round: 0,
      roundLabel: "Group Stage",
      bestOf: bestOfFor(1),
      a: { kind: "team", teamId: g.team_id_radiant },
      b: { kind: "team", teamId: g.team_id_dire },
      scoreA: 0,
      scoreB: 0,
      status: "live",
      startUtc: unixToIso(g.activate_time),
      winnerId: null,
      gameIds: [],
      source: "live",
      updatedUtc: unixToIso(g.last_update_time),
    };
    out.push(fresh);
    byKey.set(key, fresh);
  }

  return out;
}

/**
 * Add hand-entered upcoming matches. A scheduled row is dropped once its match
 * has actually been played — matched by the same two teams starting within 12
 * hours of the entered time — so stale rows do not linger next to real results.
 */
function mergeSchedule(series: Series[], windowHours = 12): Series[] {
  const existingIds = new Set(series.map((s) => s.id));
  const out = [...series];

  for (const entry of schedule.matches ?? []) {
    if (existingIds.has(entry.id)) continue;
    if (entry.aTeamId != null && entry.bTeamId != null && entry.startUtc) {
      if (alreadyPlayed(series, entry.aTeamId, entry.bTeamId, entry.startUtc, windowHours)) continue;
    }

    out.push({
      id: entry.id,
      section: entry.section,
      round: entry.round,
      roundLabel: entry.roundLabel,
      bestOf: entry.bestOf,
      a: slotFromSchedule(entry.aTeamId, entry.aLabel),
      b: slotFromSchedule(entry.bTeamId, entry.bLabel),
      scoreA: 0,
      scoreB: 0,
      status: entry.aTeamId != null && entry.bTeamId != null ? "scheduled" : "tbd",
      startUtc: entry.startUtc,
      winnerId: null,
      gameIds: [],
      source: entry.aTeamId != null && entry.bTeamId != null ? "schedule" : "tbd",
      updatedUtc: entry.startUtc ?? new Date(0).toISOString(),
    });
  }

  return out;
}

function slotFromSchedule(teamId: TeamId | null | undefined, label?: string) {
  if (teamId != null) return { kind: "team" as const, teamId };
  return { kind: "tbd" as const, label: label ?? "TBD" };
}

function alreadyPlayed(
  series: Series[],
  aId: TeamId,
  bId: TeamId,
  startUtc: string,
  windowHours: number,
): boolean {
  const target = Date.parse(startUtc);
  if (Number.isNaN(target)) return false;
  const windowMs = windowHours * 3600_000;

  return series.some((s) => {
    if (s.source !== "opendota" && s.source !== "live") return false;
    if (!s.startUtc) return false;
    const ids = [s.a.teamId, s.b.teamId];
    if (!ids.includes(aId) || !ids.includes(bId)) return false;
    return Math.abs(Date.parse(s.startUtc) - target) <= windowMs;
  });
}

/** overrides.json wins over everything, including hiding a series outright. */
function applySeriesOverrides(series: Series[]): Series[] {
  const hidden = new Set(overrides.hide ?? []);
  const patches = overrides.series ?? {};

  const out: Series[] = [];
  for (const s of series) {
    if (hidden.has(s.id)) continue;
    const patch = patches[s.id];
    out.push(patch ? { ...s, ...patch, source: "override" } : s);
  }

  // An override may describe a series that does not exist yet at all.
  for (const [id, patch] of Object.entries(patches)) {
    if (hidden.has(id) || out.some((s) => s.id === id)) continue;
    out.push({
      id,
      section: "swiss",
      round: 0,
      roundLabel: "Group Stage",
      bestOf: 3,
      a: { kind: "tbd", label: "TBD" },
      b: { kind: "tbd", label: "TBD" },
      scoreA: 0,
      scoreB: 0,
      status: "tbd",
      startUtc: null,
      winnerId: null,
      gameIds: [],
      updatedUtc: new Date(0).toISOString(),
      ...patch,
      source: "override",
    });
  }

  return out;
}

function bySeriesOrder(x: Series, y: Series): number {
  const xs = x.startUtc ?? "9999";
  const ys = y.startUtc ?? "9999";
  if (xs !== ys) return xs < ys ? -1 : 1;
  return x.id.localeCompare(y.id);
}

// ---------------------------------------------------------------------------
// Swiss standings
// ---------------------------------------------------------------------------

/**
 * W-L from completed group-stage series only. An in-progress series contributes
 * nothing until it is decided — a half-played Bo3 is not a win.
 */
export function computeSwiss(series: Series[]): SwissRow[] {
  const rows = new Map<TeamId, SwissRow>();
  for (const t of TEAMS) {
    rows.set(t.id, { teamId: t.id, wins: 0, losses: 0, state: "active" });
  }

  let completedCount = 0;
  for (const s of series) {
    if (s.section !== "swiss") continue;
    if (s.status !== "completed" || s.winnerId == null) continue;
    if (s.a.kind !== "team" || s.b.kind !== "team") continue;
    if (s.a.teamId == null || s.b.teamId == null) continue;

    const loserId = s.a.teamId === s.winnerId ? s.b.teamId : s.a.teamId;
    const winner = rows.get(s.winnerId);
    const loser = rows.get(loserId);
    if (winner) winner.wins++;
    if (loser) loser.losses++;
    completedCount++;
  }

  const sorted = [...rows.values()].sort(
    (x, y) =>
      y.wins - x.wins ||
      x.losses - y.losses ||
      nameOf(x.teamId).localeCompare(nameOf(y.teamId)),
  );

  // Fate is only assigned once the group stage is actually over. Guessing it
  // mid-stage would paint teams as eliminated while they are still alive.
  if (SWISS_ROUNDS != null && completedCount > 0) {
    const finished = sorted.every((r) => r.wins + r.losses >= SWISS_ROUNDS);
    if (finished) {
      sorted.forEach((row, i) => {
        row.state = i < 3 ? "advanced" : i < 13 ? "elimination_round" : "eliminated";
      });
    }
  }

  return sorted;
}

function nameOf(id: TeamId): string {
  return TEAMS.find((t) => t.id === id)?.name ?? String(id);
}

function applySwissOverrides(rows: SwissRow[]): SwissRow[] {
  const patches = overrides.swiss ?? {};
  if (Object.keys(patches).length === 0) return rows;
  return rows.map((r) => {
    const patch = patches[String(r.teamId)];
    return patch ? { ...r, ...patch } : r;
  });
}
