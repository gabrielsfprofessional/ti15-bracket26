import { describe, expect, it } from "vitest";
import { resolve } from "./resolve";
import type { Section, Series, SlotRef, TeamId, Tournament } from "./types";

// A faked 8-team double-elimination bracket, played all the way to a champion.
const T1 = 101, T2 = 102, T3 = 103, T4 = 104, T5 = 105, T6 = 106, T7 = 107, T8 = 108;

const team = (id: TeamId): SlotRef => ({ kind: "team", teamId: id });
const winnerOf = (matchId: string): SlotRef => ({ kind: "winner_of", matchId });
const loserOf = (matchId: string): SlotRef => ({ kind: "loser_of", matchId });

function s(id: string, section: Section, a: SlotRef, b: SlotRef): Series {
  return {
    id,
    section,
    round: 1,
    roundLabel: id.toUpperCase(),
    bestOf: 3,
    a,
    b,
    scoreA: 0,
    scoreB: 0,
    status: a.kind === "team" && b.kind === "team" ? "scheduled" : "tbd",
    startUtc: null,
    winnerId: null,
    gameIds: [],
    source: "tbd",
    updatedUtc: "2026-08-20T00:00:00.000Z",
  };
}

function bracket(): Tournament {
  return {
    leagueId: 19719,
    teams: [],
    swiss: [],
    championId: null,
    lastSyncUtc: "2026-08-20T00:00:00.000Z",
    syncState: "ok",
    sourceHealth: {
      matches: { status: "ok", observedUtc: "2026-08-20T00:00:00.000Z" },
      live: { status: "ok", observedUtc: "2026-08-20T00:00:00.000Z" },
      schedule: { status: "managed", observedUtc: "2026-08-20T00:00:00.000Z" },
      snapshotGeneratedUtc: "2026-08-20T00:00:00.000Z",
      mode: "live",
    },
    series: [
      s("ub1", "upper", team(T1), team(T2)),
      s("ub2", "upper", team(T3), team(T4)),
      s("ub3", "upper", team(T5), team(T6)),
      s("ub4", "upper", team(T7), team(T8)),
      s("ub5", "upper", winnerOf("ub1"), winnerOf("ub2")),
      s("ub6", "upper", winnerOf("ub3"), winnerOf("ub4")),
      s("ub7", "upper", winnerOf("ub5"), winnerOf("ub6")),
      s("lb1", "lower", loserOf("ub1"), loserOf("ub2")),
      s("lb2", "lower", loserOf("ub3"), loserOf("ub4")),
      s("lb3", "lower", winnerOf("lb1"), loserOf("ub5")),
      s("lb4", "lower", winnerOf("lb2"), loserOf("ub6")),
      s("lb5", "lower", winnerOf("lb3"), winnerOf("lb4")),
      s("lb6", "lower", winnerOf("lb5"), loserOf("ub7")),
      s("gf", "grand_final", winnerOf("ub7"), winnerOf("lb6")),
    ],
  };
}

/** Record a result on one series without touching anything else. */
function play(t: Tournament, id: string, winnerId: TeamId): Tournament {
  return {
    ...t,
    series: t.series.map((x) =>
      x.id === id
        ? { ...x, status: "completed" as const, winnerId, scoreA: x.a.teamId === winnerId ? 2 : 0, scoreB: x.b.teamId === winnerId ? 2 : 0 }
        : x,
    ),
  };
}

const get = (t: Tournament, id: string) => t.series.find((x) => x.id === id)!;

describe("resolve", () => {
  it("leaves unresolvable references alone", () => {
    const out = resolve(bracket());
    expect(get(out, "ub5").a).toEqual({ kind: "winner_of", matchId: "ub1" });
    expect(get(out, "ub5").status).toBe("tbd");
    expect(out.championId).toBeNull();
  });

  it("keeps concrete first-round matchups untouched", () => {
    const out = resolve(bracket());
    expect(get(out, "ub1").a).toEqual(team(T1));
    expect(get(out, "ub1").b).toEqual(team(T2));
    expect(get(out, "ub1").status).toBe("scheduled");
  });

  it("fills winner_of and loser_of once the source completes", () => {
    let t = bracket();
    t = play(t, "ub1", T1);
    t = resolve(t);

    expect(get(t, "ub5").a).toEqual(team(T1)); // winner
    expect(get(t, "lb1").a).toEqual(team(T2)); // loser
    // The other half of each is still pending, so those matches stay TBD.
    expect(get(t, "ub5").b.kind).toBe("winner_of");
    expect(get(t, "ub5").status).toBe("tbd");
  });

  it("promotes a match to scheduled only when BOTH slots are concrete", () => {
    let t = bracket();
    t = resolve(play(t, "ub1", T1));
    expect(get(t, "ub5").status).toBe("tbd");

    t = resolve(play(t, "ub2", T3));
    expect(get(t, "ub5").a).toEqual(team(T1));
    expect(get(t, "ub5").b).toEqual(team(T3));
    expect(get(t, "ub5").status).toBe("scheduled");
  });

  it("propagates a chain of results in ONE call, not one round per call", () => {
    // Play three connected rounds, then resolve exactly once.
    let t = bracket();
    t = play(t, "ub1", T1);
    t = play(t, "ub2", T3);
    t = play(t, "ub5", T1);
    t = resolve(t);

    expect(get(t, "ub7").a).toEqual(team(T1)); // needed ub1+ub2 -> ub5 -> ub7
    expect(get(t, "lb3").b).toEqual(team(T3)); // loser of ub5, itself resolved this pass
  });

  it("plays a full bracket through to a champion", () => {
    let t = bracket();

    // Upper round 1
    t = resolve(play(t, "ub1", T1));
    t = resolve(play(t, "ub2", T3));
    t = resolve(play(t, "ub3", T5));
    t = resolve(play(t, "ub4", T7));

    expect(get(t, "lb1").a).toEqual(team(T2));
    expect(get(t, "lb1").b).toEqual(team(T4));
    expect(get(t, "lb2").a).toEqual(team(T6));
    expect(get(t, "lb2").b).toEqual(team(T8));

    // Upper semis
    t = resolve(play(t, "ub5", T1));
    t = resolve(play(t, "ub6", T5));
    // Lower round 1
    t = resolve(play(t, "lb1", T2));
    t = resolve(play(t, "lb2", T6));

    expect(get(t, "lb3").a).toEqual(team(T2));
    expect(get(t, "lb3").b).toEqual(team(T3)); // dropped from ub5
    expect(get(t, "lb4").b).toEqual(team(T7)); // dropped from ub6

    // Upper final
    t = resolve(play(t, "ub7", T1));
    expect(get(t, "gf").a).toEqual(team(T1));
    expect(get(t, "lb6").b).toEqual(team(T5)); // dropped from ub7

    // Lower run
    t = resolve(play(t, "lb3", T2));
    t = resolve(play(t, "lb4", T7));
    t = resolve(play(t, "lb5", T7));
    t = resolve(play(t, "lb6", T7));

    expect(get(t, "gf").b).toEqual(team(T7));
    expect(get(t, "gf").status).toBe("scheduled");
    expect(t.championId).toBeNull(); // final not played yet

    // Grand final
    t = resolve(play(t, "gf", T7));
    expect(t.championId).toBe(T7);
  });

  it("is idempotent at every stage", () => {
    let t = resolve(bracket());
    expect(resolve(t)).toEqual(t);

    t = resolve(play(t, "ub1", T1));
    expect(resolve(t)).toEqual(t);
    expect(resolve(resolve(t))).toEqual(resolve(t));

    t = resolve(play(t, "ub2", T3));
    t = resolve(play(t, "ub5", T1));
    t = resolve(play(t, "ub6", T5));
    t = resolve(play(t, "ub3", T5));
    t = resolve(play(t, "ub4", T7));
    t = resolve(play(t, "ub7", T1));
    t = resolve(play(t, "lb1", T2));
    t = resolve(play(t, "lb2", T6));
    t = resolve(play(t, "lb3", T2));
    t = resolve(play(t, "lb4", T7));
    t = resolve(play(t, "lb5", T7));
    t = resolve(play(t, "lb6", T7));
    t = resolve(play(t, "gf", T7));
    expect(resolve(t)).toEqual(t);
  });

  it("does not mutate its input", () => {
    const t = play(bracket(), "ub1", T1);
    const snapshot = JSON.parse(JSON.stringify(t));
    resolve(t);
    expect(t).toEqual(snapshot);
  });

  it("preserves a manually overridden champion when there is no grand final", () => {
    const groupStageOnly: Tournament = {
      ...bracket(),
      championId: T4,
      series: bracket().series.filter((x) => x.section !== "grand_final"),
    };
    expect(resolve(groupStageOnly).championId).toBe(T4);
  });

  it("terminates on a hand-authored cycle instead of hanging", () => {
    const cyclic: Tournament = {
      ...bracket(),
      series: [
        s("x", "upper", winnerOf("y"), team(T1)),
        s("y", "upper", winnerOf("x"), team(T2)),
      ],
    };
    const out = resolve(cyclic);
    expect(get(out, "x").a.kind).toBe("winner_of");
    expect(get(out, "y").a.kind).toBe("winner_of");
  });
});
