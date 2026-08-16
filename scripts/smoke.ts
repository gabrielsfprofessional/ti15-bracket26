/**
 * Run the real pipeline against live OpenDota and print what the merge layer
 * decided. Not part of the build or the test suite — this is the check to run
 * before and after touching lib/opendota.ts, since the unit tests use fixtures
 * and cannot tell you that the live feed has changed shape underneath you.
 *
 *   npm run smoke
 */
import { buildTournament } from "../lib/opendota";
import { validateBracketTopology } from "../lib/bracket";
import { TEAM_BY_ID } from "../data/teams";
import { formatEt } from "../lib/time";

const BRACKET_SECTIONS = new Set(["upper", "lower", "grand_final"]);

async function main() {
const nowMs = Date.now();

// The topology is hand-authored, so check its shape before reporting anything
// that was reconciled onto it.
const topologyErrors = validateBracketTopology();
console.log("topology       ", topologyErrors.length ? topologyErrors : "valid");

const t = await buildTournament(nowMs);

const byStatus = new Map<string, number>();
for (const s of t.series) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);

console.log("syncState      ", t.syncState);
console.log("served mode    ", t.sourceHealth.mode);
console.log("source health  ", {
  matches: t.sourceHealth.matches.status,
  live: t.sourceHealth.live.status,
  schedule: t.sourceHealth.schedule.status,
  snapshot: t.sourceHealth.snapshotGeneratedUtc,
});
console.log("series         ", t.series.length);
console.log("by status      ", Object.fromEntries(byStatus));
console.log("swiss states   ", Object.fromEntries(
  t.swiss.reduce((m, r) => m.set(r.state, (m.get(r.state) ?? 0) + 1), new Map<string, number>()),
));
console.log("provisional    ", t.swiss.filter((r) => r.provisional).length);
console.log("stamped rows   ", t.series.filter((s) => s.scheduleId).length);

const bracket = t.series.filter((s) => BRACKET_SECTIONS.has(s.section));
console.log("bracket nodes  ", bracket.length);
console.log("bracket status ", Object.fromEntries(
  bracket.reduce((m, s) => m.set(s.status, (m.get(s.status) ?? 0) + 1), new Map<string, number>()),
));
console.log("bracket claimed", bracket.filter((s) => s.seriesId != null).length);
console.log("championId     ", t.championId ?? "undecided");

const unknown = new Set<number>();
for (const s of t.series) {
  for (const slot of [s.a, s.b]) {
    if (slot.teamId != null && !TEAM_BY_ID.has(slot.teamId)) unknown.add(slot.teamId);
  }
}
console.log("unknown teamIds", unknown.size ? [...unknown] : "none");

console.log("\ntop 5 standings");
for (const [i, r] of t.swiss.slice(0, 5).entries()) {
  console.log(
    `  ${i + 1}. ${String(TEAM_BY_ID.get(r.teamId)?.name ?? r.teamId).padEnd(18)} ` +
      `${r.wins}-${r.losses}  ${r.state}${r.provisional ? " (provisional)" : ""}`,
  );
}

console.log("\nmost recent 5 series");
for (const s of [...t.series].reverse().slice(0, 5)) {
  const a = TEAM_BY_ID.get(s.a.teamId ?? -1)?.short ?? s.a.label ?? "?";
  const b = TEAM_BY_ID.get(s.b.teamId ?? -1)?.short ?? s.b.label ?? "?";
  console.log(`  ${formatEt(s.startUtc).padEnd(28)} ${a} ${s.scoreA}-${s.scoreB} ${b}  [${s.status}]`);
}
}

main();
