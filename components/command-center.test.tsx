// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import snapshotJson from "@/data/tournament.json";
import { LiveBar } from "@/components/LiveBar";
import { ScheduleSection } from "@/components/ScheduleSection";
import { SeriesCard } from "@/components/SeriesCard";
import { SwissTable } from "@/components/SwissTable";
import { TournamentView } from "@/components/TournamentView";
import { TournamentHeader } from "@/components/TournamentHeader";
import type { GameSummary, Series, Tournament } from "@/lib/types";
import { describe, expect, it, vi } from "vitest";

const snapshot = snapshotJson as unknown as Tournament;

describe("live command dock", () => {
  it("keeps a calm no-live state and identifies the next start", () => {
    const next = snapshot.series.find((item) => item.status === "scheduled");
    render(<LiveBar series={snapshot.series} nextSeries={next} timeMode="eastern" />);

    expect(screen.getByRole("heading", { name: "Live desk" })).toBeInTheDocument();
    expect(screen.getByText("No matches live")).toBeInTheDocument();
    expect(screen.getByText(/Next:/)).toHaveTextContent(/EDT|EST/);
  });

  it("separates the series score from explicitly labeled current-game kills", () => {
    const live = makeSeries({
      id: "live-1",
      status: "live",
      scoreA: 1,
      scoreB: 0,
      liveGame: {
        gameNumber: 2,
        radiantTeamId: 9467224,
        direTeamId: 8255888,
        radiantKills: 14,
        direKills: 9,
        gameTimeSeconds: 901,
        observedUtc: "2026-08-14T12:00:00.000Z",
      },
      streamUrl: "https://www.twitch.tv/dota2ti",
    });
    render(<LiveBar series={[live]} timeMode="eastern" />);

    expect(screen.getByRole("heading", { name: "Live now" })).toBeInTheDocument();
    expect(screen.getByText("Game 2 · Bo3")).toBeInTheDocument();
    expect(screen.getByText(/Current-game kills:/)).toHaveTextContent("14–9");
    expect(screen.getByRole("link", { name: "Watch live" })).toHaveAttribute("href", live.streamUrl);
  });
});

describe("complete schedule controls", () => {
  it("shows every series after selecting All and supports team filtering", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleSection
        series={snapshot.series}
        teams={snapshot.teams}
        timeMode="eastern"
        onTimeModeChange={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText(`${snapshot.series.length} matches`)).toBeInTheDocument();
    expect(document.querySelectorAll("article.series-card")).toHaveLength(snapshot.series.length);

    const select = screen.getByRole("combobox", { name: "Team" });
    await user.selectOptions(select, String(snapshot.teams[0].id));
    const expected = snapshot.series.filter(
      (item) => item.a.teamId === snapshot.teams[0].id || item.b.teamId === snapshot.teams[0].id,
    ).length;
    expect(document.querySelectorAll("article.series-card")).toHaveLength(expected);
  });

  it("emits all four time modes without changing server-safe Eastern by itself", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ScheduleSection
        series={snapshot.series}
        teams={snapshot.teams}
        timeMode="eastern"
        onTimeModeChange={onChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Eastern" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Shanghai" }));
    await user.click(screen.getByRole("button", { name: "UTC" }));
    await user.click(screen.getByRole("button", { name: "Local" }));
    expect(onChange.mock.calls.map(([mode]) => mode)).toEqual(["shanghai", "utc", "local"]);
  });
});

describe("standings and game detail", () => {
  it("renders every fate as text and explains four-series stage endings", () => {
    const rows: Tournament["swiss"] = [
      { teamId: 9467224, wins: 4, losses: 0, state: "advanced" },
      { teamId: 8255888, wins: 0, losses: 4, state: "eliminated" },
      { teamId: 9964962, wins: 3, losses: 2, state: "elimination_round" },
      { teamId: 10149530, wins: 2, losses: 1, state: "active" },
    ];
    const games = [
      makeSeries({ id: "r1", a: { kind: "team", teamId: 9467224 }, b: { kind: "team", teamId: 8255888 }, winnerId: 9467224 }),
      makeSeries({ id: "r2", a: { kind: "team", teamId: 9964962 }, b: { kind: "team", teamId: 9467224 }, winnerId: 9467224 }),
      makeSeries({ id: "r3", a: { kind: "team", teamId: 9467224 }, b: { kind: "team", teamId: 10149530 }, winnerId: 9467224 }),
      makeSeries({ id: "r4", a: { kind: "team", teamId: 9467224 }, b: { kind: "team", teamId: 8255888 }, winnerId: 9467224 }),
    ];
    render(<SwissTable rows={rows} series={games} />);

    for (const label of ["Active", "Advanced", "Elimination Round", "Eliminated"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByLabelText(/Aurora Gaming series: W, W, W, W, stage ended after four/)).toBeInTheDocument();
  });

  it("expands typed per-game results with sides, final kills, duration, and OpenDota link", () => {
    const game: GameSummary = {
      matchId: 9001,
      gameNumber: 1,
      radiantTeamId: 9467224,
      direTeamId: 8255888,
      winnerId: 9467224,
      startUtc: "2026-08-14T12:00:00.000Z",
      durationSeconds: 2412,
      radiantKills: 32,
      direKills: 18,
      openDotaUrl: "https://www.opendota.com/matches/9001",
    };
    render(<SeriesCard series={makeSeries({ games: [game], gameIds: [9001] })} timeMode="utc" />);

    const disclosure = screen.getByText(/1 game · details/).closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(within(disclosure as HTMLElement).getByText(/1 game · details/));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("32 final kills")).toBeInTheDocument();
    expect(screen.getByText(/40:12/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open game 9001/ })).toHaveAttribute("href", game.openDotaUrl);
  });
});

describe("degraded and resilient rendering", () => {
  it("makes the served fallback mode visible without hiding tournament data", () => {
    const degraded: Tournament = {
      ...structuredClone(snapshot),
      syncState: "degraded",
      sourceHealth: { ...structuredClone(snapshot.sourceHealth), mode: "degraded" },
    };
    render(
      <>
        <TournamentHeader tournament={degraded} nowMs={Date.parse(degraded.lastSyncUtc)} />
        <TournamentView initialTournament={degraded} initialNowMs={Date.parse(degraded.lastSyncUtc)} />
      </>,
    );

    expect(screen.getByText("Fallback snapshot")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to tournament data" })).toBeInTheDocument();
  });
});

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: "test-series",
    seriesId: 8001,
    section: "swiss",
    round: 1,
    roundLabel: "Round 1",
    bestOf: 3,
    a: { kind: "team", teamId: 9467224 },
    b: { kind: "team", teamId: 8255888 },
    scoreA: 2,
    scoreB: 0,
    status: "completed",
    startUtc: "2026-08-14T12:00:00.000Z",
    winnerId: 9467224,
    gameIds: [1, 2],
    source: "opendota",
    updatedUtc: "2026-08-14T13:00:00.000Z",
    ...overrides,
  };
}
