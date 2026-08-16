import {
  BRACKET_LANE_LABEL,
  BRACKET_NODE_BY_ID,
  BRACKET_NODES,
  BRACKET_ORDER_BY_ID,
  BRACKET_STAGE_BY_KEY,
  BRACKET_STAGES,
  type BracketLane,
} from "@/data/bracket-topology";
import { SERIES_STATUS_LABEL, slotText } from "./series-text";
import type { Series } from "./types";

/**
 * Turns the flat reconciled series list into the shape the bracket renders from:
 * lanes and stages for the desktop board, an ordered stage list for the mobile
 * navigator, and one linear dependency list that carries the whole structure as
 * text. PURE, so the JSX stays a projection of it rather than a second model.
 */

export interface BracketMatchView {
  id: string;
  series: Series;
  /** "Upper QF 1" — names this match in a dependency sentence. */
  label: string;
  /** Bracket-specific DOM id, so a match shown here and in Results is unique. */
  anchorId: string;
  aText: string;
  bText: string;
  statusText: string;
  isLive: boolean;
  isDecided: boolean;
  /** "Winner advances to Upper SF 1", "Loser drops to Lower R1-1". */
  paths: string[];
}

export interface BracketStageView {
  key: string;
  lane: BracketLane;
  label: string;
  shortLabel: string;
  order: number;
  matches: BracketMatchView[];
}

export interface BracketLaneView {
  lane: BracketLane;
  label: string;
  stages: BracketStageView[];
}

export interface BracketView {
  hasBracket: boolean;
  /** Chronological. This is the mobile navigator's page order. */
  stages: BracketStageView[];
  lanes: BracketLaneView[];
  linear: BracketMatchView[];
}

const LANE_ORDER: BracketLane[] = ["upper", "lower", "grand_final"];

/**
 * Which node each match feeds, precomputed from the topology alone. It never
 * depends on results, so an unplayed bracket still explains where a win goes.
 */
const PATHS_BY_NODE = buildPaths();

/** Bracket anchors are stage-scoped, so the navigator can jump to a deep link. */
export const STAGE_BY_ANCHOR: ReadonlyMap<string, string> = new Map(
  BRACKET_NODES.map((node) => [anchorFor(node.id), node.stage]),
);

export function anchorFor(seriesId: string): string {
  return `bracket-${seriesId}`;
}

export function buildBracketView(series: Series[]): BracketView {
  const matches = series
    .filter((item) => BRACKET_NODE_BY_ID.has(item.id))
    .sort(
      (x, y) =>
        (BRACKET_ORDER_BY_ID.get(x.id) ?? 0) - (BRACKET_ORDER_BY_ID.get(y.id) ?? 0) ||
        x.id.localeCompare(y.id),
    )
    .map(toMatchView);

  const byStage = new Map<string, BracketMatchView[]>();
  for (const match of matches) {
    const stageKey = BRACKET_NODE_BY_ID.get(match.id)?.stage;
    if (!stageKey) continue;
    const bucket = byStage.get(stageKey) ?? [];
    bucket.push(match);
    byStage.set(stageKey, bucket);
  }

  const stages: BracketStageView[] = BRACKET_STAGES.filter((stage) => byStage.has(stage.key))
    .sort((x, y) => x.order - y.order)
    .map((stage) => ({
      key: stage.key,
      lane: stage.lane,
      label: stage.label,
      shortLabel: stage.shortLabel,
      order: stage.order,
      matches: byStage.get(stage.key) ?? [],
    }));

  const lanes: BracketLaneView[] = LANE_ORDER.map((lane) => ({
    lane,
    label: BRACKET_LANE_LABEL[lane],
    stages: stages.filter((stage) => stage.lane === lane),
  })).filter((lane) => lane.stages.length > 0);

  return { hasBracket: matches.length > 0, stages, lanes, linear: matches };
}

/**
 * The stage a visitor should land on: whatever is happening now, else the next
 * thing to happen, else the last thing that did. Derived from status only, never
 * from the clock, so the server and the browser agree on the first render.
 */
export function defaultStageKey(view: BracketView): string {
  if (view.stages.length === 0) return "";
  const live = view.stages.find((stage) => stage.matches.some((match) => match.isLive));
  if (live) return live.key;
  const open = view.stages.find((stage) => stage.matches.some((match) => !match.isDecided));
  return (open ?? view.stages[view.stages.length - 1]).key;
}

function toMatchView(item: Series): BracketMatchView {
  const node = BRACKET_NODE_BY_ID.get(item.id);
  return {
    id: item.id,
    series: item,
    label: node?.shortLabel ?? item.roundLabel,
    anchorId: anchorFor(item.id),
    aText: slotText(item.a),
    bText: slotText(item.b),
    statusText: statusTextFor(item),
    isLive: item.status === "live",
    isDecided: item.status === "completed" && item.winnerId != null,
    paths: PATHS_BY_NODE.get(item.id) ?? [],
  };
}

/**
 * "Matchup TBD" is true but useless on a bracket node, where the interesting
 * fact is how much of the pairing is still missing. Which match it is waiting on
 * is already named on the team lines themselves, so the status does not repeat
 * it — that sentence would not fit a bracket column, and the linear list carries
 * the full dependency anyway.
 */
function statusTextFor(item: Series): string {
  if (item.status !== "tbd") return SERIES_STATUS_LABEL[item.status];
  const waiting = [item.a, item.b].filter((slot) => slot.kind !== "team").length;
  if (waiting === 2) return "Awaiting both teams";
  if (waiting === 1) return "Awaiting opponent";
  return SERIES_STATUS_LABEL.tbd;
}

function buildPaths(): ReadonlyMap<string, string[]> {
  const paths = new Map<string, string[]>();
  for (const node of BRACKET_NODES) {
    for (const slot of [node.a, node.b]) {
      if (!slot.matchId) continue;
      const lane = BRACKET_STAGE_BY_KEY.get(node.stage)?.lane;
      const verb =
        slot.kind === "winner_of"
          ? lane === "grand_final"
            ? "Winner plays the"
            : "Winner advances to"
          : "Loser drops to";
      const bucket = paths.get(slot.matchId) ?? [];
      bucket.push(`${verb} ${node.shortLabel}`);
      paths.set(slot.matchId, bucket);
    }
  }
  // The terminal node has no outgoing edge; say what winning it is worth.
  for (const node of BRACKET_NODES) {
    if (!paths.has(node.id)) paths.set(node.id, ["Winner is the TI15 champion"]);
  }
  return paths;
}
