"use client";

import { useEffect, useRef, useState } from "react";
import { BracketSection } from "@/components/BracketSection";
import { LiveBar } from "@/components/LiveBar";
import { ResultsSection } from "@/components/ResultsSection";
import { ScheduleSection } from "@/components/ScheduleSection";
import { SwissTable } from "@/components/SwissTable";
import { ago, formatTournamentTime, type TimeMode } from "@/lib/time";
import type { Series, Tournament } from "@/lib/types";

const POLL_MS = 60_000;
const CLOCK_MS = 30_000;
const TIME_MODE_KEY = "ti15-time-mode";
const TIME_MODES = new Set<TimeMode>(["eastern", "local", "shanghai", "utc"]);

const MODE_COPY: Record<Tournament["sourceHealth"]["mode"], { eyebrow: string; title: string }> = {
  live: { eyebrow: "Sources healthy", title: "Live data" },
  degraded: { eyebrow: "Upstream degraded", title: "Fallback snapshot" },
  manual: { eyebrow: "Operator controlled", title: "Manual mode" },
};

export function TournamentView({
  initialTournament,
  initialNowMs,
}: {
  initialTournament: Tournament;
  initialNowMs: number;
}) {
  const [tournament, setTournament] = useState(initialTournament);
  const [nowMs, setNowMs] = useState(initialNowMs);
  const [timeMode, setTimeMode] = useState<TimeMode>("eastern");
  const [localTimeZone, setLocalTimeZone] = useState<string>();
  const [syncAnnouncement, setSyncAnnouncement] = useState("");
  const signatureRef = useRef(stateSignature(initialTournament.series));

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(TIME_MODE_KEY) as TimeMode | null;
        if (stored && TIME_MODES.has(stored)) setTimeMode(stored);
      } catch {
        // Storage may be disabled; Eastern remains the hydration-safe default.
      }
      setLocalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || undefined);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    let inFlight: Promise<void> | null = null;

    function refresh(): Promise<void> {
      if (inFlight) return inFlight;
      controller = new AbortController();
      inFlight = (async () => {
        try {
          const response = await fetch("/api/state", {
            headers: { Accept: "application/json" },
            signal: controller?.signal,
          });
          if (!response.ok) throw new Error("state endpoint returned HTTP " + response.status);

          const payload: unknown = await response.json();
          if (!isTournament(payload)) throw new Error("state endpoint returned an invalid payload");
          if (active) {
            const signature = stateSignature(payload.series);
            if (signature !== signatureRef.current) {
              signatureRef.current = signature;
              setSyncAnnouncement("Tournament match state updated.");
            }
            setTournament((current) =>
              Date.parse(payload.lastSyncUtc) >= Date.parse(current.lastSyncUtc) ? payload : current,
            );
          }
        } catch (error) {
          if (active && !(error instanceof DOMException && error.name === "AbortError")) {
            console.warn("[poll] keeping the last valid tournament state", error);
          }
        } finally {
          inFlight = null;
          controller = null;
        }
      })();
      return inFlight;
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    if (Date.now() - Date.parse(initialTournament.lastSyncUtc) >= POLL_MS) void refresh();

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [initialTournament.lastSyncUtc]);

  const changeTimeMode = (mode: TimeMode) => {
    setTimeMode(mode);
    if (mode === "local" && !localTimeZone) {
      setLocalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || undefined);
    }
    try {
      window.localStorage.setItem(TIME_MODE_KEY, mode);
    } catch {
      // Preference persistence is optional; the control still works in memory.
    }
  };

  const upcoming = [...tournament.series]
    .filter((item) => item.status === "scheduled" || item.status === "tbd")
    .filter((item) => item.startUtc != null && Date.parse(item.startUtc) >= nowMs)
    .sort((a, b) => (a.startUtc ?? "").localeCompare(b.startUtc ?? ""));
  const nextSeries = upcoming[0];
  const completed = tournament.series.filter((item) => item.status === "completed").length;
  const phase = derivePhase(tournament.series, nextSeries);
  const modeCopy = MODE_COPY[tournament.sourceHealth.mode];

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to tournament data</a>
      <p className="sr-only" role="status" aria-live="polite">{syncAnnouncement}</p>

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
                  <div><dt>Matches</dt><dd>{tournament.sourceHealth.matches.status} · {formatTournamentTime(tournament.sourceHealth.matches.observedUtc, timeMode, localTimeZone)}</dd></div>
                  <div><dt>Live feed</dt><dd>{tournament.sourceHealth.live.status} · {formatTournamentTime(tournament.sourceHealth.live.observedUtc, timeMode, localTimeZone)}</dd></div>
                  <div><dt>Schedule</dt><dd>{tournament.sourceHealth.schedule.status} · checked-in corrections</dd></div>
                  <div><dt>Snapshot</dt><dd>{formatTournamentTime(tournament.sourceHealth.snapshotGeneratedUtc, timeMode, localTimeZone)}</dd></div>
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

      <main id="main-content" className="command-center" tabIndex={-1}>
        <LiveBar
          series={tournament.series}
          nextSeries={nextSeries}
          timeMode={timeMode}
          localTimeZone={localTimeZone}
        />
        <ScheduleSection
          series={tournament.series}
          teams={tournament.teams}
          timeMode={timeMode}
          localTimeZone={localTimeZone}
          onTimeModeChange={changeTimeMode}
        />
        <SwissTable rows={tournament.swiss} series={tournament.series} />
        <BracketSection series={tournament.series} timeMode={timeMode} localTimeZone={localTimeZone} />
        <ResultsSection
          series={tournament.series}
          teams={tournament.teams}
          timeMode={timeMode}
          localTimeZone={localTimeZone}
        />
      </main>

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
    </>
  );
}

export function isTournament(value: unknown): value is Tournament {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Partial<Tournament>;
  return (
    candidate.leagueId === 19719 &&
    Array.isArray(candidate.teams) &&
    candidate.teams.length === 16 &&
    Array.isArray(candidate.swiss) &&
    Array.isArray(candidate.series) &&
    typeof candidate.lastSyncUtc === "string" &&
    candidate.sourceHealth != null &&
    typeof candidate.sourceHealth === "object" &&
    (candidate.syncState === "ok" || candidate.syncState === "degraded" || candidate.syncState === "manual")
  );
}

function stateSignature(series: Series[]): string {
  return series
    .map((item) => `${item.id}:${item.status}:${item.scoreA}:${item.scoreB}:${item.winnerId ?? ""}`)
    .join("|");
}

function derivePhase(series: Series[], nextSeries?: Series): string {
  if (series.some((item) => item.status === "live")) return "Group stage · live";
  if (nextSeries?.section === "swiss") return `Group stage · ${nextSeries.roundLabel.split(" · ")[0]}`;
  if (series.some((item) => item.section !== "swiss")) return "Main Event";
  return "Group stage";
}
