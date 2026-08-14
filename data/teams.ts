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
  { id: 9467224, name: "Aurora Gaming", short: "AUR", logo: "/logos/9467224.png" },
  { id: 8255888, name: "BoomBoys", short: "BB", logo: "/logos/8255888.png" },
  { id: 9964962, name: "GamerLegion", short: "GL", logo: "/logos/9964962.png" },
  { id: 10149530, name: "HULIGANI", short: "HU", logo: "/logos/10149530.png" },
  { id: 10150413, name: "Iron Wing", short: "IW", logo: "/logos/10150413.png" },
  { id: 10150538, name: "LGD Gaming", short: "LGD", logo: "/logos/10150538.png" },
  { id: 10136357, name: "Nigma Galaxy", short: "NGX", logo: "/logos/10136357.png" },
  { id: 2586976, name: "OG", short: "OG", logo: "/logos/2586976.png" },
  { id: 9247354, name: "Team Falcons", short: "FLCN", logo: "/logos/9247354.png" },
  { id: 2163, name: "Team Liquid", short: "TL", logo: "/logos/2163.png" },
  { id: 5017210, name: "Team Resilience", short: "TR", logo: "/logos/5017210.png" },
  { id: 7119388, name: "Team Spirit", short: "TS", logo: "/logos/7119388.png" },
  { id: 9823272, name: "Team Yandex", short: "TY", logo: "/logos/9823272.png" },
  { id: 9572001, name: "TEAM VISION", short: "VSN", logo: "/logos/9572001.png" },
  { id: 726228, name: "Vici Gaming", short: "VG", logo: "/logos/726228.png" },
  { id: 8261500, name: "Xtreme Gaming", short: "XG", logo: "/logos/8261500.png" },
];

export const TEAM_BY_ID: ReadonlyMap<TeamId, Team> = new Map(TEAMS.map((t) => [t.id, t]));

/** Never throws. An unknown id renders as its number rather than blanking the row. */
export function getTeam(id: TeamId | null | undefined): Team | null {
  if (id == null) return null;
  return TEAM_BY_ID.get(id) ?? null;
}

export function teamName(id: TeamId | null | undefined): string {
  if (id == null) return "TBD";
  return TEAM_BY_ID.get(id)?.name ?? `Team ${id}`;
}

export function teamShort(id: TeamId | null | undefined): string {
  if (id == null) return "TBD";
  return TEAM_BY_ID.get(id)?.short ?? String(id);
}
