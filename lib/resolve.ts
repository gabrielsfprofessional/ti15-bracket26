import type { Series, SlotRef, TeamId, Tournament } from "./types";

/**
 * Walk the series graph and turn dependency references into concrete teams.
 *
 * PURE. No I/O, no Date.now(). IDEMPOTENT: resolve(resolve(t)) === resolve(t).
 *
 * A bracket slot can say "the winner of match X". Once X completes, that slot
 * becomes a real team id. Because slot B of a match can depend on a match that
 * itself just got resolved, this runs to a fixpoint rather than in one pass —
 * a fresh champion propagates all the way down in a single resolve() call.
 */
export function resolve(
  t: Tournament,
  championOverride: TeamId | null = null,
): Tournament {
  const series = resolveSeries(t.series);
  return {
    ...t,
    series,
    // Manual authority is explicit here rather than stored as an indistinct
    // pre-existing value that an undecided Grand Final would erase.
    championId: championOverride ?? findChampion(series, t.championId),
  };
}

/**
 * The graph half of resolve(), without the tournament wrapper.
 *
 * lib/bracket.ts needs exactly this: propagate every decided result through the
 * dependency slots so the next reconciliation pass can see which nodes now have
 * two concrete participants. Sharing the function keeps one propagation rule
 * rather than a second, subtly different one inside the bracket layer.
 */
export function resolveSeries(input: Series[]): Series[] {
  const byId = new Map<string, Series>();
  for (const s of input) byId.set(s.id, s);

  let series = input.map(cloneSeries);

  // Fixpoint. The cap makes a malformed topology (a cycle authored by hand in
  // bracket-topology.ts) terminate instead of hanging the build.
  const maxPasses = series.length + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    const next = series.map((s) => resolveOne(s, byId));
    let changed = false;
    for (let i = 0; i < next.length; i++) {
      if (!sameSeries(series[i], next[i])) {
        changed = true;
        break;
      }
    }
    series = next;
    // Rebuild the lookup so the next pass sees this pass's resolutions.
    byId.clear();
    for (const s of series) byId.set(s.id, s);
    if (!changed) break;
  }

  return series;
}

function resolveOne(s: Series, byId: Map<string, Series>): Series {
  const a = resolveSlot(s.a, byId);
  const b = resolveSlot(s.b, byId);

  let status = s.status;
  // A match whose participants are now known is no longer "to be determined".
  // Anything already scheduled/live/completed is left exactly as it is.
  if (status === "tbd" && a.kind === "team" && b.kind === "team") status = "scheduled";

  return { ...s, a, b, status };
}

function resolveSlot(slot: SlotRef, byId: Map<string, Series>): SlotRef {
  if (slot.kind !== "winner_of" && slot.kind !== "loser_of") return slot;
  if (!slot.matchId) return slot;

  const src = byId.get(slot.matchId);
  if (!src || src.status !== "completed" || src.winnerId == null) return slot;

  if (slot.kind === "winner_of") {
    return { kind: "team", teamId: src.winnerId };
  }

  const loser = otherTeam(src, src.winnerId);
  if (loser == null) return slot; // loser not yet concrete — try again next pass
  return { kind: "team", teamId: loser };
}

/** The participant of `s` that is not `winnerId`, when both sides are concrete. */
function otherTeam(s: Series, winnerId: TeamId): TeamId | null {
  const ids: TeamId[] = [];
  if (s.a.kind === "team" && s.a.teamId != null) ids.push(s.a.teamId);
  if (s.b.kind === "team" && s.b.teamId != null) ids.push(s.b.teamId);
  if (ids.length !== 2) return null;
  const loser = ids.find((id) => id !== winnerId);
  return loser ?? null;
}

/**
 * The champion is the winner of the grand final. If there is no grand final yet
 * (the whole of the group stage), the existing value is preserved so a manual
 * override in overrides.json is never silently wiped.
 */
function findChampion(series: Series[], existing: TeamId | null): TeamId | null {
  const finals = series.filter((s) => s.section === "grand_final");
  if (finals.length === 0) return existing;

  // Latest grand final wins, so a re-authored bracket does not resurrect an old one.
  const decided = finals
    .filter((s) => s.status === "completed" && s.winnerId != null)
    .sort((x, y) => (x.startUtc ?? "").localeCompare(y.startUtc ?? ""));

  return decided.length ? decided[decided.length - 1].winnerId : null;
}

function cloneSeries(s: Series): Series {
  return { ...s, a: { ...s.a }, b: { ...s.b }, gameIds: [...s.gameIds] };
}

function sameSeries(x: Series, y: Series): boolean {
  return (
    x.status === y.status &&
    x.a.kind === y.a.kind &&
    x.a.teamId === y.a.teamId &&
    x.b.kind === y.b.kind &&
    x.b.teamId === y.b.teamId
  );
}
