import { AegisMedallion } from "@/components/AegisMedallion";
import { ART_ENABLED } from "@/lib/art";
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
        {ART_ENABLED ? (
          <>
            {/*
              Backdrop only, and never the site's identity — that is the live
              text below. Art-directed per breakpoint: the desktop band is far
              too wide to letterbox onto a phone without losing every face.
              Absolutely positioned, so it contributes no layout and cannot
              shift anything while it decodes.
            */}
            <div className="hero__art" aria-hidden>
              <picture>
                <source type="image/avif" media="(min-width: 820px)" srcSet="/art/hero-desktop.avif" />
                <source type="image/webp" media="(min-width: 820px)" srcSet="/art/hero-desktop.webp" />
                <source type="image/avif" srcSet="/art/hero-mobile.avif" />
                <source type="image/webp" srcSet="/art/hero-mobile.webp" />
                {/* decoding must stay async. A sync decode was tried to chase LCP
                    render delay and moved it by ~3%, well inside run-to-run
                    noise -- the delay here is not decode-bound. Async is the
                    right default anyway: it keeps AVIF decode off the main
                    thread during hydration. */}
                <img src="/art/hero-mobile.webp" alt="" width={1600} height={556} decoding="async" fetchPriority="high" />
              </picture>
            </div>
            <div className="hero__scrim" aria-hidden />
          </>
        ) : (
          <div className="hero__geometry" aria-hidden><span /><span /><span /></div>
        )}
        <div className="hero__content">
          <p className="hero__mark" aria-hidden>TI15</p>
          <h1><span>The International</span> 2026</h1>
          <p className="hero__venue">
            <span>Shanghai, China</span>
            <span className="hero__venue-sep" aria-hidden>·</span>
            <span className="numeric">August 13–23, 2026</span>
          </p>
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
        <div className="hero__rail">
          {/*
            Deliberately NOT priority. Below 560px the hero medallion is
            display:none, and an eager <img> is still fetched when hidden --
            measured at 23KB of AVIF downloaded and decoded on a phone for
            something no one can see, competing with the LCP image. Lazy lets
            the browser skip it entirely when hidden, and still loads it
            promptly on desktop where it is in the viewport at load.
          */}
          <AegisMedallion won={tournament.championId != null} size={148} className="aegis--hero" />
          <dl className="hero__stats">
            <div><dt>Teams</dt><dd className="numeric">{tournament.teams.length}</dd></div>
            <div><dt>Series final</dt><dd className="numeric">{completed}</dd></div>
            <div><dt>Published</dt><dd className="numeric">{tournament.series.length}</dd></div>
          </dl>
        </div>
      </header>

      <nav className="anchor-nav" aria-label="Tournament sections">
        <div>
          <a href="#live">Live</a>
          <a href="#schedule">Schedule</a>
          <a href="#standings">Standings</a>
          <a href="#elimination">Elimination</a>
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
