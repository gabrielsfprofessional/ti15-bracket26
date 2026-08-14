import { TournamentView } from "@/components/TournamentView";
import { getTeam } from "@/data/teams";
import { loadTournament } from "@/lib/state";

// Re-fetch OpenDota at most once a minute. loadTournament serves the statically
// bundled snapshot if fetching or validation fails.
export const revalidate = 60;

export default async function Page() {
  // This is a server-side observation timestamp passed into pure data assembly.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const tournament = await loadTournament(nowMs);
  const events = tournament.series
    .filter((series) => series.status === "scheduled" && series.startUtc != null)
    .filter((series) => series.a.kind === "team" && series.b.kind === "team")
    .map((series) => {
      const a = getTeam(series.a.teamId);
      const b = getTeam(series.b.teamId);
      if (!a || !b) return null;
      return {
        "@type": "SportsEvent",
        name: `${a.name} vs ${b.name} — ${series.roundLabel}`,
        startDate: series.startUtc,
        eventStatus: "https://schema.org/EventScheduled",
        sport: "Dota 2",
        location: {
          "@type": "Place",
          name: "Shanghai, China",
          address: { "@type": "PostalAddress", addressLocality: "Shanghai", addressCountry: "CN" },
        },
        competitor: [
          { "@type": "SportsTeam", name: a.name },
          { "@type": "SportsTeam", name: b.name },
        ],
        url: `https://ti15-bracket26.vercel.app/#series-${series.id}`,
      };
    })
    .filter((event) => event !== null);

  return (
    <>
      {events.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ "@context": "https://schema.org", "@graph": events }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <TournamentView initialTournament={tournament} initialNowMs={nowMs} />
    </>
  );
}
