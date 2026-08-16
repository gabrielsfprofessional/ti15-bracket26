import { getTeam } from "@/data/teams";
import type { Series, SlotRef } from "./types";

/**
 * The site's status wording, in one place.
 *
 * The bracket, the schedule cards and the results cards must not describe the
 * same state in three different ways — "unconfirmed" in particular is a
 * deliberate, explained state (see Status in lib/types.ts) and rewording it per
 * component would quietly turn it back into a second kind of "live".
 */
export const SERIES_STATUS_LABEL: Record<Series["status"], string> = {
  tbd: "Matchup TBD",
  scheduled: "Scheduled",
  live: "Live now",
  unconfirmed: "In progress · awaiting live confirmation",
  completed: "Final",
};

/**
 * What to call whoever is standing in this slot.
 *
 * The order matters. A resolved team is named. An unresolved bracket slot falls
 * back to its authored label — "Winner of Upper QF 1" — which is the whole point
 * of carrying a label on the SlotRef: a visitor can read the dependency instead
 * of a blank card or a bare id.
 */
export function slotText(slot: SlotRef): string {
  const name = getTeam(slot.teamId)?.name;
  if (name) return name;
  if (slot.kind === "team" && slot.teamId != null) return `Team ${slot.teamId}`;
  if (slot.label) return slot.label;
  if (slot.kind === "winner_of") return `Winner of ${slot.matchId ?? "previous match"}`;
  if (slot.kind === "loser_of") return `Loser of ${slot.matchId ?? "previous match"}`;
  return "TBD";
}
