import { describe, expect, it } from "vitest";
import { readSchedule } from "./schedule";

describe("checked-in schedule provider", () => {
  it("returns provider-neutral entries with deterministic health metadata", () => {
    const snapshot = readSchedule(Date.parse("2026-08-14T20:00:00Z"));
    expect(snapshot.provider).toBe("checked_in");
    // Eight Round 4 rows, seven Round 5 rows, five Elimination Round rows. The
    // Main Event is a dependency graph and lives in data/bracket-topology.ts,
    // so it must never appear here.
    expect(snapshot.matches).toHaveLength(20);
    expect(snapshot.matches.filter((entry) => entry.section === "swiss")).toHaveLength(15);
    expect(snapshot.matches.filter((entry) => entry.section === "elimination")).toHaveLength(5);
    expect(
      snapshot.matches.filter((entry) => ["upper", "lower", "grand_final"].includes(entry.section)),
    ).toHaveLength(0);
    expect(snapshot.health).toEqual({
      status: "managed",
      observedUtc: "2026-08-14T20:00:00.000Z",
    });
  });

  it("preserves UTC schedule rows without exposing provider-specific shapes", () => {
    const snapshot = readSchedule(0);
    expect(snapshot.matches.every((entry) => entry.startUtc === null || entry.startUtc.endsWith("Z"))).toBe(true);
    expect(snapshot.matches.every((entry) => typeof entry.id === "string")).toBe(true);
  });
});
