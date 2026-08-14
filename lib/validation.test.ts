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
    expect(result.errors.join(" ")).toMatch(/exactly 16 unique teams/);
  });

  it("rejects duplicate or non-tournament team IDs even when there are 16 rows", () => {
    const duplicate = [...TEAMS.slice(0, 15), TEAMS[0]];
    const result = validateTournament(tournament({ teams: duplicate }), 1);
    expect(result.errors.join(" ")).toMatch(/team_count/);
    expect(result.errors.join(" ")).toMatch(/team_ids/);
  });

  it("rejects a series-count regression", () => {
    const result = validateTournament(tournament(), 2);
    expect(result.errors.join(" ")).toMatch(/series_regression: count fell from 2 to 1/);
  });

  it("rejects unequal Swiss win and loss totals", () => {
    const broken = tournament();
    broken.swiss[1] = { ...broken.swiss[1], losses: 0 };
    const result = validateTournament(broken, 1);
    expect(result.errors.join(" ")).toMatch(/swiss_mismatch/);
  });

  it("rejects duplicate series IDs", () => {
    const result = validateTournament(tournament({ series: [series("s-1"), series("s-1")] }), 1);
    expect(result.errors.join(" ")).toMatch(/duplicate_series_id/);
  });

  it("rejects a completed game ID claimed by two series", () => {
    const second = {
      ...series("s-2"),
      a: { kind: "team" as const, teamId: TEAMS[2].id },
      b: { kind: "team" as const, teamId: TEAMS[3].id },
      winnerId: TEAMS[2].id,
      gameIds: [2, 3],
    };
    const result = validateTournament(tournament({ series: [series("s-1"), second] }), 1);
    expect(result.errors.join(" ")).toMatch(/duplicate_game_id/);
  });

  it("rejects unknown team IDs in concrete series slots", () => {
    const broken = series("s-1");
    broken.b = { kind: "team", teamId: 99999999 };
    const result = validateTournament(tournament({ series: [broken] }), 1);
    expect(result.errors.join(" ")).toMatch(/unknown_team/);
  });

  it("rejects malformed and non-UTC timestamps", () => {
    const malformed = series("s-1");
    malformed.startUtc = "not-a-date";
    malformed.updatedUtc = "2026-08-14T04:00:00-04:00";
    const result = validateTournament(
      tournament({ lastSyncUtc: "2026-08-14 12:00:00", series: [malformed] }),
      1,
    );
    expect(result.errors.filter((error) => error.startsWith("timestamp:"))).toHaveLength(3);
  });

  it("rejects impossible best-of scores", () => {
    const broken = series("s-1");
    broken.scoreA = 3;
    const result = validateTournament(tournament({ series: [broken] }), 1);
    expect(result.errors.join(" ")).toMatch(/impossible Bo3 score/);
  });

  it("rejects a winner who is not one of the two teams", () => {
    const broken = series("s-1");
    broken.winnerId = TEAMS[2].id;
    const result = validateTournament(tournament({ series: [broken] }), 1);
    expect(result.errors.join(" ")).toMatch(/winner .* is not a participant/);
  });

  it("rejects completed series without a valid winner", () => {
    const broken = series("s-1");
    broken.winnerId = null;
    const result = validateTournament(tournament({ series: [broken] }), 1);
    expect(result.errors.join(" ")).toMatch(/completed_winner/);
  });

  it("rejects scheduled and TBD series that claim a final winner", () => {
    for (const status of ["scheduled", "tbd"] as const) {
      const broken = series("s-1");
      broken.status = status;
      broken.winnerId = TEAMS[0].id;
      broken.scoreA = 0;
      broken.scoreB = 0;
      const result = validateTournament(tournament({ series: [broken] }), 1);
      expect(result.errors.join(" ")).toMatch(/future_winner/);
    }
  });

  it("rejects Swiss rows that differ from completed Swiss recomputation", () => {
    const broken = tournament();
    broken.swiss[0] = { ...broken.swiss[0], wins: 2 };
    const result = validateTournament(broken, 1);
    expect(result.errors.join(" ")).toMatch(/swiss_mismatch/);
  });

  it("rejects completed-data regression relative to the snapshot", () => {
    const baseline = tournament({ series: [series("s-1"), series("s-2")] });
    const candidate = tournament({ series: [series("s-1"), { ...series("s-2"), status: "live", winnerId: null, scoreA: 1 }] });
    const result = validateTournament(candidate, baseline);
    expect(result.errors.join(" ")).toMatch(/completed_regression/);
  });

  it("rejects a completed series that loses a previously stored game", () => {
    const baseline = tournament();
    const current = series("s-1");
    current.gameIds = [1];
    const result = validateTournament(tournament({ series: [current] }), baseline);
    expect(result.errors.join(" ")).toMatch(/completed_game_regression/);
  });

  it("rejects invalid section, status, and source values", () => {
    const broken = series("s-1");
    const unsafe = broken as unknown as Record<string, unknown>;
    unsafe.section = "groups";
    unsafe.status = "final";
    unsafe.source = "scrape";
    const result = validateTournament(tournament({ series: [broken] }), 1);
    expect(result.errors.join(" ")).toMatch(/series_section/);
    expect(result.errors.join(" ")).toMatch(/series_status/);
    expect(result.errors.join(" ")).toMatch(/series_source/);
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
