// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BracketSection } from "@/components/BracketSection";
import { ResultsSection } from "@/components/ResultsSection";
import { ScheduleSection } from "@/components/ScheduleSection";
import { SwissTable } from "@/components/SwissTable";
import { BRACKET_NODES } from "@/data/bracket-topology";
import { TEAMS } from "@/data/teams";
import { mergeBracket } from "@/lib/bracket";
import { buildBracketView, defaultStageKey } from "@/lib/bracket-view";
import type { Series, SwissRow, TeamId } from "@/lib/types";

const IRON_WING: TeamId = 10150413;
const SPIRIT: TeamId = 7119388;

const EMPTY_BRACKET = mergeBracket([]);

function playedQf1(over: Partial<Series> = {}): Series {
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
    games: [],
    source: "opendota",
    updatedUtc: "2026-08-20T04:00:00.000Z",
    ...over,
  };
}

function renderBracket(series: Series[] = EMPTY_BRACKET, championId: TeamId | null = null) {
  return render(
    <BracketSection series={series} timeMode="utc" championId={championId} />,
  );
}

function domIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[id]")].map((node) => node.id);
}

describe("bracket view model", () => {
  it("groups the 14 nodes into eight chronological stages and three lanes", () => {
    const view = buildBracketView(EMPTY_BRACKET);
    expect(view.hasBracket).toBe(true);
    expect(view.linear).toHaveLength(BRACKET_NODES.length);
    expect(view.stages.map((stage) => stage.key)).toEqual([
      "ub-qf",
      "lb-r1",
      "ub-sf",
      "lb-qf",
      "ub-final",
      "lb-sf",
      "lb-final",
      "grand-final",
    ]);
    expect(view.lanes.map((lane) => lane.label)).toEqual([
      "Upper Bracket",
      "Lower Bracket",
      "Grand Final",
    ]);
  });

  it("explains where each result goes, from the topology alone", () => {
    const view = buildBracketView(EMPTY_BRACKET);
    const qf1 = view.linear.find((match) => match.id === "main-ub-qf1");
    expect(qf1?.paths).toEqual([
      "Loser drops to Lower R1-1",
      "Winner advances to Upper SF 1",
    ]);
    const grandFinal = view.linear.find((match) => match.id === "main-grand-final");
    expect(grandFinal?.paths).toEqual(["Winner is the TI15 champion"]);
  });

  it("opens on the first undecided stage, and on a live stage when there is one", () => {
    expect(defaultStageKey(buildBracketView(EMPTY_BRACKET))).toBe("ub-qf");
    const live = mergeBracket([playedQf1({ status: "live", scoreA: 1, scoreB: 0, winnerId: null, source: "live" })]);
    // Quarterfinals are still the live stage here; once they all finish the
    // navigator moves on by itself.
    expect(defaultStageKey(buildBracketView(live))).toBe("ub-qf");
  });
});

describe("bracket rendering", () => {
  it("names an unresolved slot by its dependency, never as blank or an id", () => {
    renderBracket();
    expect(screen.getAllByText("Winner of Upper QF 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Loser of Upper SF 2").length).toBeGreaterThan(0);
    expect(screen.queryByText(/main-ub-qf/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("undefined");
  });

  it("labels the lanes, the formats, and the official times", () => {
    renderBracket();
    for (const lane of ["Upper Bracket", "Lower Bracket", "Grand Final"]) {
      expect(screen.getByRole("heading", { name: lane })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Bo3")).toHaveLength(13);
    expect(screen.getAllByText("Bo5")).toHaveLength(1);
    expect(screen.getAllByText(/Aug 20/).length).toBeGreaterThan(0);
  });

  it("states live in words, not colour alone, and marks the loser as out", () => {
    const { container } = renderBracket(
      mergeBracket([playedQf1({ status: "live", scoreA: 1, scoreB: 0, winnerId: null, source: "live" })]),
    );
    expect(screen.getAllByText("Live now").length).toBeGreaterThan(0);

    renderBracket(mergeBracket([playedQf1()]));
    expect(screen.getAllByText("Final").length).toBeGreaterThan(0);
    expect(screen.getAllByText("winner").length).toBeGreaterThan(0);
    expect(screen.getAllByText("eliminated from this series").length).toBeGreaterThan(0);
    expect(container).toBeTruthy();
  });

  it("describes what an unresolved node is waiting for", () => {
    renderBracket();
    // Ten future nodes have neither participant yet.
    expect(screen.getAllByText("Awaiting both teams")).toHaveLength(10);
    // The dependency itself is named on the team lines, and in full in the
    // linear list, rather than crammed into the status.
    const sf1 = document.getElementById("bracket-main-ub-sf1") as HTMLElement;
    expect(sf1.textContent).toContain("Winner of Upper QF 1");
    expect(sf1.textContent).toContain("Winner of Upper QF 2");
  });

  it("says a half-resolved node is waiting on an opponent", () => {
    renderBracket(mergeBracket([playedQf1()]));
    expect(screen.getAllByText("Awaiting opponent").length).toBeGreaterThan(0);
    const sf1 = document.getElementById("bracket-main-ub-sf1") as HTMLElement;
    expect(sf1.textContent).toContain("Iron Wing");
    expect(sf1.textContent).toContain("Winner of Upper QF 2");
  });

  it("keeps a semantic linear dependency list with every node in it", () => {
    renderBracket();
    const list = screen.getByText("Accessible linear bracket list").closest("details") as HTMLElement;
    expect(within(list).getAllByRole("listitem")).toHaveLength(BRACKET_NODES.length);
    expect(within(list).getByRole("link", { name: "Grand Final" })).toHaveAttribute(
      "href",
      "#bracket-main-grand-final",
    );
    expect(list.textContent).toContain("Winner advances to Upper SF 1");
  });

  it("uses bracket-scoped DOM ids so nothing collides with Schedule or Results", () => {
    const series = mergeBracket([playedQf1()]);
    const bracket = render(<BracketSection series={series} timeMode="utc" />).container;
    const schedule = render(
      <ScheduleSection series={series} teams={TEAMS} timeMode="utc" onTimeModeChange={() => {}} />,
    ).container;
    const results = render(
      <ResultsSection series={series} teams={TEAMS} timeMode="utc" />,
    ).container;

    const all = [...domIds(bracket), ...domIds(schedule), ...domIds(results)];
    expect(new Set(all).size).toBe(all.length);
    expect(domIds(bracket)).toContain("bracket-main-ub-qf1");
    // The same match is also published by Results under the plain series anchor.
    expect(domIds(results)).toContain("series-main-ub-qf1");
  });

  it("renders each match exactly once, so nothing is duplicated for a screen reader", () => {
    const { container } = renderBracket();
    expect(container.querySelectorAll("#bracket-main-grand-final")).toHaveLength(1);
    expect(container.querySelectorAll("article.bracket-card")).toHaveLength(BRACKET_NODES.length);
  });

  it("shows the champion once the grand final decides it", () => {
    const { container } = renderBracket(EMPTY_BRACKET, IRON_WING);
    const banner = container.querySelector(".bracket-champion") as HTMLElement;
    expect(banner.textContent).toContain("Iron Wing");
    expect(banner.textContent).toContain("wins The International 2026");
  });

  it("shows no champion banner while the grand final is undecided", () => {
    const { container } = renderBracket();
    expect(container.querySelector(".bracket-champion")).toBeNull();
  });

  it("falls back to the dormant placeholder when no bracket is published", () => {
    renderBracket([]);
    expect(
      screen.getByText("Main Event bracket will appear when official pairings are released"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Bracket stage" })).not.toBeInTheDocument();
  });
});

describe("mobile stage navigation", () => {
  it("offers a native button per stage plus Previous and Next", async () => {
    renderBracket();
    const chips = within(screen.getByRole("group", { name: "Bracket stage" })).getAllByRole("button");
    expect(chips).toHaveLength(8);
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Previous stage/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next stage/ })).toBeEnabled();
  });

  it("advances and rewinds through the stages by keyboard", async () => {
    const user = userEvent.setup();
    renderBracket();
    const next = screen.getByRole("button", { name: /Next stage/ });

    next.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(/Stage/).textContent).toContain("2");
    expect(screen.getByRole("button", { name: "Lower R1" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /Previous stage/ }));
    expect(screen.getByRole("button", { name: "Upper QF" })).toHaveAttribute("aria-pressed", "true");
  });

  it("jumps straight to a stage from its chip and stops at the last one", async () => {
    const user = userEvent.setup();
    renderBracket();
    await user.click(screen.getByRole("button", { name: "Grand Final" }));
    expect(screen.getByRole("button", { name: "Grand Final" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Next stage/ })).toBeDisabled();
    expect(screen.getByText(/Stage/).textContent).toContain("8");
  });

  it("marks only the selected stage and its lane as active", async () => {
    const user = userEvent.setup();
    const { container } = renderBracket();
    await user.click(screen.getByRole("button", { name: "Lower QF" }));

    const activeStages = container.querySelectorAll(".bracket-stage[data-active]");
    expect(activeStages).toHaveLength(1);
    expect(activeStages[0].getAttribute("data-stage")).toBe("lb-qf");

    const activeLanes = container.querySelectorAll(".bracket-lane[data-active]");
    expect(activeLanes).toHaveLength(1);
    expect(activeLanes[0].classList.contains("bracket-lane--lower")).toBe(true);
  });
});

describe("qualification copy", () => {
  const rows: SwissRow[] = TEAMS.map((team, index) => ({
    teamId: team.id,
    wins: index < 8 ? 3 : 2,
    losses: index < 8 ? 2 : 3,
    state: index < 8 ? "advanced" : "eliminated",
  }));

  it("says qualified for the Main Event, not qualified directly", () => {
    render(<SwissTable rows={rows} series={[]} />);
    expect(screen.getByText("Qualified for the Main Event")).toBeInTheDocument();
    expect(screen.queryByText(/Qualified directly/)).not.toBeInTheDocument();
  });

  it("presents a settled stage as the final standings", () => {
    render(<SwissTable rows={rows} series={[]} />);
    expect(screen.getByRole("heading", { name: "Final Swiss standings" })).toBeInTheDocument();
    expect(screen.getByText(/Group stage complete/)).toBeInTheDocument();
  });

  it("keeps the in-progress wording while any team is unsettled", () => {
    const running: SwissRow[] = rows.map((row, index) =>
      index === 0 ? { ...row, state: "active" } : row,
    );
    render(<SwissTable rows={running} series={[]} />);
    expect(screen.getByRole("heading", { name: "Swiss standings" })).toBeInTheDocument();
    expect(screen.queryByText(/Group stage complete/)).not.toBeInTheDocument();
  });
});
