import Image from "next/image";
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
    <Image
      className="team-logo"
      src={team.logo}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
    />
  );
}
