import type { Team, TeamId } from "@/lib/types";

/**
 * The 16 TI15 teams, hardcoded.
 *
 * This table is the ONLY source of team names on the site. The matches endpoint
 * returns radiant_team_name / dire_team_name as null for every single game, and
 * the league/teams endpoint has dirty values (it returns "Nigma Galaxy " with a
 * trailing space). Always resolve a name by joining team_id against this table.
 *
 * `short` is used below the 480px breakpoint; kept to 2-4 characters so two of
 * them plus a score always fit on one line on the narrowest phone.
 * `logo` points at a locally downloaded file — never hotlink Steam's CDN.
 */
export const TEAMS: Team[] = [
  { id: 9467224, name: "Aurora Gaming", short: "AUR", logo: "/logos/optimized/9467224.webp" },
  { id: 8255888, name: "BoomBoys", short: "BB", logo: "/logos/optimized/8255888.webp" },
  { id: 9964962, name: "GamerLegion", short: "GL", logo: "/logos/optimized/9964962.webp" },
  { id: 10149530, name: "HULIGANI", short: "HU", logo: "/logos/optimized/10149530.webp" },
  { id: 10150413, name: "Iron Wing", short: "IW", logo: "/logos/optimized/10150413.webp" },
  { id: 10150538, name: "LGD Gaming", short: "LGD", logo: "/logos/optimized/10150538.webp" },
  { id: 10136357, name: "Nigma Galaxy", short: "NGX", logo: "/logos/optimized/10136357.webp" },
  { id: 2586976, name: "OG", short: "OG", logo: "/logos/optimized/2586976.webp" },
  { id: 9247354, name: "Team Falcons", short: "FLCN", logo: "/logos/optimized/9247354.webp" },
  { id: 2163, name: "Team Liquid", short: "TL", logo: "/logos/optimized/2163.webp" },
  { id: 5017210, name: "Team Resilience", short: "TR", logo: "/logos/optimized/5017210.webp" },
  { id: 7119388, name: "Team Spirit", short: "TS", logo: "/logos/optimized/7119388.webp" },
  { id: 9823272, name: "Team Yandex", short: "TY", logo: "/logos/optimized/9823272.webp" },
  { id: 9572001, name: "TEAM VISION", short: "VSN", logo: "/logos/optimized/9572001.webp" },
  { id: 726228, name: "Vici Gaming", short: "VG", logo: "/logos/optimized/726228.webp" },
  { id: 8261500, name: "Xtreme Gaming", short: "XG", logo: "/logos/optimized/8261500.webp" },
];

export const TEAM_BY_ID: ReadonlyMap<TeamId, Team> = new Map(TEAMS.map((t) => [t.id, t]));

/**
 * A team id that is not one of the 16. This is always a data problem — a roster
 * change, a stand-in org, or OpenDota reporting a showmatch under the league id —
 * so it is surfaced rather than hidden behind a blank cell or the string
 * "undefined". `logo` is empty on purpose: callers check for it and render a
 * placeholder instead of requesting a 404.
 */
export function unknownTeam(id: TeamId): Team {
  return { id, name: `Unknown (${id})`, short: "???", logo: "" };
}

/**
 * Ids already warned about. Without this the same unknown id logs on every
 * render of every request, which buries the one line that actually matters.
 */
const warnedUnknownIds = new Set<TeamId>();

function warnUnknown(id: TeamId): void {
  if (warnedUnknownIds.has(id)) return;
  warnedUnknownIds.add(id);
  console.warn(
    `[teams] team_id ${id} is not one of the 16 hardcoded TI15 teams. ` +
      `It will render as "Unknown (${id})". Add it to data/teams.ts if it is real.`,
  );
}

/**
 * Never throws and NEVER returns undefined.
 *
 * A nullish id means "no team yet" (an unplayed bracket slot) and returns null,
 * which is a different thing from an id we cannot resolve — that returns a
 * populated Unknown team and logs loudly.
 */
export function getTeam(id: TeamId | null | undefined): Team | null {
  if (id == null) return null;
  const known = TEAM_BY_ID.get(id);
  if (known) return known;
  warnUnknown(id);
  return unknownTeam(id);
}

export function teamName(id: TeamId | null | undefined): string {
  return getTeam(id)?.name ?? "TBD";
}

export function teamShort(id: TeamId | null | undefined): string {
  return getTeam(id)?.short ?? "TBD";
}
