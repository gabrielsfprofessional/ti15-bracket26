import snapshotFile from "@/data/tournament.json";
import { buildTournament } from "./opendota";
import type { Tournament } from "./types";
import { assertTournamentValid } from "./validation";

const committedSnapshot = snapshotFile as unknown as Tournament;

/** Live-first tournament state with a build-bundled disaster-recovery snapshot. */
export function loadTournament(nowMs: number = Date.now()): Promise<Tournament> {
  return loadTournamentWithFallback(() => buildTournament(nowMs), committedSnapshot);
}

/** Exported as a narrow seam so fallback behaviour can be proven without network I/O. */
export async function loadTournamentWithFallback(
  loadLive: () => Promise<Tournament>,
  snapshot: Tournament,
): Promise<Tournament> {
  try {
    const candidate = await loadLive();

    // buildTournament deliberately preserves partial data when either request
    // fails. Partial is useful to callers, but it is not safe enough to serve.
    if (candidate.syncState === "degraded") {
      throw new Error("one or more OpenDota requests failed");
    }

    assertTournamentValid(candidate, snapshot.series.length);
    return candidate;
  } catch (error) {
    console.error(
      "[state] live tournament rejected; serving snapshot from " + snapshot.lastSyncUtc,
      error,
    );
    return { ...snapshot, syncState: "degraded" };
  }
}
