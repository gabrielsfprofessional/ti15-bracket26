import type { RawMatch, Section, Series, SlotRef, TeamId } from "./types";

/**
 * Turn a flat list of GAMES from /api/leagues/{id}/matches into SERIES.
 *
 * PURE. No I/O, no Date.now(), no randomness. Same input -> same output, always.
 * This is the one place where a bug corrupts every number on the site, so it is
 * unit tested before anything is wired to it.
 *
 * Rules, per the brief:
 *   - group by series_id; series_type 0 = Bo1, 1 = Bo3, 2 = Bo5
 *   - per game, winner = radiant_win ? radiant_team_id : dire_team_id
 *   - sides swap between games, so tally wins by TEAM_ID, never by side
 *   - complete at 1 / 2 / 3 wins for Bo1 / Bo3 / Bo5
 */

const BEST_OF_BY_SERIES_TYPE: Record<number, 1 | 3 | 5> = { 0: 1, 1: 3, 2: 5 };

export function bestOfFor(seriesType: number): 1 | 3 | 5 {
  // Unknown series_type is treated as Bo3: every TI15 series so far is Bo3, and
  // guessing Bo1 would declare a series finished a game early.
  return BEST_OF_BY_SERIES_TYPE[seriesType] ?? 3;
}

export function winsNeeded(bestOf: 1 | 3 | 5): number {
  return (bestOf + 1) / 2;
}

export interface ToSeriesOptions {
  /** Section stamped on every produced series. Defaults to the group stage. */
  section?: Section;
  round?: number;
  roundLabel?: string;
}

export function toSeries(games: RawMatch[], opts: ToSeriesOptions = {}): Series[] {
  const section = opts.section ?? "swiss";
  const round = opts.round ?? 0;
  const roundLabel = opts.roundLabel ?? "Group Stage";

  // Group. OpenDota occasionally hands back series_id 0 for a standalone game;
  // those must not all collapse into one giant fake series.
  const groups = new Map<string, RawMatch[]>();
  for (const g of games) {
    const key = g.series_id ? `s-${g.series_id}` : `g-${g.match_id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(g);
    else groups.set(key, [g]);
  }

  const out: Series[] = [];
  for (const [id, rawGroup] of groups) {
    out.push(buildSeries(id, rawGroup, section, round, roundLabel));
  }

  // Deterministic order: earliest first, ties broken by id so the output never
  // depends on Map insertion order.
  out.sort((x, y) => cmpNullableIso(x.startUtc, y.startUtc) || x.id.localeCompare(y.id));
  return out;
}

function buildSeries(
  id: string,
  rawGroup: RawMatch[],
  section: Section,
  round: number,
  roundLabel: string,
): Series {
  // Chronological: winner-determination walks games in the order they were played.
  const group = [...rawGroup].sort((x, y) => x.start_time - y.start_time || x.match_id - y.match_id);

  const bestOf = bestOfFor(group[0].series_type);
  const need = winsNeeded(bestOf);
  const [teamA, teamB] = pickPair(group);

  let scoreA = 0;
  let scoreB = 0;
  let winnerId: TeamId | null = null;

  for (const g of group) {
    // Stop counting once the series is decided. Games can appear after the
    // clinch (a remake, or a re-reported game), and letting them keep
    // incrementing prints an impossible "3-1" on a Bo3.
    if (winnerId !== null) continue;

    const gameWinner = g.radiant_win ? g.radiant_team_id : g.dire_team_id;
    if (gameWinner === teamA) scoreA++;
    else if (gameWinner === teamB) scoreB++;
    // A winner from outside the canonical pair means corrupt data; it is simply
    // not counted rather than being allowed to decide the series.

    if (scoreA >= need) winnerId = teamA;
    else if (scoreB >= need) winnerId = teamB;
  }

  const startSec = group[0].start_time;
  const endSec = Math.max(...group.map((g) => g.start_time + g.duration));

  return {
    id,
    seriesId: group[0].series_id || undefined,
    section,
    round,
    roundLabel,
    bestOf,
    a: slot(teamA),
    b: slot(teamB),
    scoreA,
    scoreB,
    status: winnerId !== null ? "completed" : "live",
    startUtc: unixToIso(startSec),
    winnerId,
    gameIds: group.map((g) => g.match_id),
    source: "opendota",
    // Derived from the data, not from the clock, so the function stays pure.
    updatedUtc: unixToIso(endSec),
  };
}

/**
 * The two teams in a series. Normally exactly two distinct ids appear across the
 * games. If bad data introduces a third, the two that appear most often win, with
 * first appearance as the tiebreak — deterministic either way.
 */
function pickPair(group: RawMatch[]): [TeamId, TeamId] {
  const counts = new Map<TeamId, { n: number; firstSeen: number }>();
  let order = 0;
  for (const g of group) {
    for (const id of [g.radiant_team_id, g.dire_team_id]) {
      const e = counts.get(id);
      if (e) e.n++;
      else counts.set(id, { n: 1, firstSeen: order++ });
    }
  }
  const ranked = [...counts.entries()].sort(
    (x, y) => y[1].n - x[1].n || x[1].firstSeen - y[1].firstSeen,
  );
  const first = group[0];
  // Preserve first-game side order (radiant = A) in the normal two-team case, so
  // the pairing reads the same way it did on the broadcast.
  if (ranked.length >= 2) {
    const ids = ranked.slice(0, 2).map((e) => e[0]);
    if (ids.includes(first.radiant_team_id) && ids.includes(first.dire_team_id)) {
      return [first.radiant_team_id, first.dire_team_id];
    }
    return [ids[0], ids[1]];
  }
  return [first.radiant_team_id, first.dire_team_id];
}

function slot(teamId: TeamId): SlotRef {
  return { kind: "team", teamId };
}

export function unixToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

function cmpNullableIso(x: string | null, y: string | null): number {
  if (x === y) return 0;
  if (x === null) return 1; // undated sorts last
  if (y === null) return -1;
  return x < y ? -1 : 1;
}
