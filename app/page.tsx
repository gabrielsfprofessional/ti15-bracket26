import { TournamentView } from "@/components/TournamentView";
import { loadTournament } from "@/lib/state";

// Re-fetch OpenDota at most once a minute. loadTournament serves the statically
// bundled snapshot if fetching or validation fails.
export const revalidate = 60;

export default async function Page() {
  // This is a server-side observation timestamp passed into pure data assembly.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const tournament = await loadTournament(nowMs);

  return <TournamentView initialTournament={tournament} initialNowMs={nowMs} />;
}
