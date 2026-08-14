import { ago, formatTournamentTime } from "@/lib/time";
import type { Series, Tournament } from "@/lib/types";

const MODE_COPY: Record<Tournament["sourceHealth"]["mode"], { eyebrow: string; title: string }> = {
  live: { eyebrow: "Sources healthy", title: "Live data" },
  degraded: { eyebrow: "Upstream degraded", title: "Fallback snapshot" },
  manual: { eyebrow: "Operator controlled", title: "Manual mode" },
};

export function TournamentHeader({
  tournament,
  nowMs,
}: {
  tournament: Tournament;
  nowMs: number;
}) {
  const completed = tournament.series.filter((item) => item.status === "completed").length;
  const nextSeries = [...tournament.series]
    .filter((item) => item.status === "scheduled" || item.status === "tbd")
    .filter((item) => item.startUtc != null && Date.parse(item.startUtc) >= nowMs)
    .sort((a, b) => (a.startUtc ?? "").localeCompare(b.startUtc ?? ""))[0];
  const phase = derivePhase(tournament.series, nextSeries);
  const modeCopy = MODE_COPY[tournament.sourceHealth.mode];

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to tournament data</a>
      <header className="hero" id="top">
        <div className="hero__geometry" aria-hidden><span /><span /><span /></div>
        <div className="hero__content">
          <div className="hero__kicker">TI15 · Shanghai · August 13–23</div>
          <h1><span>The International</span> 2026</h1>
          <p className="hero__lede">The live tournament, decoded: what is happening, what starts next, and who still has a path forward.</p>
          <div className="hero__badges">
            <span className="phase-badge">{phase}</span>
            <details className={`source-badge source-badge--${tournament.sourceHealth.mode}`}>
              <summary>
                <span className="source-badge__dot" aria-hidden />
                <span><strong>{modeCopy.title}</strong> · {ago(tournament.lastSyncUtc, nowMs)}</span>
              </summary>
              <div className="source-popover">
                <span className="eyebrow">{modeCopy.eyebrow}</span>
                <dl>
                  <div><dt>Matches</dt><dd>{tournament.sourceHealth.matches.status} · {formatTournamentTime(tournament.sourceHealth.matches.observedUtc, "eastern")}</dd></div>
                  <div><dt>Live feed</dt><dd>{tournament.sourceHealth.live.status} · {formatTournamentTime(tournament.sourceHealth.live.observedUtc, "eastern")}</dd></div>
                  <div><dt>Schedule</dt><dd>{tournament.sourceHealth.schedule.status} · checked-in corrections</dd></div>
                  <div><dt>Snapshot</dt><dd>{formatTournamentTime(tournament.sourceHealth.snapshotGeneratedUtc, "eastern")}</dd></div>
                </dl>
              </div>
            </details>
          </div>
        </div>
        <dl className="hero__stats">
          <div><dt>Teams</dt><dd className="numeric">{tournament.teams.length}</dd></div>
          <div><dt>Series final</dt><dd className="numeric">{completed}</dd></div>
          <div><dt>Published</dt><dd className="numeric">{tournament.series.length}</dd></div>
        </dl>
      </header>

      <nav className="anchor-nav" aria-label="Tournament sections">
        <div>
          <a href="#live">Live</a>
          <a href="#schedule">Schedule</a>
          <a href="#standings">Standings</a>
          <a href="#bracket">Bracket</a>
          <a href="#results">Results</a>
        </div>
      </nav>
    </>
  );
}

export function TournamentFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Unofficial TI15 tournament companion</strong>
        <p>Not affiliated with or endorsed by Valve Corporation. Dota 2 and The International are Valve properties.</p>
      </div>
      <div>
        <p>Match data from OpenDota · future schedule managed and manually verified.</p>
        <p>Team logos are owned by their respective organizations.</p>
      </div>
    </footer>
  );
}

function derivePhase(series: Series[], nextSeries?: Series): string {
  if (series.some((item) => item.status === "live")) return "Group stage · live";
  if (nextSeries?.section === "swiss") return `Group stage · ${nextSeries.roundLabel.split(" · ")[0]}`;
  if (series.some((item) => item.section !== "swiss")) return "Main Event";
  return "Group stage";
}
