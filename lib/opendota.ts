import overridesFile from "@/data/overrides.json";
import scheduleFile from "@/data/schedule.json";
import { TEAMS } from "@/data/teams";
import { resolve } from "./resolve";
import { bestOfFor, toSeries, unixToIso } from "./series";
import type {
  OverridesFile,
  RawLive,
  RawMatch,
  ScheduleEntry,
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
  "TI15-Bracket/1.0 (+https://github.com/gabrielsfprofessional/ti15-bracket26; gabrielsfprofessional@gmail.com)";

const DEFAULT_STREAM_URL = "https://www.twitch.tv/dota2ti";

/**
 * TI15 uses record thresholds: 4 wins advances, 4 losses eliminates, and teams
 * between those thresholds after five series enter the Elimination Round. A
 * 4-0 or 0-4 team stops after Round 4, so fate can never depend on all 16 teams
 * reaching five played series or on an unimplemented ranking tiebreak.
 */
const SWISS_FATE_THRESHOLD = 4;
const SWISS_MAX_ROUNDS = 5;

/**
 * C.7 — no single upstream request may hang the page.
 *
 * This is also the budget for the WHOLE call including the retry, not per
 * attempt. Vercel Hobby kills a function at 10s: 8s + 1s backoff + another 8s
 * would be 17s and would 504 the page, which is the exact failure this timeout
 * exists to prevent. Better to give up at 8s and let the degraded path render.
 */
const FETCH_BUDGET_MS = 8_000;
/** C.7 — exactly one retry, after this pause. Not a backoff ladder. */
const RETRY_BACKOFF_MS = 1_000;

/**
 * C.2 — how long after a series' last game ended it may still claim to be LIVE
 * without the live feed corroborating it.
 */
const LIVE_GRACE_MS = 2 * 3_600_000;

/**
 * C.3 — how far a played series may sit from its hand-entered slot and still be
 * considered the same match. Asymmetric on purpose: Dota broadcasts run late,
 * essentially never early.
 */
const SCHEDULE_EARLY_MS = 2 * 3_600_000;
const SCHEDULE_LATE_MS = 12 * 3_600_000;

const overrides = overridesFile as unknown as OverridesFile;
const schedule = scheduleFile as unknown as ScheduleFile;

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retry only what retrying can actually fix. A 429 or a 5xx is upstream weather;
 * a 4xx means we asked the wrong question and asking twice just burns quota
 * against a keyless rate limit.
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchOnce(url: string, revalidate: number, timeoutMs: number): Promise<Response> {
  // A hanging upstream must not turn into a 504 on our page. Without this the
  // request inherits the platform's much longer timeout and the whole render
  // blocks behind it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
      // Ignored outside Next (scripts/sync.ts runs this under plain node).
      next: { revalidate },
    } as RequestInit);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One bounded retry, 1s apart, and only for the failures a retry can fix.
 *
 * Bounded is the point: an unbounded retry loop against a rate-limited free API
 * turns a blip into a ban. A timeout is deliberately NOT retried — the second
 * attempt is overwhelmingly likely to time out too, and paying twice for that
 * is what pushes the request past the platform's function limit.
 */
async function getJson<T>(path: string, revalidate: number): Promise<T> {
  const url = `${BASE}${path}`;
  const deadline = Date.now() + FETCH_BUDGET_MS;
  let lastError = new Error(`OpenDota ${path} -> no attempt made`);

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(RETRY_BACKOFF_MS);

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    let res: Response;
    try {
      res = await fetchOnce(url, revalidate, remaining);
    } catch (err) {
      // A timeout or a dead socket. Not retried; surfaced so the caller can fall
      // back to the degraded path immediately rather than waiting again.
      throw new Error(`OpenDota ${path} -> ${describe(err)}`);
    }

    if (res.ok) return (await res.json()) as T;

    lastError = new Error(`OpenDota ${path} -> HTTP ${res.status}`);
    // 4xx means we asked the wrong question; asking twice just burns quota.
    if (!isRetryableStatus(res.status)) throw lastError;
  }

  throw lastError;
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    return err.name === "AbortError" ? `timed out after ${FETCH_BUDGET_MS}ms` : err.message;
  }
  return String(err);
}

/** Every played GAME of the league. One request. */
export function fetchLeagueMatches(): Promise<RawMatch[]> {
  return getJson<RawMatch[]>(`/api/leagues/${TI_LEAGUE_ID}/matches`, 60);
}

/** In-progress games across all of Dota, filtered down to this league. */
export async function fetchLive(): Promise<RawLive[]> {
  // Align source observation with the public 60-second state cache/poll cadence.
  const all = await getJson<RawLive[]>("/api/live", 60);
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
  const withLive = mergeLive(played, live, nowMs);
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
 * Three things matter here:
 *  1. The live feed's radiant_score / dire_score are KILL COUNTS. They are read
 *     for nothing. Every series score on this site comes from completed games.
 *  2. The live feed lags on removal — a finished game keeps showing up with
 *     deactivate_time 0 after /matches has already recorded it as complete.
 *     A live game whose match_id is already a completed game is dropped, or the
 *     site invents a phantom extra game of a series that is already over.
 *  3. C.2 — this is the ONLY layer allowed to call something "live".
 *     toSeries() is pure and has no clock, so it marks any undecided series
 *     "live" as its best guess. That guess is wrong the moment OpenDota stalls:
 *     a Bo3 stuck at 1-1 because game 3 never got reported would sit there
 *     claiming LIVE indefinitely, on the most prominent element of the page.
 *     Every such guess is re-checked below against the live feed and the clock,
 *     and demoted to "unconfirmed" if neither backs it up.
 */
export function mergeLive(series: Series[], live: RawLive[], nowMs: number): Series[] {
  const completedGameIds = new Set<string>();
  for (const s of series) for (const id of s.gameIds) completedGameIds.add(String(id));

  const stillLive = live.filter((g) => !completedGameIds.has(String(g.match_id)));

  const out = series.map((s) => ({ ...s }));
  const byKey = new Map(out.map((s) => [s.id, s]));
  /** Series the live feed positively vouches for on THIS sync. */
  const confirmed = new Set<string>();

  for (const g of stillLive) {
    const key = g.series_id ? `s-${g.series_id}` : `g-${g.match_id}`;
    const existing = byKey.get(key);
    confirmed.add(key);

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

  // C.2 — demote every "live" the feed did not vouch for and the clock does not
  // support. A series that met its win threshold is already "completed" by
  // toSeries and is never touched here.
  for (const s of out) {
    if (s.status !== "live") continue;
    if (confirmed.has(s.id)) continue;
    if (endedWithinGrace(s, nowMs)) continue;
    s.status = "unconfirmed";
  }

  return out;
}

/**
 * Did this series' last game finish recently enough that it is plausibly still
 * running? `updatedUtc` is last start_time + duration, set by toSeries.
 */
function endedWithinGrace(s: Series, nowMs: number): boolean {
  const endedMs = Date.parse(s.updatedUtc);
  if (Number.isNaN(endedMs)) return false;
  return nowMs - endedMs <= LIVE_GRACE_MS;
}

/**
 * Add hand-entered upcoming matches, and retire the rows whose match has since
 * been played.
 *
 * C.3 — the retirement rule is a ONE-TO-ONE assignment, not a "same two teams
 * within 12 hours" scan. The old rule was too loose in a way that matters here:
 * the Elimination Round explicitly RE-PAIRS teams that already met in the group
 * stage (the best 3-2 team picks any of the five 2-3 teams). Under a pair-only
 * test, the group-stage series would silently retire the Elimination Round row
 * and the upcoming match would vanish from the page.
 *
 * So each schedule row claims at most one played series and each played series
 * can be claimed once — nearest start time wins. The claim is then STAMPED onto
 * the series as `scheduleId`, which is what makes it stable: after the first
 * match the association is an id, not a re-run of a fuzzy time comparison.
 */
export function mergeSchedule(
  series: Series[],
  entriesIn: ScheduleEntry[] = schedule.matches ?? [],
): Series[] {
  const out = series.map((s) => ({ ...s }));
  const existingIds = new Set(out.map((s) => s.id));

  // Only real, concrete, dated series can be claimed by a schedule row.
  const claimable = out.filter(
    (s) =>
      (s.source === "opendota" || s.source === "live") &&
      s.startUtc != null &&
      s.a.kind === "team" &&
      s.b.kind === "team" &&
      s.a.teamId != null &&
      s.b.teamId != null,
  );
  const claimed = new Set<string>();

  // Chronological, so the assignment does not depend on hand-entry order: the
  // earlier round gets first pick of the earlier series.
  const entries = [...entriesIn].sort(
    (x, y) => (x.startUtc ?? "9999").localeCompare(y.startUtc ?? "9999") || x.id.localeCompare(y.id),
  );

  for (const entry of entries) {
    if (existingIds.has(entry.id)) continue;

    if (entry.aTeamId != null && entry.bTeamId != null && entry.startUtc) {
      const played = claimPlayed(claimable, claimed, entry.aTeamId, entry.bTeamId, entry.startUtc);
      if (played) {
        claimed.add(played.id);
        played.section = entry.section;
        played.round = entry.round;
        played.roundLabel = entry.roundLabel;
        played.bestOf = entry.bestOf;
        played.scheduleId = entry.id;
        continue;
      }
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

/**
 * The unclaimed played series that best fits this schedule row, or null.
 * "Best" is the nearest start time inside an asymmetric window — a broadcast
 * runs late far more often than early.
 */
function claimPlayed(
  claimable: Series[],
  claimed: Set<string>,
  aId: TeamId,
  bId: TeamId,
  startUtc: string,
): Series | null {
  const target = Date.parse(startUtc);
  if (Number.isNaN(target)) return null;

  let best: Series | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const s of claimable) {
    if (claimed.has(s.id)) continue;
    const ids = [s.a.teamId, s.b.teamId];
    if (!ids.includes(aId) || !ids.includes(bId)) continue;

    const delta = Date.parse(s.startUtc as string) - target;
    if (delta < -SCHEDULE_EARLY_MS || delta > SCHEDULE_LATE_MS) continue;

    const distance = Math.abs(delta);
    // Ties broken by id so the assignment is deterministic.
    if (distance < bestDistance || (distance === bestDistance && best && s.id < best.id)) {
      best = s;
      bestDistance = distance;
    }
  }

  return best;
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
  }

  // Fate comes only from record thresholds. W-L and name are display ordering;
  // they never decide advancement or elimination.
  const sorted = [...rows.values()].sort(
    (x, y) =>
      y.wins - x.wins || x.losses - y.losses || nameOf(x.teamId).localeCompare(nameOf(y.teamId)),
  );

  for (const row of sorted) {
    if (row.wins >= SWISS_FATE_THRESHOLD) row.state = "advanced";
    else if (row.losses >= SWISS_FATE_THRESHOLD) row.state = "eliminated";
    else if (row.wins + row.losses >= SWISS_MAX_ROUNDS) row.state = "elimination_round";
  }

  return sorted;
}

function nameOf(id: TeamId): string {
  return TEAMS.find((t) => t.id === id)?.name ?? String(id);
}

export function applySwissOverrides(
  rows: SwissRow[],
  patches: NonNullable<OverridesFile["swiss"]> = overrides.swiss ?? {},
): SwissRow[] {
  if (Object.keys(patches).length === 0) return rows;
  return rows.map((r) => {
    const patch = patches[String(r.teamId)];
    if (!patch) return r;
    const merged: SwissRow = { ...r, ...patch };
    // A hand-set fate is authoritative and never provisional.
    if (patch.state != null) merged.provisional = false;
    return merged;
  });
}
