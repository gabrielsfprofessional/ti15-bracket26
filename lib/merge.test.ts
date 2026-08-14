import { describe, expect, it, vi } from "vitest";
import { getTeam, teamName, teamShort, unknownTeam } from "@/data/teams";
import { computeSwiss, mergeLive, mergeSchedule } from "./opendota";
import type { RawLive, ScheduleEntry, Series, TeamId } from "./types";

// Real ids from data/teams.ts — the merge layer joins on these.
const LIQUID: TeamId = 2163;
const SPIRIT: TeamId = 7119388;
const FALCONS: TeamId = 9247354;
const XG: TeamId = 8261500;

const HOUR = 3_600_000;
const NOW = Date.parse("2026-08-16T20:00:00Z");

function series(over: Partial<Series> = {}): Series {
  return {
    id: "s-1",
    section: "swiss",
    round: 0,
    roundLabel: "Group Stage",
    bestOf: 3,
    a: { kind: "team", teamId: LIQUID },
    b: { kind: "team", teamId: SPIRIT },
    scoreA: 1,
    scoreB: 1,
    status: "live",
    startUtc: "2026-08-16T16:00:00Z",
    winnerId: null,
    gameIds: [101, 102],
    source: "opendota",
    updatedUtc: "2026-08-16T18:00:00Z",
    ...over,
  };
}

function liveGame(over: Partial<RawLive> = {}): RawLive {
  return {
    league_id: 19719,
    match_id: "999",
    series_id: 1,
    game_time: 600,
    activate_time: Math.floor(NOW / 1000),
    deactivate_time: 0,
    last_update_time: Math.floor(NOW / 1000),
    spectators: 1000,
    team_id_radiant: LIQUID,
    team_id_dire: SPIRIT,
    team_name_radiant: null,
    team_name_dire: null,
    radiant_score: 22, // kills, never a series score
    dire_score: 18,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// C.2 — the stale LIVE badge
// ---------------------------------------------------------------------------

describe("C.2 live confirmation", () => {
  it("keeps LIVE when the live feed vouches for the series", () => {
    const out = mergeLive([series()], [liveGame({ match_id: "103", series_id: 1 })], NOW);
    expect(out.find((s) => s.id === "s-1")?.status).toBe("live");
  });

  it("keeps LIVE when the last game ended inside the 2h grace window", () => {
    // Feed is empty — OpenDota's /api/live is flaky — but the series ended 30
    // minutes ago, so it is plausibly still between games.
    const recent = series({ updatedUtc: new Date(NOW - 30 * 60_000).toISOString() });
    const out = mergeLive([recent], [], NOW);
    expect(out[0].status).toBe("live");
  });

  it("DEMOTES a 1-1 Bo3 whose last game ended six hours ago", () => {
    // The headline bug: toSeries has no clock, so it guesses "live" for any
    // undecided series. Six hours later that guess is a lie on the loudest
    // element of the page.
    const stale = series({ updatedUtc: new Date(NOW - 6 * HOUR).toISOString() });
    const out = mergeLive([stale], [], NOW);
    expect(out[0].status).toBe("unconfirmed");
    // The SCORE is not in doubt — only the liveness.
    expect(out[0].scoreA).toBe(1);
    expect(out[0].scoreB).toBe(1);
  });

  it("demotes exactly at the boundary and not one second before", () => {
    const justInside = series({ updatedUtc: new Date(NOW - 2 * HOUR).toISOString() });
    const justOutside = series({ updatedUtc: new Date(NOW - 2 * HOUR - 1000).toISOString() });
    expect(mergeLive([justInside], [], NOW)[0].status).toBe("live");
    expect(mergeLive([justOutside], [], NOW)[0].status).toBe("unconfirmed");
  });

  it("never demotes a completed series", () => {
    const done = series({ status: "completed", winnerId: LIQUID, scoreA: 2, scoreB: 1 });
    const out = mergeLive([done], [], NOW);
    expect(out[0].status).toBe("completed");
  });

  it("drops a live game whose match_id is already a completed game of the series", () => {
    // The live feed lags on removal. Without this the site invents a phantom
    // extra game of a series that is already over.
    const done = series({ status: "completed", winnerId: LIQUID, gameIds: [101, 102] });
    const out = mergeLive([done], [liveGame({ match_id: "102", series_id: 1 })], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("completed");
  });

  it("reads no series score from the live feed's kill counts", () => {
    const fresh = mergeLive([], [liveGame({ match_id: "500", series_id: 77 })], NOW);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].scoreA).toBe(0);
    expect(fresh[0].scoreB).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// C.3 — schedule row matching
// ---------------------------------------------------------------------------

function entry(over: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "r2-m1",
    section: "swiss",
    round: 2,
    roundLabel: "Round 2",
    bestOf: 3,
    aTeamId: LIQUID,
    bTeamId: SPIRIT,
    startUtc: "2026-08-16T16:00:00Z",
    ...over,
  };
}

describe("C.3 schedule matching", () => {
  it("retires a row once its match has been played", () => {
    const played = series({ id: "s-500", status: "completed", winnerId: LIQUID });
    const out = mergeSchedule([played], [entry()]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("s-500");
  });

  it("stamps the consumed row's id onto the series it was matched to", () => {
    const played = series({ id: "s-500", status: "completed", winnerId: LIQUID });
    const out = mergeSchedule([played], [entry({ id: "r2-m1" })]);
    expect(out[0].scheduleId).toBe("r2-m1");
  });

  it("keeps an Elimination Round rematch of the same two teams", () => {
    // THE regression this replaced the +/-12h scan for. The Elimination Round
    // re-pairs teams that already met in the group stage; a pair-only test would
    // let the group-stage series retire the upcoming rematch and the match would
    // disappear from the page.
    const groupStage = series({
      id: "s-500",
      status: "completed",
      winnerId: LIQUID,
      startUtc: "2026-08-14T16:00:00Z",
      updatedUtc: "2026-08-14T18:00:00Z",
    });
    const rematch = entry({
      id: "elim-1",
      section: "elimination",
      roundLabel: "Elimination Round",
      startUtc: "2026-08-16T16:00:00Z",
    });

    const out = mergeSchedule([groupStage], [entry({ id: "r1-m1", startUtc: "2026-08-14T16:00:00Z" }), rematch]);

    expect(out.map((s) => s.id).sort()).toEqual(["elim-1", "s-500"]);
    // The group-stage row was the one consumed, not the rematch.
    expect(out.find((s) => s.id === "s-500")?.scheduleId).toBe("r1-m1");
  });

  it("assigns one played series to at most one row, nearest start time first", () => {
    const early = series({ id: "s-1", startUtc: "2026-08-14T16:00:00Z", status: "completed", winnerId: LIQUID });
    const late = series({ id: "s-2", startUtc: "2026-08-16T16:00:00Z", status: "completed", winnerId: SPIRIT });

    const out = mergeSchedule(
      [early, late],
      [
        entry({ id: "a", startUtc: "2026-08-14T16:00:00Z" }),
        entry({ id: "b", startUtc: "2026-08-16T16:00:00Z" }),
      ],
    );

    expect(out).toHaveLength(2);
    expect(out.find((s) => s.id === "s-1")?.scheduleId).toBe("a");
    expect(out.find((s) => s.id === "s-2")?.scheduleId).toBe("b");
  });

  it("does not retire a row from a series that started well before it", () => {
    // Broadcasts run late, essentially never 3 days early.
    const old = series({ id: "s-9", startUtc: "2026-08-13T16:00:00Z", status: "completed", winnerId: LIQUID });
    const out = mergeSchedule([old], [entry({ startUtc: "2026-08-16T16:00:00Z" })]);
    expect(out).toHaveLength(2);
  });

  it("keeps a row whose match involves different teams", () => {
    const other = series({ id: "s-7", a: { kind: "team", teamId: FALCONS }, b: { kind: "team", teamId: XG } });
    const out = mergeSchedule([other], [entry()]);
    expect(out).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// C.5 — rows with an unknown matchup are still valid
// ---------------------------------------------------------------------------

describe("C.5 TBD schedule rows", () => {
  const tbd = entry({ id: "r5-m1", aTeamId: null, bTeamId: null, startUtc: "2026-08-16T02:00:00Z" });

  it("renders a row with a known time and unknown opponents", () => {
    // Swiss pairings are unpublished until the previous round ends. Knowing WHEN
    // is most of the value, so the row must survive.
    const out = mergeSchedule([], [tbd]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("tbd");
    expect(out[0].startUtc).toBe("2026-08-16T02:00:00Z");
    expect(out[0].a.kind).toBe("tbd");
    expect(out[0].b.kind).toBe("tbd");
  });

  it("never retires a TBD row against a played series", () => {
    const played = series({ id: "s-500", status: "completed", winnerId: LIQUID });
    const out = mergeSchedule([played], [tbd]);
    expect(out.map((s) => s.id).sort()).toEqual(["r5-m1", "s-500"]);
  });
});

// ---------------------------------------------------------------------------
// C.4 — team lookup never returns undefined
// ---------------------------------------------------------------------------

describe("C.4 team lookup", () => {
  it("resolves the 16 hardcoded teams", () => {
    expect(getTeam(LIQUID)?.name).toBe("Team Liquid");
    expect(teamShort(LIQUID)).toBe("TL");
  });

  it("returns a populated Unknown team for an id outside the 16, and logs loudly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = getTeam(123456789);

    expect(t).not.toBeUndefined();
    expect(t).not.toBeNull();
    expect(t?.name).toBe("Unknown (123456789)");
    expect(t?.short).toBe("???");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("carries an empty logo so nothing requests a 404 image", () => {
    expect(unknownTeam(42).logo).toBe("");
  });

  it("distinguishes 'no team yet' from 'team we cannot resolve'", () => {
    expect(getTeam(null)).toBeNull();
    expect(getTeam(undefined)).toBeNull();
    expect(teamName(null)).toBe("TBD");
  });

  it("never yields the string 'undefined' from any lookup", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const id of [null, undefined, 0, -1, 999999999] as (TeamId | null | undefined)[]) {
      expect(teamName(id)).not.toContain("undefined");
      expect(teamShort(id)).not.toContain("undefined");
    }
    warn.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// C.1 — Swiss fate
// ---------------------------------------------------------------------------

const ALL_16: TeamId[] = [
  9467224, 8255888, 9964962, 10149530, 10150413, 10150538, 10136357, 2586976, 9247354, 2163,
  5017210, 7119388, 9823272, 9572001, 726228, 8261500,
];

/**
 * A plausible full-field spread after 5 rounds: 5-0 x1, 4-1 x2, 3-2 x5,
 * 2-3 x5, 1-4 x2, 0-5 x1. Sums to 40 wins across 40 series, which is exactly
 * 16 teams x 5 rounds / 2 — the arithmetic a full-field Swiss has to satisfy.
 */
const SPREAD = [5, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 0];

/**
 * Build a completed 5-round group stage where ALL_16[i] finishes on SPREAD[i]
 * wins. Who played whom is fictional — computeSwiss only reads winner and loser
 * — but each team must end on exactly 5 played, since that is what gates fate
 * assignment. Built by pairing a bag of win slots against a bag of loss slots.
 */
function swissSeries(spread: number[]): Series[] {
  const winners: TeamId[] = [];
  const losers: TeamId[] = [];

  ALL_16.forEach((id, i) => {
    for (let w = 0; w < spread[i]; w++) winners.push(id);
    for (let l = 0; l < 5 - spread[i]; l++) losers.push(id);
  });

  // Reverse so the heaviest winners are drawn against the heaviest losers, which
  // keeps a team from being paired with itself.
  losers.reverse();
  for (let i = 0; i < winners.length; i++) {
    if (winners[i] !== losers[i]) continue;
    const j = (i + 1) % losers.length;
    [losers[i], losers[j]] = [losers[j], losers[i]];
  }

  return winners.map((winnerId, i) =>
    series({
      id: `f-${i}`,
      status: "completed",
      a: { kind: "team", teamId: winnerId },
      b: { kind: "team", teamId: losers[i] },
      winnerId,
    }),
  );
}

describe("C.1 Swiss fate", () => {
  it("leaves all 16 active before the fifth round completes", () => {
    const partial = series({ status: "completed", winnerId: LIQUID });
    const rows = computeSwiss([partial]);
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => r.state === "active")).toBe(true);
  });

  it("builds the intended spread — the fixture itself is load-bearing", () => {
    const rows = computeSwiss(swissSeries(SPREAD));
    expect(rows.map((r) => r.wins)).toEqual(SPREAD);
    expect(rows.every((r) => r.wins + r.losses === 5)).toBe(true);
  });

  it("assigns 3 / 10 / 3 once every team has played all five", () => {
    const rows = computeSwiss(swissSeries(SPREAD));
    const states = rows.map((r) => r.state);

    expect(states.filter((s) => s === "advanced")).toHaveLength(3);
    expect(states.filter((s) => s === "elimination_round")).toHaveLength(10);
    expect(states.filter((s) => s === "eliminated")).toHaveLength(3);
    // Ranks 1-3 advance, 14-16 are out. Nothing in between is ever "eliminated".
    expect(states.slice(0, 3).every((s) => s === "advanced")).toBe(true);
    expect(states.slice(13).every((s) => s === "eliminated")).toBe(true);
  });

  it("marks every derived fate provisional", () => {
    // Buchholz decides the real 3rd/4th and 13th/14th boundary and this does not
    // compute it, so nothing here may render as settled.
    const rows = computeSwiss(swissSeries(SPREAD));
    expect(rows.every((r) => r.provisional === true)).toBe(true);
  });

  it("sorts on W-L alone, descending", () => {
    const rows = computeSwiss(swissSeries(SPREAD));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].wins).toBeGreaterThanOrEqual(rows[i].wins);
    }
    expect(rows[0].wins).toBe(5);
    expect(rows[15].wins).toBe(0);
  });

  it("does not assign fate when a team is a round short", () => {
    // One team on 4 played is enough to hold the whole table at "active" —
    // greying out a live team is the worst error this site can make.
    const short = swissSeries(SPREAD).slice(0, -1);
    const rows = computeSwiss(short);
    expect(rows.every((r) => r.state === "active")).toBe(true);
    expect(rows.every((r) => r.provisional === undefined)).toBe(true);
  });

  it("counts a half-played Bo3 as nothing", () => {
    const undecided = series({ status: "unconfirmed", winnerId: null, scoreA: 1, scoreB: 1 });
    const rows = computeSwiss([undecided]);
    expect(rows.every((r) => r.wins === 0 && r.losses === 0)).toBe(true);
  });
});
