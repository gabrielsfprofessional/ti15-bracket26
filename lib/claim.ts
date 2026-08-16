import type { Series, TeamId } from "./types";

/**
 * The one rule for "is this played series the match that official data says was
 * going to happen here?".
 *
 * Both the checked-in schedule (C.3) and the Main Event bracket need this, and
 * they must not drift apart: two slightly different matching rules would let the
 * same OpenDota series be claimed by a schedule row under one window and by a
 * bracket node under another, publishing it twice.
 *
 * The window is asymmetric on purpose. Dota broadcasts run late — a previous
 * series goes five games, the whole day slips — and essentially never start
 * early, so an early tolerance wide enough to be useful would start swallowing
 * the previous slot.
 */
export const CLAIM_EARLY_MS = 2 * 3_600_000;
export const CLAIM_LATE_MS = 12 * 3_600_000;

/**
 * The unclaimed played series that best fits an official slot, or null.
 * "Best" is the nearest start time inside the window; ties break on id so the
 * assignment never depends on input order.
 *
 * Claiming is ONE-TO-ONE: the caller passes the set of already-claimed ids and
 * adds to it. That is what makes a rematch safe — the Elimination Round can
 * re-pair two teams who already met in the Swiss stage, and each of the two
 * series is consumed exactly once.
 */
export function claimNearestSeries(
  candidates: Series[],
  claimed: Set<string>,
  aId: TeamId,
  bId: TeamId,
  startUtc: string,
): Series | null {
  const target = Date.parse(startUtc);
  if (Number.isNaN(target)) return null;

  let best: Series | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (claimed.has(candidate.id)) continue;
    if (candidate.startUtc == null) continue;

    const ids = [candidate.a.teamId, candidate.b.teamId];
    // Unordered: sides swap between games and between providers.
    if (!ids.includes(aId) || !ids.includes(bId)) continue;

    const delta = Date.parse(candidate.startUtc) - target;
    if (Number.isNaN(delta)) continue;
    if (delta < -CLAIM_EARLY_MS || delta > CLAIM_LATE_MS) continue;

    const distance = Math.abs(delta);
    if (distance < bestDistance || (distance === bestDistance && best && candidate.id < best.id)) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
