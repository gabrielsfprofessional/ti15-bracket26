import { getTeam } from "@/data/teams";
import type { TeamId } from "@/lib/types";

export function TeamLogo({ teamId, size = 28 }: { teamId?: TeamId; size?: number }) {
  const team = getTeam(teamId);
  if (!team?.logo) {
    return (
      <span className="team-logo team-logo--empty" style={{ width: size, height: size }} aria-hidden>
        —
      </span>
    );
  }

  return (
    // Small local marks already have fixed intrinsic dimensions and are lazy
    // below the fold. A native image avoids shipping the Next image runtime in
    // every interactive match card without sacrificing CLS protection.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="team-logo"
      src={team.logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}
