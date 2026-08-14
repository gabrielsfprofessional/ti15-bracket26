import { describe, expect, it } from "vitest";
import { bestOfFor, toSeries, winsNeeded } from "./series";
import type { RawMatch } from "./types";

const FALCONS = 9247354;
const LGD = 10150538;
const LIQUID = 2163;

let nextMatchId = 8_900_000_000;

/** Minimal game factory. `winner` is a team id, not a side — sides swap freely. */
function game(opts: {
  seriesId: number;
  seriesType?: number;
  radiant: number;
  dire: number;
  winner: number;
  start: number;
  duration?: number;
}): RawMatch {
  const radiantWin = opts.winner === opts.radiant;
  return {
    match_id: nextMatchId++,
    radiant_win: radiantWin,
    start_time: opts.start,
    duration: opts.duration ?? 2000,
    leagueid: 19719,
    radiant_score: radiantWin ? 30 : 10,
    dire_score: radiantWin ? 10 : 30,
    radiant_team_id: opts.radiant,
    radiant_team_name: null,
    dire_team_id: opts.dire,
    dire_team_name: null,
    series_id: opts.seriesId,
    series_type: opts.seriesType ?? 1,
  };
}

const T0 = 1_786_590_000;

describe("bestOfFor / winsNeeded", () => {
  it("maps series_type to best-of", () => {
    expect(bestOfFor(0)).toBe(1);
    expect(bestOfFor(1)).toBe(3);
    expect(bestOfFor(2)).toBe(5);
  });

  it("falls back to Bo3 for an unknown series_type rather than ending a series early", () => {
    expect(bestOfFor(7)).toBe(3);
    expect(bestOfFor(-1)).toBe(3);
  });

  it("computes the wins needed", () => {
    expect(winsNeeded(1)).toBe(1);
    expect(winsNeeded(3)).toBe(2);
    expect(winsNeeded(5)).toBe(3);
  });
});

describe("toSeries", () => {
  it("returns nothing for no games", () => {
    expect(toSeries([])).toEqual([]);
  });

  it("tallies by team id across swapped sides — the core trap", () => {
    // Falcons win games 1 and 3. They are radiant in game 1, DIRE in game 3.
    // A side-based tally would score this 1-2 and crown the wrong team.
    const games = [
      game({ seriesId: 100, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
      game({ seriesId: 100, radiant: LGD, dire: FALCONS, winner: LGD, start: T0 + 3000 }),
      game({ seriesId: 100, radiant: LGD, dire: FALCONS, winner: FALCONS, start: T0 + 6000 }),
    ];

    const [s] = toSeries(games);
    expect(s.a).toEqual({ kind: "team", teamId: FALCONS });
    expect(s.b).toEqual({ kind: "team", teamId: LGD });
    expect(s.scoreA).toBe(2);
    expect(s.scoreB).toBe(1);
    expect(s.winnerId).toBe(FALCONS);
    expect(s.status).toBe("completed");
    expect(s.bestOf).toBe(3);
  });

  it("orders games chronologically regardless of input order", () => {
    const g1 = game({ seriesId: 101, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 });
    const g2 = game({ seriesId: 101, radiant: LGD, dire: FALCONS, winner: FALCONS, start: T0 + 3000 });

    const forward = toSeries([g1, g2])[0];
    const backward = toSeries([g2, g1])[0];

    expect(backward.gameIds).toEqual(forward.gameIds);
    expect(backward.startUtc).toBe(forward.startUtc);
    expect(backward.a).toEqual(forward.a);
    expect(backward.scoreA).toBe(2);
  });

  it("marks a Bo3 with one game played as live, not completed", () => {
    const [s] = toSeries([
      game({ seriesId: 102, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
    ]);
    expect(s.scoreA).toBe(1);
    expect(s.scoreB).toBe(0);
    expect(s.status).toBe("live");
    expect(s.winnerId).toBeNull();
  });

  it("completes a Bo1 at one win", () => {
    const [s] = toSeries([
      game({ seriesId: 103, seriesType: 0, radiant: FALCONS, dire: LGD, winner: LGD, start: T0 }),
    ]);
    expect(s.bestOf).toBe(1);
    expect(s.status).toBe("completed");
    expect(s.winnerId).toBe(LGD);
  });

  it("completes a Bo5 at three wins", () => {
    const games = [
      game({ seriesId: 104, seriesType: 2, radiant: FALCONS, dire: LGD, winner: LGD, start: T0 }),
      game({ seriesId: 104, seriesType: 2, radiant: LGD, dire: FALCONS, winner: FALCONS, start: T0 + 3000 }),
      game({ seriesId: 104, seriesType: 2, radiant: FALCONS, dire: LGD, winner: LGD, start: T0 + 6000 }),
      game({ seriesId: 104, seriesType: 2, radiant: LGD, dire: FALCONS, winner: FALCONS, start: T0 + 9000 }),
    ];
    const [s] = toSeries(games);
    expect(s.bestOf).toBe(5);
    expect(s.status).toBe("live");
    expect(s.winnerId).toBeNull();

    games.push(
      game({ seriesId: 104, seriesType: 2, radiant: FALCONS, dire: LGD, winner: LGD, start: T0 + 12000 }),
    );
    const [done] = toSeries(games);
    expect(done.scoreB).toBe(3);
    expect(done.winnerId).toBe(LGD);
    expect(done.status).toBe("completed");
  });

  it("awards the series to whoever reached the threshold FIRST if extra games appear", () => {
    // Falcons clinch in game 2. A stray third game must not flip the result.
    const [s] = toSeries([
      game({ seriesId: 105, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
      game({ seriesId: 105, radiant: LGD, dire: FALCONS, winner: FALCONS, start: T0 + 3000 }),
      game({ seriesId: 105, radiant: LGD, dire: FALCONS, winner: LGD, start: T0 + 6000 }),
    ]);
    expect(s.winnerId).toBe(FALCONS);
  });

  it("splits distinct series_ids and never merges them", () => {
    const out = toSeries([
      game({ seriesId: 200, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
      game({ seriesId: 201, radiant: LIQUID, dire: LGD, winner: LIQUID, start: T0 + 100 }),
      game({ seriesId: 200, radiant: LGD, dire: FALCONS, winner: FALCONS, start: T0 + 3000 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.id)).toEqual(["s-200", "s-201"]);
    expect(out[0].gameIds).toHaveLength(2);
  });

  it("does not collapse standalone games that carry series_id 0", () => {
    const out = toSeries([
      game({ seriesId: 0, seriesType: 0, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
      game({ seriesId: 0, seriesType: 0, radiant: LIQUID, dire: LGD, winner: LIQUID, start: T0 + 100 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.id.startsWith("g-"))).toBe(true);
    expect(out.every((s) => s.seriesId === undefined)).toBe(true);
  });

  it("keeps the canonical pair when a third team leaks into a series", () => {
    const out = toSeries([
      game({ seriesId: 300, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
      game({ seriesId: 300, radiant: LGD, dire: FALCONS, winner: LGD, start: T0 + 3000 }),
      game({ seriesId: 300, radiant: LIQUID, dire: LGD, winner: LIQUID, start: T0 + 6000 }),
    ]);
    const s = out[0];
    expect([s.a.teamId, s.b.teamId].sort()).toEqual([FALCONS, LGD].sort());
    // The intruding win is ignored rather than being allowed to decide anything.
    expect(s.scoreA + s.scoreB).toBe(2);
    expect(s.winnerId).toBeNull();
  });

  it("stores UTC ISO timestamps derived from the games, never a wall clock", () => {
    const [s] = toSeries([
      game({ seriesId: 400, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0, duration: 1800 }),
      game({ seriesId: 400, radiant: LGD, dire: FALCONS, winner: FALCONS, start: T0 + 3600, duration: 2400 }),
    ]);
    expect(s.startUtc).toBe(new Date(T0 * 1000).toISOString());
    expect(s.startUtc?.endsWith("Z")).toBe(true);
    expect(s.updatedUtc).toBe(new Date((T0 + 3600 + 2400) * 1000).toISOString());
  });

  it("is pure — repeated calls on the same input are identical", () => {
    const games = [
      game({ seriesId: 500, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
      game({ seriesId: 500, radiant: LGD, dire: FALCONS, winner: LGD, start: T0 + 3000 }),
      game({ seriesId: 501, radiant: LIQUID, dire: LGD, winner: LIQUID, start: T0 + 500 }),
    ];
    expect(toSeries(games)).toEqual(toSeries(games));
  });

  it("does not mutate its input", () => {
    const games = [
      game({ seriesId: 600, radiant: FALCONS, dire: LGD, winner: LGD, start: T0 + 3000 }),
      game({ seriesId: 600, radiant: LGD, dire: FALCONS, winner: LGD, start: T0 }),
    ];
    const snapshot = JSON.parse(JSON.stringify(games));
    toSeries(games);
    expect(games).toEqual(snapshot);
  });

  it("sorts output by start time, earliest first", () => {
    const out = toSeries([
      game({ seriesId: 700, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 + 10_000 }),
      game({ seriesId: 701, radiant: LIQUID, dire: LGD, winner: LIQUID, start: T0 }),
    ]);
    expect(out.map((s) => s.id)).toEqual(["s-701", "s-700"]);
  });

  it("never reads a team name off a match object", () => {
    // Every produced slot must be an id-only reference.
    const out = toSeries([
      game({ seriesId: 800, radiant: FALCONS, dire: LGD, winner: FALCONS, start: T0 }),
    ]);
    for (const s of out) {
      expect(s.a.kind).toBe("team");
      expect(typeof s.a.teamId).toBe("number");
      expect(s.a.label).toBeUndefined();
      expect(s.b.label).toBeUndefined();
    }
  });
});
