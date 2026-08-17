import { describe, expect, it, vi } from "vitest";
import { BRACKET_NODES } from "@/data/bracket-topology";
import { TEAMS } from "@/data/teams";
import { assembleTournament } from "./opendota";
import { loadTournamentWithFallback } from "./state";
import { validateTournament } from "./validation";
import type { OverridesFile, RawMatch, Series, TeamId, Tournament } from "./types";

/**
 * The real, released group stage as a compact table.
 *
 * Every row is [series_id, teamA, teamB, aWins, bWins, first game start], read
 * off OpenDota league 19719 and cross-checked against Valve's league data on
 * 2026-08-16. It exists so the tests can prove the ACTUAL published field —
 * eight qualifiers, eight eliminated, the five Elimination Round claims — with
 * no network access.
 */
const GROUP_STAGE: Array<[number, TeamId, TeamId, number, number, string]> = [
  [1130024, 9247354, 10150538, 2, 1, "2026-08-13T03:03:26.000Z"],
  [1130028, 10136357, 10150413, 0, 2, "2026-08-13T03:18:54.000Z"],
  [1130027, 5017210, 9572001, 1, 2, "2026-08-13T03:33:30.000Z"],
  [1130032, 8255888, 2586976, 2, 0, "2026-08-13T03:38:50.000Z"],
  [1130045, 2163, 726228, 2, 0, "2026-08-13T05:57:49.000Z"],
  [1130047, 9964962, 9467224, 0, 2, "2026-08-13T06:09:06.000Z"],
  [1130053, 9823272, 10149530, 2, 0, "2026-08-13T07:18:12.000Z"],
  [1130051, 7119388, 8261500, 2, 0, "2026-08-13T07:18:50.000Z"],
  [1130060, 8255888, 10150413, 2, 1, "2026-08-13T08:43:13.000Z"],
  [1130063, 5017210, 10150538, 1, 2, "2026-08-13T09:17:12.000Z"],
  [1130066, 10136357, 2586976, 2, 0, "2026-08-13T09:32:32.000Z"],
  [1130069, 9247354, 9572001, 1, 2, "2026-08-13T10:06:45.000Z"],
  [1130279, 726228, 10149530, 2, 1, "2026-08-14T02:00:25.000Z"],
  [1130282, 9964962, 8261500, 2, 0, "2026-08-14T02:01:23.000Z"],
  [1130281, 9823272, 2163, 1, 2, "2026-08-14T02:02:05.000Z"],
  [1130278, 7119388, 9467224, 2, 0, "2026-08-14T02:02:13.000Z"],
  [1130301, 10150538, 10136357, 0, 2, "2026-08-14T04:11:37.000Z"],
  [1130305, 8255888, 9572001, 0, 2, "2026-08-14T04:33:50.000Z"],
  [1130309, 10150413, 9247354, 2, 1, "2026-08-14T05:47:21.000Z"],
  [1130312, 5017210, 2586976, 2, 0, "2026-08-14T06:10:26.000Z"],
  [1130317, 726228, 9964962, 2, 1, "2026-08-14T07:14:12.000Z"],
  [1130320, 2163, 7119388, 1, 2, "2026-08-14T07:26:22.000Z"],
  [1130324, 8261500, 10149530, 2, 0, "2026-08-14T08:36:26.000Z"],
  [1130328, 9823272, 9467224, 1, 2, "2026-08-14T10:24:53.000Z"],
  [1130536, 10149530, 2586976, 1, 2, "2026-08-15T02:00:16.000Z"],
  [1130534, 9964962, 9247354, 1, 2, "2026-08-15T02:00:22.000Z"],
  [1130535, 10150538, 8261500, 2, 1, "2026-08-15T02:01:25.000Z"],
  [1130533, 5017210, 9823272, 1, 2, "2026-08-15T02:02:08.000Z"],
  [1130559, 726228, 10136357, 0, 2, "2026-08-15T05:26:24.000Z"],
  [1130564, 2163, 10150413, 2, 1, "2026-08-15T06:02:18.000Z"],
  [1130566, 8255888, 9467224, 0, 2, "2026-08-15T06:09:56.000Z"],
  [1130567, 7119388, 9572001, 0, 2, "2026-08-15T06:19:26.000Z"],
  [1130619, 5017210, 8261500, 2, 0, "2026-08-15T09:33:28.000Z"],
  [1130622, 9964962, 2586976, 2, 0, "2026-08-15T09:34:29.000Z"],
  [1130625, 726228, 10150538, 0, 2, "2026-08-15T09:41:07.000Z"],
  [1130641, 9247354, 8255888, 2, 1, "2026-08-15T10:41:46.000Z"],
  [1130665, 9823272, 10150413, 1, 2, "2026-08-15T11:44:37.000Z"],
  [1130669, 9467224, 2163, 1, 2, "2026-08-15T11:52:37.000Z"],
  [1130710, 10136357, 7119388, 2, 0, "2026-08-15T12:56:14.000Z"],
  [1130919, 726228, 9247354, 0, 2, "2026-08-16T02:00:06.000Z"],
  [1130934, 8255888, 9467224, 2, 0, "2026-08-16T03:00:00.000Z"],
  [1130941, 7119388, 5017210, 2, 1, "2026-08-16T04:32:38.000Z"],
  [1130950, 9964962, 10150413, 0, 2, "2026-08-16T05:46:32.000Z"],
  [1130974, 10150538, 9823272, 1, 2, "2026-08-16T08:08:05.000Z"],
];

/** The five Elimination Round series, by the ids the schedule rows must claim. */
const ELIMINATION_SERIES_IDS = [1130919, 1130934, 1130941, 1130950, 1130974];

const QUALIFIERS: TeamId[] = [10150413, 7119388, 9572001, 8255888, 2163, 9823272, 10136357, 9247354];
const ELIMINATED: TeamId[] = [9467224, 10150538, 726228, 5017210, 9964962, 2586976, 8261500, 10149530];

const NOW = Date.parse("2026-08-16T14:00:00Z");

/** Expand the table into the per-GAME rows OpenDota actually returns. */
function rawMatches(rows = GROUP_STAGE): RawMatch[] {
  const games: RawMatch[] = [];
  let matchId = 500_000;
  for (const [seriesId, a, b, aWins, bWins, startUtc] of rows) {
    const start = Math.floor(Date.parse(startUtc) / 1000);
    const outcomes = [
      ...Array.from({ length: aWins }, () => a),
      ...Array.from({ length: bWins }, () => b),
    ];
    outcomes.forEach((winner, index) => {
      // Sides swap between games, which is exactly what must not confuse the
      // winner tally — so alternate them.
      const radiant = index % 2 === 0 ? a : b;
      const dire = index % 2 === 0 ? b : a;
      games.push({
        match_id: matchId++,
        radiant_win: winner === radiant,
        start_time: start + index * 2400,
        duration: 2100,
        leagueid: 19719,
        radiant_score: 30,
        dire_score: 20,
        radiant_team_id: radiant,
        radiant_team_name: null,
        dire_team_id: dire,
        dire_team_name: null,
        series_id: seriesId,
        series_type: 1,
      });
    });
  }
  return games;
}

function build(rows = GROUP_STAGE): Tournament {
  return assembleTournament({ matches: rawMatches(rows), live: [], nowMs: NOW });
}

function bracketNodes(tournament: Tournament): Series[] {
  return tournament.series.filter((item) =>
    ["upper", "lower", "grand_final"].includes(item.section),
  );
}

describe("released TI15 field", () => {
  const tournament = build();

  it("publishes 44 completed group-stage series plus the 14 bracket nodes", () => {
    expect(tournament.series).toHaveLength(58);
    expect(tournament.series.filter((item) => item.status === "completed")).toHaveLength(44);
    expect(bracketNodes(tournament)).toHaveLength(BRACKET_NODES.length);
  });

  it("has four scheduled quarterfinals and ten unresolved future nodes", () => {
    const nodes = bracketNodes(tournament);
    expect(nodes.filter((item) => item.status === "scheduled")).toHaveLength(4);
    expect(nodes.filter((item) => item.status === "tbd")).toHaveLength(10);
    expect(nodes.every((item) => item.seriesId == null)).toBe(true);
  });

  it("puts the exact official participants and times on the quarterfinals", () => {
    const qfs = bracketNodes(tournament)
      .filter((item) => item.status === "scheduled")
      .sort((x, y) => (x.startUtc ?? "").localeCompare(y.startUtc ?? ""))
      .map((item) => [item.id, item.a.teamId, item.b.teamId, item.startUtc]);
    expect(qfs).toEqual([
      ["main-ub-qf1", 10150413, 7119388, "2026-08-20T02:00:00Z"],
      ["main-ub-qf2", 9572001, 8255888, "2026-08-20T05:00:00Z"],
      ["main-ub-qf3", 2163, 9823272, "2026-08-20T08:00:00Z"],
      ["main-ub-qf4", 10136357, 9247354, "2026-08-20T11:00:00Z"],
    ]);
  });

  it("classifies exactly the five Elimination Round series, each claimed once", () => {
    const elimination = tournament.series.filter((item) => item.section === "elimination");
    expect(elimination).toHaveLength(5);
    expect(elimination.map((item) => item.seriesId).sort()).toEqual([...ELIMINATION_SERIES_IDS].sort());
    expect(elimination.every((item) => item.status === "completed")).toBe(true);
    expect(elimination.map((item) => item.scheduleId).sort()).toEqual([
      "elim-m1",
      "elim-m2",
      "elim-m3",
      "elim-m4",
      "elim-m5",
    ]);
  });

  it("leaves Swiss W-L untouched by the Elimination Round, and in parity", () => {
    const wins = tournament.swiss.reduce((sum, row) => sum + row.wins, 0);
    const losses = tournament.swiss.reduce((sum, row) => sum + row.losses, 0);
    expect(wins).toBe(losses);
    // 39 Swiss series played; the five Elimination Round series add nothing.
    expect(wins).toBe(39);

    const record = Object.fromEntries(
      tournament.swiss.map((row) => [row.teamId, `${row.wins}-${row.losses}`]),
    );
    expect(record[9572001]).toBe("4-0");
    expect(record[7119388]).toBe("3-2"); // won its Elimination Round series
    expect(record[8255888]).toBe("2-3"); // also qualified, still 2-3
    expect(record[10149530]).toBe("0-4");
  });

  it("settles the field at exactly eight qualified and eight eliminated", () => {
    const byState = new Map<string, TeamId[]>();
    for (const row of tournament.swiss) {
      byState.set(row.state, [...(byState.get(row.state) ?? []), row.teamId]);
    }
    expect(byState.get("active")).toBeUndefined();
    expect(byState.get("elimination_round")).toBeUndefined();
    expect([...(byState.get("advanced") ?? [])].sort()).toEqual([...QUALIFIERS].sort());
    expect([...(byState.get("eliminated") ?? [])].sort()).toEqual([...ELIMINATED].sort());
    expect(tournament.swiss).toHaveLength(TEAMS.length);
  });

  it("puts the eight qualifiers, and only them, into the quarterfinals", () => {
    const field = bracketNodes(tournament)
      .filter((item) => item.status === "scheduled")
      .flatMap((item) => [item.a.teamId, item.b.teamId]);
    expect([...field].sort()).toEqual([...QUALIFIERS].sort());
  });

  it("never publishes the same upstream series twice", () => {
    const providerIds = tournament.series.map((item) => item.seriesId).filter((id) => id != null);
    expect(providerIds).toHaveLength(44);
    expect(new Set(providerIds).size).toBe(44);
    const ids = tournament.series.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("passes full tournament validation", () => {
    const withSnapshot: Tournament = {
      ...tournament,
      sourceHealth: { ...tournament.sourceHealth, snapshotGeneratedUtc: tournament.lastSyncUtc },
    };
    expect(validateTournament(withSnapshot, 0)).toEqual({ valid: true, errors: [] });
  });

  it("is idempotent across repeated assembly", () => {
    expect(build()).toEqual(tournament);
  });
});

describe("bracket regression is rejected", () => {
  const good = build();
  const baseline: Tournament = {
    ...good,
    sourceHealth: { ...good.sourceHealth, snapshotGeneratedUtc: good.lastSyncUtc },
  };

  it("rejects a candidate that lost a completed bracket-adjacent series", () => {
    const shrunk: Tournament = { ...baseline, series: baseline.series.slice(0, 40) };
    const result = validateTournament(shrunk, baseline);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("series_regression");
  });

  it("rejects a missing stable bracket node even when total series count is unchanged", () => {
    const grandFinal = baseline.series.find((item) => item.id === "main-grand-final") as Series;
    const replaced: Tournament = {
      ...baseline,
      series: [
        ...baseline.series.filter((item) => item.id !== grandFinal.id),
        { ...grandFinal, id: "s-raw-grand-final" },
      ],
    };
    const result = validateTournament(replaced, baseline);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("bracket_node_missing: main-grand-final");
  });

  it("rejects a completed node that reverted to scheduled", () => {
    const reverted: Tournament = {
      ...baseline,
      series: baseline.series.map((item) =>
        item.seriesId === 1130919
          ? { ...item, status: "scheduled" as const, winnerId: null, scoreA: 0, scoreB: 0 }
          : item,
      ),
    };
    const result = validateTournament(reverted, baseline);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("completed_regression");
  });

  it("rejects the same upstream series published under two ids", () => {
    const duplicated: Tournament = {
      ...baseline,
      series: [
        ...baseline.series,
        { ...(baseline.series.find((item) => item.seriesId === 1130919) as Series), id: "copy" },
      ],
    };
    const result = validateTournament(duplicated, baseline);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate_provider_series");
  });

  it("serves the last valid bracket instead of clearing it, and says so", async () => {
    const broken: Tournament = {
      ...baseline,
      series: baseline.series.filter((item) => item.id !== "main-grand-final"),
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const served = await loadTournamentWithFallback(async () => broken, baseline);
    error.mockRestore();

    expect(served.syncState).toBe("degraded");
    expect(served.sourceHealth.mode).toBe("degraded");
    // The bracket is intact, not emptied.
    expect(bracketNodes(served)).toHaveLength(BRACKET_NODES.length);
    expect(served.series.some((item) => item.id === "main-grand-final")).toBe(true);
  });

  it("rejects a bracket node claiming a winner who is not a participant", () => {
    const impossible: Tournament = {
      ...baseline,
      series: baseline.series.map((item) =>
        item.id === "main-ub-qf1"
          ? { ...item, status: "completed" as const, scoreA: 2, scoreB: 0, winnerId: 10149530 }
          : item,
      ),
    };
    const result = validateTournament(impossible, baseline);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("winner");
  });
});

describe("manual bracket authority", () => {
  const manualResult: OverridesFile = {
    series: {
      "main-ub-qf1": {
        status: "completed",
        scoreA: 0,
        scoreB: 2,
        winnerId: 7119388,
      },
    },
  };

  it("reflows winner and loser paths after a provider result is corrected", () => {
    const withProviderQuarterfinal: Array<[number, TeamId, TeamId, number, number, string]> = [
      ...GROUP_STAGE,
      [1132000, 10150413, 7119388, 2, 0, "2026-08-20T02:04:00.000Z"],
    ];
    const tournament = assembleTournament(
      { matches: rawMatches(withProviderQuarterfinal), live: [], nowMs: Date.parse("2026-08-20T05:00:00Z") },
      manualResult,
    );

    const qf = tournament.series.find((item) => item.id === "main-ub-qf1") as Series;
    const upper = tournament.series.find((item) => item.id === "main-ub-sf1") as Series;
    const lower = tournament.series.find((item) => item.id === "main-lb-r1-1") as Series;
    expect(qf.winnerId).toBe(7119388);
    expect(upper.a).toEqual({ kind: "team", teamId: 7119388 });
    expect(lower.a).toEqual({ kind: "team", teamId: 10150413 });
  });

  it("drops a downstream provider claim whose participants became stale after a correction", () => {
    const withPlayedSemifinal: Array<[number, TeamId, TeamId, number, number, string]> = [
      ...GROUP_STAGE,
      [1132000, 10150413, 7119388, 2, 0, "2026-08-20T02:04:00.000Z"],
      [1132001, 9572001, 8255888, 2, 0, "2026-08-20T05:04:00.000Z"],
      [1132002, 10150413, 9572001, 2, 0, "2026-08-21T08:04:00.000Z"],
    ];
    const tournament = assembleTournament(
      { matches: rawMatches(withPlayedSemifinal), live: [], nowMs: Date.parse("2026-08-21T12:00:00Z") },
      manualResult,
    );

    const semifinal = tournament.series.find((item) => item.id === "main-ub-sf1") as Series;
    const upperFinal = tournament.series.find((item) => item.id === "main-ub-final") as Series;
    expect(semifinal.a).toEqual({ kind: "team", teamId: 7119388 });
    expect(semifinal.b).toEqual({ kind: "team", teamId: 9572001 });
    expect(semifinal.status).toBe("scheduled");
    expect(semifinal.seriesId).toBeUndefined();
    expect(semifinal.winnerId).toBeNull();
    expect(upperFinal.a).toMatchObject({ kind: "winner_of", matchId: "main-ub-sf1" });
    expect(tournament.series.some((item) => item.id === "s-1132002")).toBe(false);
  });

  it("claims a downstream provider result that exists only on the corrected path", () => {
    const correctedPath: Array<[number, TeamId, TeamId, number, number, string]> = [
      ...GROUP_STAGE,
      [1132000, 10150413, 7119388, 2, 0, "2026-08-20T02:04:00.000Z"],
      [1132001, 9572001, 8255888, 2, 0, "2026-08-20T05:04:00.000Z"],
      [1132003, 7119388, 9572001, 2, 1, "2026-08-21T08:04:00.000Z"],
    ];
    const tournament = assembleTournament(
      { matches: rawMatches(correctedPath), live: [], nowMs: Date.parse("2026-08-21T12:00:00Z") },
      manualResult,
    );

    const semifinal = tournament.series.find((item) => item.id === "main-ub-sf1") as Series;
    expect(semifinal.status).toBe("completed");
    expect(semifinal.seriesId).toBe(1132003);
    expect(semifinal.a).toEqual({ kind: "team", teamId: 7119388 });
    expect(semifinal.b).toEqual({ kind: "team", teamId: 9572001 });
    expect(semifinal.winnerId).toBe(7119388);
    expect(tournament.series.some((item) => item.id === "s-1132003")).toBe(false);
  });

  it("keeps a manual champion authoritative while the Grand Final is undecided", () => {
    expect(assembleTournament({ matches: rawMatches(), live: [], nowMs: NOW }, { championId: 7119388 }).championId)
      .toBe(7119388);
  });
});
