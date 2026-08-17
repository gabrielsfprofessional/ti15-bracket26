import {
  BRACKET_NODES,
  BRACKET_ORDER_BY_ID,
  BRACKET_STAGE_BY_KEY,
  bracketLaneOf,
  type BracketNode,
} from "@/data/bracket-topology";
import { TEAM_BY_ID } from "@/data/teams";
import { claimNearestSeries } from "./claim";
import { resolveSeries } from "./resolve";
import { winsNeeded } from "./series";
import type { OverridesFile, Series, TeamId } from "./types";

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * Instantiate the checked-in topology as Series, with no result attached.
 *
 * PURE. Every node keeps its STABLE id — `main-ub-sf1`, never `s-1131234` — for
 * the whole life of the tournament, because that id is what `winner_of` and
 * `loser_of` slots downstream point at. A node that renamed itself to the raw
 * OpenDota series id the moment it was played would sever every dependency that
 * had not resolved yet.
 */
export function bracketNodeSeries(nodes: BracketNode[] = BRACKET_NODES): Series[] {
  return nodes.map((node) => {
    const stage = BRACKET_STAGE_BY_KEY.get(node.stage);
    const concrete = node.a.kind === "team" && node.b.kind === "team";
    return {
      id: node.id,
      section: bracketLaneOf(node),
      round: stage?.order ?? 0,
      roundLabel: node.roundLabel,
      bestOf: node.bestOf,
      a: { ...node.a },
      b: { ...node.b },
      scoreA: 0,
      scoreB: 0,
      status: concrete ? "scheduled" : "tbd",
      startUtc: node.startUtc,
      winnerId: null,
      gameIds: [],
      source: concrete ? "schedule" : "tbd",
      updatedUtc: node.startUtc,
    } satisfies Series;
  });
}

/**
 * Fold the played/live series into the Main Event bracket.
 *
 * PURE, deterministic and idempotent. Takes the already-merged series list
 * (OpenDota + live + checked-in schedule) and returns that list with every
 * bracket match replaced by its stable topology node, and every raw series a
 * node consumed removed so nothing is published twice.
 *
 * Why this cannot be mergeSchedule (C.3): a schedule row only accepts concrete
 * team ids and, after it claims a played series, the series keeps its raw
 * `s-<series_id>` id. Both are fatal here. Half the bracket has no concrete
 * teams until earlier rounds finish, and the id must stay stable for the
 * dependency graph. So this is a second, narrow layer over the same claim rule
 * (lib/claim.ts), not a second pipeline.
 *
 * The loop is resolve -> claim -> repeat, to a fixpoint. One pass would only
 * ever fill the quarterfinals; iterating lets a quarterfinal result resolve a
 * semifinal, that semifinal's result resolve both an upper and a lower
 * destination, and so on, so a tournament that finished while the site was down
 * comes back complete in a single request.
 */
export function mergeBracket(input: Series[], nodes: BracketNode[] = BRACKET_NODES): Series[] {
  return reconcileBracket(input, nodes, {}).series;
}

/**
 * Reconcile with manual bracket patches inside the fixpoint, not after it.
 *
 * A corrected upstream winner changes both of its dependency destinations. If
 * provider-only reconciliation claims later matches first and the override is
 * applied afterwards, those later nodes retain results for participants that
 * are no longer on that path. Applying the patch on every claim pass lets the
 * corrected winner/loser drive all subsequent claims.
 *
 * The provider-only pass identifies raw rows that belonged to the superseded
 * path. A row no longer claimable after the correction is omitted instead of
 * leaking back into the generic Swiss remainder and corrupting standings.
 */
export function mergeBracketWithOverrides(
  input: Series[],
  patches: NonNullable<OverridesFile["series"]> = {},
  nodes: BracketNode[] = BRACKET_NODES,
): Series[] {
  if (Object.keys(patches).length === 0) return mergeBracket(input, nodes);

  const providerOnly = reconcileBracket(input, nodes, {});
  const corrected = reconcileBracket(input, nodes, patches);
  const topologyIds = new Set(nodes.map((node) => node.id));
  return corrected.series.filter(
    (item) => topologyIds.has(item.id) || !providerOnly.claimedRaw.has(item.id),
  );
}

interface BracketReconciliation {
  series: Series[];
  claimedRaw: Set<string>;
}

function reconcileBracket(
  input: Series[],
  nodes: BracketNode[],
  patches: NonNullable<OverridesFile["series"]>,
): BracketReconciliation {
  const manualNodes = new Set(nodes.map((node) => node.id).filter((id) => patches[id] != null));
  let byId = new Map<string, Series>(
    bracketNodeSeries(nodes).map((node) => [node.id, applyBracketPatch(node, patches[node.id])]),
  );
  const order = nodes.length === BRACKET_NODES.length ? BRACKET_ORDER_BY_ID : orderOf(nodes);

  const pool = input.filter(isClaimable);
  const claimedRaw = new Set<string>();
  const claimedNodes = new Set<string>();

  // Bounded by node count: every pass either claims at least one node or stops.
  for (let pass = 0; pass <= nodes.length; pass++) {
    byId = reindex(resolveSeries([...byId.values()]));

    let claimedThisPass = 0;
    for (const node of ordered(byId, order)) {
      if (claimedNodes.has(node.id)) continue;
      const aId = concreteTeam(node, "a");
      const bId = concreteTeam(node, "b");
      if (aId == null || bId == null || node.startUtc == null) continue;

      const raw = claimNearestSeries(pool, claimedRaw, aId, bId, node.startUtc);
      if (!raw) continue;

      claimedRaw.add(raw.id);
      claimedNodes.add(node.id);
      byId.set(node.id, applyBracketPatch(hydrate(node, raw), patches[node.id]));
      claimedThisPass++;
    }

    if (claimedThisPass === 0) break;
  }

  const settled = resolveSeries([...byId.values()]).map((node) =>
    claimedNodes.has(node.id) || manualNodes.has(node.id) ? node : normalizeUnclaimed(node),
  );

  const remainder = input.filter((item) => !claimedRaw.has(item.id) && !byId.has(item.id));
  return { series: [...remainder, ...settled], claimedRaw };
}

function applyBracketPatch(item: Series, patch: Partial<Series> | undefined): Series {
  return patch ? { ...item, ...patch, source: "override" } : item;
}

/**
 * Put authored dependency refs back onto reconciled nodes before manual
 * overrides run.
 *
 * Reconciliation has to resolve refs to concrete teams in order to claim a
 * played series. Those concrete slots are correct for the provider result, but
 * they would make a later manual winner correction unable to reflow: resolve()
 * cannot turn an already-concrete team back into winner_of/loser_of. Restoring
 * the topology here lets the final resolve pass derive every downstream slot
 * from the overridden result. A manual patch may still replace a slot because
 * overrides are applied after this function.
 */
export function restoreBracketSlotRefs(
  input: Series[],
  nodes: BracketNode[] = BRACKET_NODES,
): Series[] {
  const topology = new Map(nodes.map((node) => [node.id, node]));
  return input.map((item) => {
    const node = topology.get(item.id);
    return node
      ? { ...item, a: { ...node.a }, b: { ...node.b } }
      : item;
  });
}

/**
 * Series a bracket node is allowed to consume.
 *
 * `scheduleId != null` means a checked-in Swiss or Elimination Round row already
 * owns this series, so it is off limits — that is the one-to-one guarantee
 * holding across both layers. Everything else is fenced off by the claim window
 * in lib/claim.ts: the Main Event runs August 20-23 and the group stage ended on
 * the 16th, so a group-stage rematch of the same two teams is days outside it.
 */
function isClaimable(item: Series): boolean {
  return (
    (item.source === "opendota" || item.source === "live") &&
    item.scheduleId == null &&
    item.startUtc != null &&
    item.a.kind === "team" &&
    item.b.kind === "team" &&
    item.a.teamId != null &&
    item.b.teamId != null
  );
}

/**
 * Copy the played series onto the stable node.
 *
 * Slot ORDER stays the topology's, so the team that arrived from the upper
 * bracket keeps the top line on the board while a series is being played. The
 * score is remapped to follow, since OpenDota's side order is whichever team
 * happened to be Radiant in game one.
 */
function hydrate(node: Series, raw: Series): Series {
  const sameOrder = raw.a.teamId === node.a.teamId;
  const scoreA = sameOrder ? raw.scoreA : raw.scoreB;
  const scoreB = sameOrder ? raw.scoreB : raw.scoreA;

  const hydrated: Series = {
    ...node,
    seriesId: raw.seriesId,
    bestOf: reconcileBestOf(node.bestOf, raw, scoreA, scoreB),
    scoreA,
    scoreB,
    // OpenDota is authoritative for what actually happened, including when it
    // actually started — the topology time is the official plan, not the record.
    status: raw.status,
    startUtc: raw.startUtc ?? node.startUtc,
    winnerId: raw.winnerId,
    gameIds: [...raw.gameIds],
    source: raw.source,
    updatedUtc: raw.updatedUtc,
  };

  if (raw.games) hydrated.games = raw.games.map((game) => ({ ...game }));
  if (raw.liveGame) hydrated.liveGame = { ...raw.liveGame };
  if (raw.streamUrl) hydrated.streamUrl = raw.streamUrl;
  return hydrated;
}

/**
 * Valve is authoritative on format, but a published series must never carry a
 * score its own format makes impossible. If the played series was decided on a
 * different best-of than the topology claims, the played data wins and the
 * disagreement is logged rather than rendered as a broken card.
 */
function reconcileBestOf(topologyBestOf: 1 | 3 | 5, raw: Series, scoreA: number, scoreB: number): 1 | 3 | 5 {
  const need = winsNeeded(topologyBestOf);
  const leader = Math.max(scoreA, scoreB);
  const impossible = leader > need || (raw.status === "completed" && leader !== need);
  if (!impossible || raw.bestOf === topologyBestOf) return topologyBestOf;

  console.warn("[bracket] best-of disagreement; using the played series", {
    event: "bracket_best_of_disagreement",
    seriesId: raw.seriesId ?? null,
    topologyBestOf,
    playedBestOf: raw.bestOf,
  });
  return raw.bestOf;
}

/**
 * A node nobody has played yet is scheduled once both participants are known and
 * TBD until then. Its participants are never guessed from standings order or
 * from where a team sits in an array.
 */
function normalizeUnclaimed(node: Series): Series {
  const concrete = node.a.kind === "team" && node.b.kind === "team";
  return {
    ...node,
    status: concrete ? "scheduled" : "tbd",
    source: concrete ? "schedule" : "tbd",
    scoreA: 0,
    scoreB: 0,
    winnerId: null,
  };
}

function concreteTeam(item: Series, side: "a" | "b"): TeamId | null {
  const slot = item[side];
  return slot.kind === "team" && slot.teamId != null ? slot.teamId : null;
}

function reindex(series: Series[]): Map<string, Series> {
  return new Map(series.map((item) => [item.id, item]));
}

function orderOf(nodes: BracketNode[]): ReadonlyMap<string, number> {
  return new Map(nodes.map((node, index) => [node.id, index]));
}

/** Official chronological order, so the earlier slot gets first pick. */
function ordered(byId: Map<string, Series>, order: ReadonlyMap<string, number>): Series[] {
  return [...byId.values()].sort(
    (x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0) || x.id.localeCompare(y.id),
  );
}

// ---------------------------------------------------------------------------
// Topology validation. Run by the unit suite, which gates the build in CI, and
// by scripts/smoke.ts. It answers one question: is the hand-authored graph in
// data/bracket-topology.ts shaped like a real single-champion bracket?
// ---------------------------------------------------------------------------

export function validateBracketTopology(nodes: BracketNode[] = BRACKET_NODES): string[] {
  const errors: string[] = [];
  const add = (code: string, detail: string) => errors.push(`${code}: ${detail}`);

  const ids = new Set<string>();
  const valveIds = new Set<number>();
  for (const node of nodes) {
    if (ids.has(node.id)) add("duplicate_node_id", node.id);
    ids.add(node.id);
    if (valveIds.has(node.valveNodeId)) add("duplicate_valve_node", String(node.valveNodeId));
    valveIds.add(node.valveNodeId);

    if (!BRACKET_STAGE_BY_KEY.has(node.stage)) add("unknown_stage", `${node.id} -> ${node.stage}`);
    if (node.bestOf !== 3 && node.bestOf !== 5) add("best_of", `${node.id} has Bo${node.bestOf}`);
    if (!isUtcIso(node.startUtc)) add("timestamp", `${node.id}.startUtc is not UTC ISO 8601`);
    if (!node.shortLabel || !node.roundLabel) add("label", `${node.id} is missing a label`);

    for (const [side, slot] of [["a", node.a], ["b", node.b]] as const) {
      if (slot.kind === "team") {
        if (slot.teamId == null || !TEAM_BY_ID.has(slot.teamId)) {
          add("unknown_team", `${node.id}.${side} has ${String(slot.teamId)}`);
        }
      } else if (slot.kind === "winner_of" || slot.kind === "loser_of") {
        if (!slot.matchId) add("missing_reference", `${node.id}.${side}`);
        else if (!nodes.some((other) => other.id === slot.matchId)) {
          add("dangling_reference", `${node.id}.${side} -> ${slot.matchId}`);
        }
        if (!slot.label) add("label", `${node.id}.${side} has no unresolved label`);
      } else {
        add("slot_kind", `${node.id}.${side} is ${slot.kind}`);
      }
    }
  }

  const bo5 = nodes.filter((node) => node.bestOf === 5);
  if (bo5.length !== 1) add("format", `expected exactly one Bo5, found ${bo5.length}`);
  else if (bracketLaneOf(bo5[0]) !== "grand_final") {
    add("format", `the Bo5 is ${bo5[0].id}, not the grand final`);
  }

  // Exactly one node nothing else depends on: the match that ends the bracket.
  const referenced = new Set<string>();
  for (const node of nodes) {
    for (const slot of [node.a, node.b]) if (slot.matchId) referenced.add(slot.matchId);
  }
  const terminal = nodes.filter((node) => !referenced.has(node.id));
  if (terminal.length !== 1) {
    add("terminal", `expected exactly one terminal node, found [${terminal.map((n) => n.id).join(",")}]`);
  } else if (bracketLaneOf(terminal[0]) !== "grand_final") {
    add("terminal", `the terminal node is ${terminal[0].id}, not the grand final`);
  }

  for (const cycle of findCycles(nodes)) add("cycle", cycle);

  // A dependency can only point backwards in time, or the graph is unplayable.
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    for (const slot of [node.a, node.b]) {
      const source = slot.matchId ? byId.get(slot.matchId) : undefined;
      if (source && Date.parse(source.startUtc) >= Date.parse(node.startUtc)) {
        add("ordering", `${node.id} starts before its dependency ${source.id}`);
      }
    }
  }

  return errors;
}

function findCycles(nodes: BracketNode[]): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const state = new Map<string, "open" | "done">();
  const cycles: string[] = [];

  const visit = (id: string, trail: string[]): void => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "open") {
      cycles.push([...trail.slice(trail.indexOf(id)), id].join(" -> "));
      return;
    }
    state.set(id, "open");
    const node = byId.get(id);
    if (node) {
      for (const slot of [node.a, node.b]) {
        if (slot.matchId && byId.has(slot.matchId)) visit(slot.matchId, [...trail, id]);
      }
    }
    state.set(id, "done");
  };

  for (const node of nodes) visit(node.id, []);
  return cycles;
}

function isUtcIso(value: string): boolean {
  if (!UTC_ISO.test(value)) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const canonical = new Date(parsed).toISOString();
  return value === canonical || value === canonical.replace(".000Z", "Z");
}
