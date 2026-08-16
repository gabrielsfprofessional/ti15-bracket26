import type { Section, SlotRef, TeamId } from "@/lib/types";

/**
 * The released TI15 Main Event: eight teams, double elimination, 14 series.
 *
 * VERIFIED 2026-08-16 against Valve's league 19719 data (node group "Playoff",
 * nodes 14-27). `valveNodeId` is recorded on every row so the next person can
 * re-verify a single match without re-deriving the whole graph.
 *
 * This file is TOPOLOGY ONLY: who plays whom, in what order, at what official
 * time, and where each winner and loser goes. It carries no score, winner, or
 * status — those come from OpenDota and are reconciled onto these stable ids by
 * lib/bracket.ts. Keeping the two apart is what lets a played series update the
 * board without ever rewriting the graph it flows through.
 *
 * Every series is Bo3 except the Bo5 Grand Final, which has NO bracket reset:
 * Valve node 21 has no winning_node_id, so the upper-bracket team's one-series
 * advantage is the seeding itself, not a second final.
 */

export type BracketLane = Extract<Section, "upper" | "lower" | "grand_final">;

/** One column of the desktop board and one page of the mobile navigator. */
export interface BracketStage {
  key: string;
  lane: BracketLane;
  /** Heading inside its lane, which already supplies the Upper/Lower context. */
  label: string;
  /** Mobile navigator chip, kept short enough for a 320px row. */
  shortLabel: string;
  /** Chronological position across the whole bracket, 1-based. */
  order: number;
}

export interface BracketNode {
  id: string;
  valveNodeId: number;
  stage: string;
  /** Names this node in a dependency label: "Winner of Upper QF 1". */
  shortLabel: string;
  /** Series.roundLabel — also groups this node in Schedule and Results. */
  roundLabel: string;
  bestOf: 1 | 3 | 5;
  /** UTC ISO 8601, always. Shanghai (UTC+8) local times are never stored. */
  startUtc: string;
  a: SlotRef;
  b: SlotRef;
}

export const BRACKET_STAGES: BracketStage[] = [
  { key: "ub-qf", lane: "upper", label: "Quarterfinals", shortLabel: "Upper QF", order: 1 },
  { key: "lb-r1", lane: "lower", label: "Round 1", shortLabel: "Lower R1", order: 2 },
  { key: "ub-sf", lane: "upper", label: "Semifinals", shortLabel: "Upper SF", order: 3 },
  { key: "lb-qf", lane: "lower", label: "Quarterfinals", shortLabel: "Lower QF", order: 4 },
  { key: "ub-final", lane: "upper", label: "Upper Final", shortLabel: "Upper Final", order: 5 },
  { key: "lb-sf", lane: "lower", label: "Semifinal", shortLabel: "Lower SF", order: 6 },
  { key: "lb-final", lane: "lower", label: "Lower Final", shortLabel: "Lower Final", order: 7 },
  // The lane is already called "Grand Final"; the column says what it is.
  { key: "grand-final", lane: "grand_final", label: "Championship series", shortLabel: "Grand Final", order: 8 },
];

export const BRACKET_LANE_LABEL: Record<BracketLane, string> = {
  upper: "Upper Bracket",
  lower: "Lower Bracket",
  grand_final: "Grand Final",
};

/**
 * Human names for every node, declared before the graph so a dependency slot can
 * read "Winner of Upper QF 1" instead of "Winner of main-ub-qf1". An unresolved
 * slot has to say something a visitor can act on.
 */
const SHORT_LABEL: Record<string, string> = {
  "main-ub-qf1": "Upper QF 1",
  "main-ub-qf2": "Upper QF 2",
  "main-ub-qf3": "Upper QF 3",
  "main-ub-qf4": "Upper QF 4",
  // Kept terse: this name is also spliced into "Winner of ...", which has to fit
  // one line of a bracket column without truncating.
  "main-lb-r1-1": "Lower R1-1",
  "main-lb-r1-2": "Lower R1-2",
  "main-ub-sf1": "Upper SF 1",
  "main-ub-sf2": "Upper SF 2",
  "main-lb-qf1": "Lower QF 1",
  "main-lb-qf2": "Lower QF 2",
  "main-ub-final": "Upper Final",
  "main-lb-sf": "Lower SF",
  "main-lb-final": "Lower Final",
  "main-grand-final": "Grand Final",
};

function team(teamId: TeamId): SlotRef {
  return { kind: "team", teamId };
}

function winnerOf(matchId: string): SlotRef {
  return { kind: "winner_of", matchId, label: `Winner of ${SHORT_LABEL[matchId]}` };
}

function loserOf(matchId: string): SlotRef {
  return { kind: "loser_of", matchId, label: `Loser of ${SHORT_LABEL[matchId]}` };
}

const IRON_WING: TeamId = 10150413;
const TEAM_SPIRIT: TeamId = 7119388;
const TEAM_VISION: TeamId = 9572001;
const BOOMBOYS: TeamId = 8255888;
const TEAM_LIQUID: TeamId = 2163;
const TEAM_YANDEX: TeamId = 9823272;
const NIGMA_GALAXY: TeamId = 10136357;
const TEAM_FALCONS: TeamId = 9247354;

/**
 * Declared in official chronological order, which is also the display order.
 *
 * The node 24/25 crossing is Valve's and is deliberate, not a transcription
 * slip: lower quarterfinal 1 (node 25, the EARLIER slot) takes the loser of
 * upper semifinal 1 and the winner of lower round 1 match 2, while lower
 * quarterfinal 2 (node 24) takes the loser of upper semifinal 2 and the winner
 * of lower round 1 match 1. Crossing the halves this way stops two teams from
 * meeting twice in consecutive rounds. Do not "fix" it into a straight bracket.
 */
export const BRACKET_NODES: BracketNode[] = [
  {
    id: "main-ub-qf1",
    valveNodeId: 14,
    stage: "ub-qf",
    shortLabel: SHORT_LABEL["main-ub-qf1"],
    roundLabel: "Upper Quarterfinals",
    bestOf: 3,
    startUtc: "2026-08-20T02:00:00Z",
    a: team(IRON_WING),
    b: team(TEAM_SPIRIT),
  },
  {
    id: "main-ub-qf2",
    valveNodeId: 15,
    stage: "ub-qf",
    shortLabel: SHORT_LABEL["main-ub-qf2"],
    roundLabel: "Upper Quarterfinals",
    bestOf: 3,
    startUtc: "2026-08-20T05:00:00Z",
    a: team(TEAM_VISION),
    b: team(BOOMBOYS),
  },
  {
    id: "main-ub-qf3",
    valveNodeId: 16,
    stage: "ub-qf",
    shortLabel: SHORT_LABEL["main-ub-qf3"],
    roundLabel: "Upper Quarterfinals",
    bestOf: 3,
    startUtc: "2026-08-20T08:00:00Z",
    a: team(TEAM_LIQUID),
    b: team(TEAM_YANDEX),
  },
  {
    id: "main-ub-qf4",
    valveNodeId: 17,
    stage: "ub-qf",
    shortLabel: SHORT_LABEL["main-ub-qf4"],
    roundLabel: "Upper Quarterfinals",
    bestOf: 3,
    startUtc: "2026-08-20T11:00:00Z",
    a: team(NIGMA_GALAXY),
    b: team(TEAM_FALCONS),
  },
  {
    id: "main-lb-r1-1",
    valveNodeId: 22,
    stage: "lb-r1",
    shortLabel: SHORT_LABEL["main-lb-r1-1"],
    roundLabel: "Lower Round 1",
    bestOf: 3,
    startUtc: "2026-08-21T02:00:00Z",
    a: loserOf("main-ub-qf1"),
    b: loserOf("main-ub-qf2"),
  },
  {
    id: "main-lb-r1-2",
    valveNodeId: 23,
    stage: "lb-r1",
    shortLabel: SHORT_LABEL["main-lb-r1-2"],
    roundLabel: "Lower Round 1",
    bestOf: 3,
    startUtc: "2026-08-21T05:00:00Z",
    a: loserOf("main-ub-qf3"),
    b: loserOf("main-ub-qf4"),
  },
  {
    id: "main-ub-sf1",
    valveNodeId: 18,
    stage: "ub-sf",
    shortLabel: SHORT_LABEL["main-ub-sf1"],
    roundLabel: "Upper Semifinals",
    bestOf: 3,
    startUtc: "2026-08-21T08:00:00Z",
    a: winnerOf("main-ub-qf1"),
    b: winnerOf("main-ub-qf2"),
  },
  {
    id: "main-ub-sf2",
    valveNodeId: 19,
    stage: "ub-sf",
    shortLabel: SHORT_LABEL["main-ub-sf2"],
    roundLabel: "Upper Semifinals",
    bestOf: 3,
    startUtc: "2026-08-21T11:00:00Z",
    a: winnerOf("main-ub-qf3"),
    b: winnerOf("main-ub-qf4"),
  },
  {
    id: "main-lb-qf1",
    valveNodeId: 25,
    stage: "lb-qf",
    shortLabel: SHORT_LABEL["main-lb-qf1"],
    roundLabel: "Lower Quarterfinals",
    bestOf: 3,
    startUtc: "2026-08-22T02:00:00Z",
    a: loserOf("main-ub-sf1"),
    b: winnerOf("main-lb-r1-2"),
  },
  {
    id: "main-lb-qf2",
    valveNodeId: 24,
    stage: "lb-qf",
    shortLabel: SHORT_LABEL["main-lb-qf2"],
    roundLabel: "Lower Quarterfinals",
    bestOf: 3,
    startUtc: "2026-08-22T05:00:00Z",
    a: loserOf("main-ub-sf2"),
    b: winnerOf("main-lb-r1-1"),
  },
  {
    id: "main-ub-final",
    valveNodeId: 20,
    stage: "ub-final",
    shortLabel: SHORT_LABEL["main-ub-final"],
    roundLabel: "Upper Final",
    bestOf: 3,
    startUtc: "2026-08-22T08:00:00Z",
    a: winnerOf("main-ub-sf1"),
    b: winnerOf("main-ub-sf2"),
  },
  {
    id: "main-lb-sf",
    valveNodeId: 26,
    stage: "lb-sf",
    shortLabel: SHORT_LABEL["main-lb-sf"],
    roundLabel: "Lower Semifinal",
    bestOf: 3,
    startUtc: "2026-08-22T11:00:00Z",
    a: winnerOf("main-lb-qf1"),
    b: winnerOf("main-lb-qf2"),
  },
  {
    id: "main-lb-final",
    valveNodeId: 27,
    stage: "lb-final",
    shortLabel: SHORT_LABEL["main-lb-final"],
    roundLabel: "Lower Final",
    bestOf: 3,
    startUtc: "2026-08-23T02:00:00Z",
    a: loserOf("main-ub-final"),
    b: winnerOf("main-lb-sf"),
  },
  {
    id: "main-grand-final",
    valveNodeId: 21,
    stage: "grand-final",
    shortLabel: SHORT_LABEL["main-grand-final"],
    roundLabel: "Grand Final",
    bestOf: 5,
    startUtc: "2026-08-23T05:00:00Z",
    a: winnerOf("main-ub-final"),
    b: winnerOf("main-lb-final"),
  },
];

export const BRACKET_STAGE_BY_KEY: ReadonlyMap<string, BracketStage> = new Map(
  BRACKET_STAGES.map((stage) => [stage.key, stage]),
);

export const BRACKET_NODE_BY_ID: ReadonlyMap<string, BracketNode> = new Map(
  BRACKET_NODES.map((node) => [node.id, node]),
);

/** Declaration order is official chronological order; index doubles as rank. */
export const BRACKET_ORDER_BY_ID: ReadonlyMap<string, number> = new Map(
  BRACKET_NODES.map((node, index) => [node.id, index]),
);

export function bracketLaneOf(node: BracketNode): BracketLane {
  return BRACKET_STAGE_BY_KEY.get(node.stage)?.lane ?? "upper";
}
