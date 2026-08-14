import snapshotFile from "@/data/tournament.json";
import { buildTournament } from "./opendota";
import type { SourceHealth, Tournament } from "./types";
import { assertTournamentValid, TournamentValidationError } from "./validation";

const committedSnapshot = normalizeSnapshot(snapshotFile as unknown as Tournament);

/** Live-first tournament state with a build-bundled disaster-recovery snapshot. */
export function loadTournament(nowMs: number = Date.now()): Promise<Tournament> {
  return loadTournamentWithFallback(
    () => buildTournament(nowMs),
    committedSnapshot,
    new Date(nowMs).toISOString(),
  );
}

/** Exported as a narrow seam so fallback behaviour can be proven without network I/O. */
export async function loadTournamentWithFallback(
  loadLive: () => Promise<Tournament>,
  snapshotInput: Tournament,
  observedUtc: string = new Date().toISOString(),
): Promise<Tournament> {
  const snapshot = normalizeSnapshot(snapshotInput);
  let rejectedCandidate: Tournament | null = null;
  try {
    const candidate = await loadLive();
    rejectedCandidate = candidate;
    const withSnapshotHealth: Tournament = {
      ...candidate,
      sourceHealth: {
        ...candidate.sourceHealth,
        snapshotGeneratedUtc: snapshot.sourceHealth.snapshotGeneratedUtc,
      },
    };

    // buildTournament deliberately preserves partial data when either request
    // fails. Partial is useful to callers, but it is not safe enough to serve.
    if (withSnapshotHealth.syncState === "degraded") {
      throw new Error("one or more OpenDota requests failed");
    }

    assertTournamentValid(withSnapshotHealth, snapshot);
    return withSnapshotHealth;
  } catch (error) {
    const reasons =
      error instanceof TournamentValidationError
        ? error.reasons
        : [error instanceof Error ? error.message : "unknown live-state failure"];
    console.error("[state] live tournament rejected", {
      event: "live_candidate_rejected",
      fallbackSnapshotUtc: snapshot.lastSyncUtc,
      reasons,
    });
    const manual = snapshot.syncState === "manual";
    const failedHealth = rejectedCandidate?.sourceHealth;
    return {
      ...snapshot,
      syncState: manual ? "manual" : "degraded",
      sourceHealth: {
        matches: failedHealth?.matches ?? { status: "error", observedUtc },
        live: failedHealth?.live ?? { status: "error", observedUtc },
        schedule: failedHealth?.schedule ?? snapshot.sourceHealth.schedule,
        snapshotGeneratedUtc: snapshot.sourceHealth.snapshotGeneratedUtc,
        mode: manual ? "manual" : "degraded",
      },
    };
  }
}

function normalizeSnapshot(snapshot: Tournament): Tournament {
  const existing = (snapshot as Partial<Tournament>).sourceHealth;
  if (existing) {
    return {
      ...snapshot,
      sourceHealth: {
        ...existing,
        snapshotGeneratedUtc: existing.snapshotGeneratedUtc ?? snapshot.lastSyncUtc,
      },
    };
  }

  const managedObservation = { status: "managed" as const, observedUtc: snapshot.lastSyncUtc };
  const sourceHealth: SourceHealth = {
    matches: { status: "ok", observedUtc: snapshot.lastSyncUtc },
    live: { status: "ok", observedUtc: snapshot.lastSyncUtc },
    schedule: managedObservation,
    snapshotGeneratedUtc: snapshot.lastSyncUtc,
    mode: snapshot.syncState === "manual" ? "manual" : "degraded",
  };
  return { ...snapshot, sourceHealth };
}
