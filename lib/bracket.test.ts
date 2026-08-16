import { describe, expect, it } from "vitest";
import {
  BRACKET_NODES,
  BRACKET_NODE_BY_ID,
  BRACKET_STAGE_BY_KEY,
  bracketLaneOf,
  type BracketNode,
} from "@/data/bracket-topology";
import { TEAM_BY_ID } from "@/data/teams";
import { bracketNodeSeries, mergeBracket, validateBracketTopology } from "./bracket";
import { resolve } from "./resolve";
import type { Series, TeamId, Tournament } from "./types";

const IRON_WING: TeamId = 10150413;
const SPIRIT: TeamId = 7119388;
const VISION: TeamId = 9572001;
const BOOMBOYS: TeamId = 8255888;
const LIQUID: TeamId = 2163;
const YANDEX: TeamId = 9823272;
const NIGMA: TeamId = 10136357;
const FALCONS: TeamId = 9247354;

const QF_TEAMS: TeamId[] = [IRON_WING, SPIRIT, VISION, BOOMBOYS, LIQUID, YANDEX, NIGMA, FALCONS];

/** A completed OpenDota series exactly as toSeries + mergeLive would hand it over. */
function played(over: Partial<Series> = {}): Series {
  return {
    id: "s-2000",
    seriesId: 2000,
    section: "swiss",
    round: 0,
    roundLabel: "Group Stage",
    bestOf: 3,
    a: { kind: "team", teamId: IRON_WING },
    b: { kind: "team", teamId: SPIRIT },
    scoreA: 2,
    scoreB: 0,
    status: "completed",
    startUtc: "2026-08-20T02:10:00.000Z",
    winnerId: IRON_WING,
    gameIds: [1, 2],
    source: "opendota",
    updatedUtc: "2026-08-20T04:00:00.000Z",
    ...over,
  };
}

function nodeOf(series: Series[], id: string): Series {
  const found = series.find((item) => item.id === id);
  if (!found) throw new Error(`missing bracket node ${id}`);
  return found;
}

function teamsOf(item: Series): TeamId[] {
  return [item.a.teamId, item.b.teamId].filter((id): id is TeamId => id != null);
}

/**
 * Play the whole bracket. `pick` chooses a winner from the two concrete
 * participants of a node, so a test can drive any outcome — including an upper
 * final loser winning the tournament — without hand-writing 14 fixtures.
 */
function simulate(pick: (node: Series, teams: TeamId[]) => TeamId): Series[] {
  let series: Series[] = [];
  for (let round = 0; round < BRACKET_NODES.length + 1; round++) {
    const merged = mergeBracket(series);
    const next = merged.find(
      (item) => BRACKET_NODE_BY_ID.has(item.id) && item.status === "scheduled",
    );
    if (!next) return merged;

    const teams = teamsOf(next);
    const winner = pick(next, teams);
    const loser = teams.find((id) => id !== winner) as TeamId;
    const node = BRACKET_NODE_BY_ID.get(next.id) as BracketNode;
    const need = node.bestOf === 5 ? 3 : 2;
    series = [
      ...series,
      played({
        id: `s-${3000 + round}`,
        seriesId: 3000 + round,
        bestOf: node.bestOf,
        a: { kind: "team", teamId: winner },
        b: { kind: "team", teamId: loser },
        scoreA: need,
        scoreB: 0,
        winnerId: winner,
        startUtc: node.startUtc,
        updatedUtc: node.startUtc,
        gameIds: Array.from({ length: need }, (_, i) => round * 10 + i + 1),
      }),
    ];
  }
  throw new Error("simulation did not terminate");
}

function championOf(series: Series[]): TeamId | null {
  const tournament = { series, championId: null } as unknown as Tournament;
  return resolve(tournament).championId;
}

// ---------------------------------------------------------------------------
// The checked-in graph itself
// ---------------------------------------------------------------------------

describe("Main Event topology", () => {
  it("passes its own structural validation", () => {
    expect(validateBracketTopology()).toEqual([]);
  });

  it("has exactly 14 unique nodes with unique Valve node ids", () => {
    expect(BRACKET_NODES).toHaveLength(14);
    expect(new Set(BRACKET_NODES.map((node) => node.id)).size).toBe(14);
    expect(new Set(BRACKET_NODES.map((node) => node.valveNodeId)).size).toBe(14);
  });

  it("is 13 Bo3s and one Bo5 grand final, with no bracket reset", () => {
    expect(BRACKET_NODES.filter((node) => node.bestOf === 3)).toHaveLength(13);
    const bo5 = BRACKET_NODES.filter((node) => node.bestOf === 5);
    expect(bo5.map((node) => node.id)).toEqual(["main-grand-final"]);
    expect(bracketLaneOf(bo5[0])).toBe("grand_final");
    // A reset would mean something depends on the grand final.
    const referenced = BRACKET_NODES.flatMap((node) => [node.a.matchId, node.b.matchId]);
    expect(referenced).not.toContain("main-grand-final");
  });

  it("starts from exactly four concrete quarterfinals between the eight qualifiers", () => {
    const concrete = BRACKET_NODES.filter(
      (node) => node.a.kind === "team" && node.b.kind === "team",
    );
    expect(concrete.map((node) => node.id)).toEqual([
      "main-ub-qf1",
      "main-ub-qf2",
      "main-ub-qf3",
      "main-ub-qf4",
    ]);
    const field = concrete.flatMap((node) => [node.a.teamId, node.b.teamId]);
    expect(new Set(field).size).toBe(8);
    expect([...field].sort()).toEqual([...QF_TEAMS].sort());
    for (const id of field) expect(TEAM_BY_ID.has(id as TeamId)).toBe(true);
  });

  it("records the exact official start times as canonical UTC", () => {
    const times = Object.fromEntries(BRACKET_NODES.map((node) => [node.id, node.startUtc]));
    expect(times).toEqual({
      "main-ub-qf1": "2026-08-20T02:00:00Z",
      "main-ub-qf2": "2026-08-20T05:00:00Z",
      "main-ub-qf3": "2026-08-20T08:00:00Z",
      "main-ub-qf4": "2026-08-20T11:00:00Z",
      "main-lb-r1-1": "2026-08-21T02:00:00Z",
      "main-lb-r1-2": "2026-08-21T05:00:00Z",
      "main-ub-sf1": "2026-08-21T08:00:00Z",
      "main-ub-sf2": "2026-08-21T11:00:00Z",
      "main-lb-qf1": "2026-08-22T02:00:00Z",
      "main-lb-qf2": "2026-08-22T05:00:00Z",
      "main-ub-final": "2026-08-22T08:00:00Z",
      "main-lb-sf": "2026-08-22T11:00:00Z",
      "main-lb-final": "2026-08-23T02:00:00Z",
      "main-grand-final": "2026-08-23T05:00:00Z",
    });
  });

  it("encodes the exact official pairings for the quarterfinals", () => {
    const pairs = BRACKET_NODES.filter((node) => node.a.kind === "team").map((node) => [
      node.valveNodeId,
      node.a.teamId,
      node.b.teamId,
    ]);
    expect(pairs).toEqual([
      [14, IRON_WING, SPIRIT],
      [15, VISION, BOOMBOYS],
      [16, LIQUID, YANDEX],
      [17, NIGMA, FALCONS],
    ]);
  });

  it("encodes the exact winner/loser dependency map", () => {
    const edges = Object.fromEntries(
      BRACKET_NODES.filter((node) => node.a.kind !== "team").map((node) => [
        node.id,
        [`${node.a.kind}:${node.a.matchId}`, `${node.b.kind}:${node.b.matchId}`],
      ]),
    );
    expect(edges).toEqual({
      "main-lb-r1-1": ["loser_of:main-ub-qf1", "loser_of:main-ub-qf2"],
      "main-lb-r1-2": ["loser_of:main-ub-qf3", "loser_of:main-ub-qf4"],
      "main-ub-sf1": ["winner_of:main-ub-qf1", "winner_of:main-ub-qf2"],
      "main-ub-sf2": ["winner_of:main-ub-qf3", "winner_of:main-ub-qf4"],
      "main-lb-qf1": ["loser_of:main-ub-sf1", "winner_of:main-lb-r1-2"],
      "main-lb-qf2": ["loser_of:main-ub-sf2", "winner_of:main-lb-r1-1"],
      "main-ub-final": ["winner_of:main-ub-sf1", "winner_of:main-ub-sf2"],
      "main-lb-sf": ["winner_of:main-lb-qf1", "winner_of:main-lb-qf2"],
      "main-lb-final": ["loser_of:main-ub-final", "winner_of:main-lb-sf"],
      "main-grand-final": ["winner_of:main-ub-final", "winner_of:main-lb-final"],
    });
  });

  it("keeps Valve's node 24/25 crossing rather than a straight bracket", () => {
    const qf1 = BRACKET_NODE_BY_ID.get("main-lb-qf1") as BracketNode;
    const qf2 = BRACKET_NODE_BY_ID.get("main-lb-qf2") as BracketNode;
    // The EARLIER lower quarterfinal is Valve node 25 and takes the winner of
    // lower round 1 match 2 — the halves cross.
    expect(qf1.valveNodeId).toBe(25);
    expect(qf1.b.matchId).toBe("main-lb-r1-2");
    expect(qf2.valveNodeId).toBe(24);
    expect(qf2.b.matchId).toBe("main-lb-r1-1");
    expect(Date.parse(qf1.startUtc)).toBeLessThan(Date.parse(qf2.startUtc));
  });

  it("gives every unresolved slot a label a visitor can read", () => {
    const labels = BRACKET_NODES.flatMap((node) => [node.a, node.b])
      .filter((slot) => slot.kind !== "team")
      .map((slot) => slot.label);
    expect(labels).toContain("Winner of Upper QF 1");
    expect(labels).toContain("Loser of Upper SF 2");
    expect(labels.every((label) => /^(Winner|Loser) of \S/.test(label ?? ""))).toBe(true);
  });

  it("rejects a dangling reference, a cycle, and a second terminal node", () => {
    const base = BRACKET_NODES.slice(0, 5);
    const dangling: BracketNode[] = [
      { ...base[4], a: { kind: "winner_of", matchId: "nope", label: "Winner of nothing" } },
      ...base.slice(0, 4),
    ];
    expect(validateBracketTopology(dangling).join(" ")).toContain("dangling_reference");

    const cyclic: BracketNode[] = [
      { ...base[0], a: { kind: "winner_of", matchId: base[1].id, label: "Winner of B" } },
      { ...base[1], a: { kind: "winner_of", matchId: base[0].id, label: "Winner of A" } },
    ];
    expect(validateBracketTopology(cyclic).join(" ")).toContain("cycle");

    const twoTerminals = BRACKET_NODES.filter((node) => node.id !== "main-lb-final");
    expect(validateBracketTopology(twoTerminals).join(" ")).toContain("terminal");
  });
});

// ---------------------------------------------------------------------------
// Reconciliation onto stable ids
// ---------------------------------------------------------------------------

describe("bracket reconciliation", () => {
  it("publishes all 14 nodes with four scheduled quarterfinals before any play", () => {
    const merged = mergeBracket([]);
    expect(merged).toHaveLength(14);
    expect(merged.filter((item) => item.status === "scheduled")).toHaveLength(4);
    expect(merged.filter((item) => item.status === "tbd")).toHaveLength(10);
    expect(merged.every((item) => item.winnerId === null)).toBe(true);
  });

  it("keeps the stable topology id after a claim so downstream slots still resolve", () => {
    const merged = mergeBracket([played()]);
    const qf1 = nodeOf(merged, "main-ub-qf1");
    expect(qf1.id).toBe("main-ub-qf1");
    expect(qf1.seriesId).toBe(2000);
    expect(qf1.status).toBe("completed");
    expect(qf1.winnerId).toBe(IRON_WING);
    expect(qf1.gameIds).toEqual([1, 2]);
    // The winner and the loser both flowed onward.
    expect(nodeOf(merged, "main-ub-sf1").a).toEqual({ kind: "team", teamId: IRON_WING });
    expect(nodeOf(merged, "main-lb-r1-1").a).toEqual({ kind: "team", teamId: SPIRIT });
  });

  it("removes the claimed raw series so no match is published twice", () => {
    const merged = mergeBracket([played()]);
    expect(merged.some((item) => item.id === "s-2000")).toBe(false);
    const providerIds = merged.map((item) => item.seriesId).filter((id) => id != null);
    expect(providerIds).toHaveLength(new Set(providerIds).size);
  });

  it("matches on unordered team ids, so a side swap still claims", () => {
    const swapped = played({
      a: { kind: "team", teamId: SPIRIT },
      b: { kind: "team", teamId: IRON_WING },
      scoreA: 0,
      scoreB: 2,
    });
    const qf1 = nodeOf(mergeBracket([swapped]), "main-ub-qf1");
    // Topology slot order is preserved and the score follows it.
    expect(qf1.a.teamId).toBe(IRON_WING);
    expect(qf1.scoreA).toBe(2);
    expect(qf1.scoreB).toBe(0);
    expect(qf1.winnerId).toBe(IRON_WING);
  });

  it("claims a broadcast that started late and refuses one that started early", () => {
    const late = played({ startUtc: "2026-08-20T13:00:00.000Z" });
    expect(nodeOf(mergeBracket([late]), "main-ub-qf1").status).toBe("completed");

    const early = played({ startUtc: "2026-08-19T20:00:00.000Z" });
    const merged = mergeBracket([early]);
    expect(nodeOf(merged, "main-ub-qf1").status).toBe("scheduled");
    expect(merged.some((item) => item.id === "s-2000")).toBe(true);
  });

  it("leaves an unrelated series alone and publishes it unchanged", () => {
    const unrelated = played({
      id: "s-9",
      seriesId: 9,
      a: { kind: "team", teamId: LIQUID },
      b: { kind: "team", teamId: SPIRIT },
      winnerId: LIQUID,
      startUtc: "2026-08-14T02:00:00.000Z",
    });
    const merged = mergeBracket([unrelated]);
    expect(merged.find((item) => item.id === "s-9")).toEqual(unrelated);
    expect(merged.filter((item) => BRACKET_NODE_BY_ID.has(item.id))).toHaveLength(14);
  });

  it("never claims a series a checked-in schedule row already owns", () => {
    const owned = played({ scheduleId: "swiss-r5-3-1-a" });
    const merged = mergeBracket([owned]);
    expect(nodeOf(merged, "main-ub-qf1").status).toBe("scheduled");
    expect(merged.some((item) => item.id === "s-2000")).toBe(true);
  });

  it("claims each raw series and each node at most once on a rematch", () => {
    // The same two teams, twice, inside the same slot's window.
    const first = played({ id: "s-1", seriesId: 1, startUtc: "2026-08-20T02:05:00.000Z" });
    const second = played({ id: "s-2", seriesId: 2, startUtc: "2026-08-20T06:00:00.000Z" });
    const merged = mergeBracket([first, second]);

    const qf1 = nodeOf(merged, "main-ub-qf1");
    expect(qf1.seriesId).toBe(1); // nearest official time wins
    // The extra series is not swallowed; it stays visible as its own row.
    expect(merged.some((item) => item.id === "s-2")).toBe(true);
    expect(merged.filter((item) => item.seriesId === 1)).toHaveLength(1);
  });

  it("promotes a scheduled node to live and then to completed without changing its id", () => {
    const live = played({
      status: "live",
      scoreA: 1,
      scoreB: 0,
      winnerId: null,
      gameIds: [1],
      source: "live",
      liveGame: {
        gameNumber: 2,
        radiantTeamId: SPIRIT,
        direTeamId: IRON_WING,
        radiantKills: 12,
        direKills: 19,
        gameTimeSeconds: 1500,
        observedUtc: "2026-08-20T03:00:00.000Z",
      },
    });
    const running = nodeOf(mergeBracket([live]), "main-ub-qf1");
    expect(running.id).toBe("main-ub-qf1");
    expect(running.status).toBe("live");
    expect(running.scoreA).toBe(1);
    expect(running.liveGame?.gameNumber).toBe(2);
    // A live node has not resolved anything downstream yet.
    expect(nodeOf(mergeBracket([live]), "main-ub-sf1").a.kind).toBe("winner_of");

    const finished = nodeOf(mergeBracket([played()]), "main-ub-qf1");
    expect(finished.id).toBe(running.id);
    expect(finished.status).toBe("completed");
  });

  it("is idempotent: merging an already-merged list changes nothing", () => {
    const once = mergeBracket([played()]);
    const twice = mergeBracket(once);
    expect(twice).toEqual(once);
  });

  it("resolves a whole chain of results in a single pass", () => {
    const results = [
      played({ id: "s-a", seriesId: 10, winnerId: IRON_WING, startUtc: "2026-08-20T02:00:00.000Z" }),
      played({
        id: "s-b",
        seriesId: 11,
        a: { kind: "team", teamId: VISION },
        b: { kind: "team", teamId: BOOMBOYS },
        winnerId: VISION,
        startUtc: "2026-08-20T05:00:00.000Z",
      }),
      played({
        id: "s-c",
        seriesId: 12,
        a: { kind: "team", teamId: IRON_WING },
        b: { kind: "team", teamId: VISION },
        winnerId: VISION,
        startUtc: "2026-08-21T08:00:00.000Z",
      }),
    ];
    const merged = mergeBracket(results);
    // QF -> SF resolved AND played, and the SF loser dropped into the lower half.
    expect(nodeOf(merged, "main-ub-sf1").winnerId).toBe(VISION);
    expect(nodeOf(merged, "main-ub-final").a).toEqual({ kind: "team", teamId: VISION });
    expect(nodeOf(merged, "main-lb-qf1").a).toEqual({ kind: "team", teamId: IRON_WING });
    expect(nodeOf(merged, "main-lb-r1-1").a).toEqual({ kind: "team", teamId: SPIRIT });
  });
});

// ---------------------------------------------------------------------------
// Whole-tournament propagation
// ---------------------------------------------------------------------------

describe("complete bracket simulation", () => {
  it("plays all 14 series and crowns the grand final winner", () => {
    const series = simulate((_node, teams) => teams[0]);
    const nodes = series.filter((item) => BRACKET_NODE_BY_ID.has(item.id));
    expect(nodes).toHaveLength(14);
    expect(nodes.every((item) => item.status === "completed")).toBe(true);
    expect(nodes.every((item) => item.a.kind === "team" && item.b.kind === "team")).toBe(true);
    expect(championOf(series)).toBe(nodeOf(series, "main-grand-final").winnerId);
    expect(championOf(series)).not.toBeNull();
  });

  it("lets the upper-final loser run the lower bracket and win the title", () => {
    // The upper final loser is the only team that can reach the grand final
    // through the lower final, so picking it every time afterwards proves the
    // long path resolves.
    let upperFinalLoser: TeamId | null = null;
    const series = simulate((node, teams) => {
      if (node.id === "main-ub-final") {
        upperFinalLoser = teams[1];
        return teams[0];
      }
      if (upperFinalLoser != null && teams.includes(upperFinalLoser)) return upperFinalLoser;
      return teams[0];
    });

    expect(upperFinalLoser).not.toBeNull();
    expect(nodeOf(series, "main-lb-final").winnerId).toBe(upperFinalLoser);
    expect(championOf(series)).toBe(upperFinalLoser);
  });

  it("lets a quarterfinal loser make the full lower-bracket run to the final", () => {
    let qf1Loser: TeamId | null = null;
    const series = simulate((node, teams) => {
      if (node.id === "main-ub-qf1") {
        qf1Loser = teams[1];
        return teams[0];
      }
      if (qf1Loser != null && teams.includes(qf1Loser)) return qf1Loser;
      return teams[0];
    });

    const journey = ["main-lb-r1-1", "main-lb-qf2", "main-lb-sf", "main-lb-final"];
    for (const id of journey) expect(nodeOf(series, id).winnerId).toBe(qf1Loser);
    expect(teamsOf(nodeOf(series, "main-grand-final"))).toContain(qf1Loser);
    expect(championOf(series)).toBe(qf1Loser);
  });

  it("gives every one of the eight qualifiers a real path onto the board", () => {
    const series = simulate((_node, teams) => teams[0]);
    const appeared = new Set(
      series.filter((item) => BRACKET_NODE_BY_ID.has(item.id)).flatMap(teamsOf),
    );
    expect([...appeared].sort()).toEqual([...QF_TEAMS].sort());
  });
});

describe("instantiated bracket nodes", () => {
  it("carries the topology's stage, round label, format and official time", () => {
    const nodes = bracketNodeSeries();
    expect(nodes).toHaveLength(14);
    for (const node of nodes) {
      const source = BRACKET_NODE_BY_ID.get(node.id) as BracketNode;
      expect(node.section).toBe(bracketLaneOf(source));
      expect(node.roundLabel).toBe(source.roundLabel);
      expect(node.bestOf).toBe(source.bestOf);
      expect(node.startUtc).toBe(source.startUtc);
      expect(node.round).toBe(BRACKET_STAGE_BY_KEY.get(source.stage)?.order);
      expect(node.scoreA).toBe(0);
      expect(node.scoreB).toBe(0);
      expect(node.winnerId).toBeNull();
    }
  });

  it("never invents a team for an unresolved slot", () => {
    for (const node of bracketNodeSeries()) {
      for (const slot of [node.a, node.b]) {
        if (slot.kind !== "team") expect(slot.teamId).toBeUndefined();
      }
    }
  });
});
