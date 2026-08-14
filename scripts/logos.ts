/**
 * One-off: download the 16 team logos into public/logos/.
 *
 * Run with `npm run logos`. It is NOT part of the sync — logos are stable and a
 * hotlinked Steam CDN image that 404s mid-Grand-Final looks terrible. Files are
 * committed to the repo and served from our own origin.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { TEAMS } from "../data/teams";
import type { RawLeagueTeam } from "../lib/types";

const LEAGUE_ID = 19719;
const USER_AGENT =
  "TI15-Bracket/1.0 (+https://github.com/gabrielsfprofessional/ti15-bracket26; gabrielsfprofessional@gmail.com)";
const OUT_DIR = path.join(process.cwd(), "public", "logos");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const res = await fetch(`https://api.opendota.com/api/leagues/${LEAGUE_ID}/teams`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`league/teams -> HTTP ${res.status}`);
  const rows = (await res.json()) as RawLeagueTeam[];

  const byId = new Map(rows.map((r) => [r.team_id, r]));
  let ok = 0;
  const missing: string[] = [];

  for (const team of TEAMS) {
    const url = byId.get(team.id)?.logo_url;
    if (!url) {
      missing.push(`${team.name} (${team.id}) — no logo_url from the API`);
      continue;
    }

    const img = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!img.ok) {
      missing.push(`${team.name} (${team.id}) — HTTP ${img.status}`);
      continue;
    }

    const buf = Buffer.from(await img.arrayBuffer());
    await writeFile(path.join(OUT_DIR, `${team.id}.png`), buf);
    console.log(`  ok  ${String(team.id).padEnd(9)} ${team.name.padEnd(18)} ${buf.length} bytes`);
    ok++;
  }

  console.log(`\n${ok}/${TEAMS.length} logos written to public/logos/`);
  if (missing.length) {
    console.log("\nMISSING — these will fall back to the team's short code:");
    for (const m of missing) console.log(`  - ${m}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
