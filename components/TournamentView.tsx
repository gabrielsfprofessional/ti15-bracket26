"use client";

import { useEffect, useRef, useState } from "react";
import { BracketSection } from "@/components/BracketSection";
import { EliminationSection } from "@/components/EliminationSection";
import { LiveBar } from "@/components/LiveBar";
import { ResultsSection } from "@/components/ResultsSection";
import { ScheduleSection } from "@/components/ScheduleSection";
import { SwissTable } from "@/components/SwissTable";
import type { TimeMode } from "@/lib/time";
import type { Series, SlotRef, Tournament } from "@/lib/types";

const POLL_MS = 60_000;
const CLOCK_MS = 30_000;
const TIME_MODE_KEY = "ti15-time-mode";
const TIME_MODES = new Set<TimeMode>(["eastern", "local", "shanghai", "utc"]);

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
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">{syncAnnouncement}</p>
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
        <EliminationSection
          series={tournament.series}
          timeMode={timeMode}
          localTimeZone={localTimeZone}
        />
        <BracketSection
          series={tournament.series}
          timeMode={timeMode}
          localTimeZone={localTimeZone}
          championId={tournament.championId}
        />
        <ResultsSection
          series={tournament.series}
          teams={tournament.teams}
          timeMode={timeMode}
          localTimeZone={localTimeZone}
        />
      </main>
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

/**
 * What counts as "the tournament changed" for the polite live region.
 *
 * The resolved participants are part of it: a bracket slot flipping from
 * "Winner of Upper QF 1" to a real team is the single most meaningful update the
 * page can receive, and it happens without any score on that node moving.
 */
function stateSignature(series: Series[]): string {
  return series
    .map(
      (item) =>
        `${item.id}:${item.status}:${item.scoreA}:${item.scoreB}:${item.winnerId ?? ""}` +
        `:${slotSignature(item.a)}:${slotSignature(item.b)}`,
    )
    .join("|");
}

function slotSignature(slot: SlotRef): string {
  return slot.kind === "team" && slot.teamId != null ? String(slot.teamId) : slot.kind;
}
