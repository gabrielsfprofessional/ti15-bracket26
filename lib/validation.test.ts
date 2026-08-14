import { afterEach, describe, expect, it, vi } from "vitest";
import { TEAMS } from "@/data/teams";
import type { Series, Tournament } from "./types";
import { loadTournamentWithFallback } from "./state";
import { tournamentDataChanged, validateTournament } from "./validation";

const series = (id: string): Series => ({
  id,
  section: "swiss",
  round: 1,
  roundLabel: "Round 1",
  bestOf: 3,
  a: { kind: "team", teamId: TEAMS[0].id },
  b: { kind: "team", teamId: TEAMS[1].id },
  scoreA: 2,
  scoreB: 0,
  status: "completed",
  startUtc: "2026-08-13T02:00:00.000Z",
  winnerId: TEAMS[0].id,
  gameIds: [1, 2],
  source: "opendota",
  updatedUtc: "2026-08-13T04:00:00.000Z",
});

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    leagueId: 19719,
    teams: TEAMS,
    swiss: TEAMS.map((team, index) => ({
      teamId: team.id,
      wins: index === 0 ? 1 : 0,
      losses: index === 1 ? 1 : 0,
      state: "active",
    })),
    series: [series("s-1")],
    championId: null,
    lastSyncUtc: "2026-08-14T12:00:00.000Z",
    syncState: "ok",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tournament validation gate", () => {
  it("accepts a non-regressing payload with 16 teams and Swiss parity", () => {
    expect(validateTournament(tournament(), 1)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a team list shorter than 16", () => {
    const result = validateTournament(tournament({ teams: TEAMS.slice(0, 15) }), 1);
    expect(result.errors.join(" ")).toMatch(/at least 16 teams/);
  });

  it("rejects a series-count regression", () => {
    const result = validateTournament(tournament(), 2);
    expect(result.errors.join(" ")).toMatch(/regressed from 2 to 1/);
  });

  it("rejects unequal Swiss win and loss totals", () => {
    const broken = tournament();
    broken.swiss[1] = { ...broken.swiss[1], losses: 0 };
    const result = validateTournament(broken, 1);
    expect(result.errors.join(" ")).toMatch(/parity failed/);
  });

  it("ignores lastSyncUtc when deciding whether snapshot data changed", () => {
    const committed = tournament();
    const candidate = tournament({ lastSyncUtc: "2026-08-14T13:00:00.000Z" });
    expect(tournamentDataChanged(candidate, committed)).toBe(false);
  });
});

describe("snapshot fallback", () => {
  it("returns a valid live payload unchanged", async () => {
    const live = tournament({ lastSyncUtc: "2026-08-14T13:00:00.000Z" });
    await expect(loadTournamentWithFallback(async () => live, tournament())).resolves.toBe(live);
  });

  it("serves the committed snapshot as degraded when live fetching fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const snapshot = tournament();
    const result = await loadTournamentWithFallback(
      async () => Promise.reject(new Error("dead upstream")),
      snapshot,
    );

    expect(result).toEqual({ ...snapshot, syncState: "degraded" });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("serves the snapshot when validation rejects the live payload", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const snapshot = tournament({ series: [series("s-1"), series("s-2")] });
    const result = await loadTournamentWithFallback(async () => tournament(), snapshot);

    expect(result.syncState).toBe("degraded");
    expect(result.series).toHaveLength(2);
  });
});
