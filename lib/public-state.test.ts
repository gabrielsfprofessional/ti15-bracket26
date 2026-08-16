import { describe, expect, it } from "vitest";
import snapshot from "@/data/tournament.json";
import { validatePublicState } from "./public-state";

function payload() {
  const lastSyncUtc = "2026-08-14T20:00:00.000Z";
  return {
    ...structuredClone(snapshot),
    lastSyncUtc,
    deploymentSha: "abc123",
    sourceHealth: {
      matches: { status: "ok", observedUtc: lastSyncUtc },
      live: { status: "ok", observedUtc: lastSyncUtc },
      schedule: { status: "managed", observedUtc: lastSyncUtc },
      snapshotGeneratedUtc: lastSyncUtc,
      mode: "live",
    },
  };
}

describe("public state uptime contract", () => {
  it("accepts a healthy state on the expected deployment", () => {
    const result = validatePublicState(payload(), {
      nowMs: Date.parse("2026-08-14T21:00:00Z"),
      expectedSha: "abc123",
    });
    expect(result.valid).toBe(true);
    // Counts are reported, not frozen: the snapshot is refreshed by a scheduled
    // job, so a literal series count here would fail CI the next time a match
    // finishes. What must hold is the shape and the relationships.
    const state = payload();
    expect(result.summary).toMatchObject({
      syncState: "ok",
      teams: 16,
      series: state.series.length,
      completed: state.series.filter((item) => item.status === "completed").length,
      deploymentSha: "abc123",
    });
    expect(result.summary.series).toBeGreaterThanOrEqual(39);
    expect(result.summary.completed).toBeLessThanOrEqual(result.summary.series);
  });

  it("rejects wrong league, team count, parity, degraded sync, old snapshot, and SHA", () => {
    const broken = payload();
    broken.leagueId = 1 as 19719;
    broken.teams = broken.teams.slice(0, 15);
    broken.swiss[0].wins++;
    broken.syncState = "degraded";
    broken.sourceHealth.mode = "degraded";
    const result = validatePublicState(broken, {
      nowMs: Date.parse("2026-08-17T20:00:00Z"),
      expectedSha: "new-sha",
    });

    expect(result.errors.join(" ")).toMatch(/leagueId/);
    expect(result.errors.join(" ")).toMatch(/16 unique teams/);
    expect(result.errors.join(" ")).toMatch(/Swiss parity/);
    expect(result.errors.join(" ")).toMatch(/syncState/);
    expect(result.errors.join(" ")).toMatch(/snapshot age/);
    expect(result.errors.join(" ")).toMatch(/deployment SHA/);
  });
});
