import type { Tournament } from "./types";

export interface TournamentValidation {
  valid: boolean;
  errors: string[];
}

/**
 * The last line of defence between an upstream anomaly and the public site.
 * Results are append-only, so a shorter series list is never trustworthy.
 */
export function validateTournament(
  candidate: Tournament,
  committedSeriesCount: number,
): TournamentValidation {
  const errors: string[] = [];

  if (candidate.teams.length < 16) {
    errors.push("expected at least 16 teams, received " + candidate.teams.length);
  }

  if (candidate.series.length < committedSeriesCount) {
    errors.push(
      "series count regressed from " +
        committedSeriesCount +
        " to " +
        candidate.series.length,
    );
  }

  const wins = candidate.swiss.reduce((total, row) => total + row.wins, 0);
  const losses = candidate.swiss.reduce((total, row) => total + row.losses, 0);
  if (wins !== losses) {
    errors.push("Swiss parity failed: " + wins + " wins != " + losses + " losses");
  }

  return { valid: errors.length === 0, errors };
}

export function assertTournamentValid(
  candidate: Tournament,
  committedSeriesCount: number,
): void {
  const result = validateTournament(candidate, committedSeriesCount);
  if (!result.valid) {
    throw new Error("[validation] refusing tournament payload: " + result.errors.join("; "));
  }
}

/** The observation timestamp is metadata, not a tournament-state change. */
export function tournamentDataChanged(candidate: Tournament, committed: Tournament): boolean {
  const { lastSyncUtc: _candidateSync, ...candidateData } = candidate;
  const { lastSyncUtc: _committedSync, ...committedData } = committed;
  return JSON.stringify(candidateData) !== JSON.stringify(committedData);
}
