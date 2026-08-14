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
    expect(result.summary).toMatchObject({ teams: 16, series: 39, completed: 24 });
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
