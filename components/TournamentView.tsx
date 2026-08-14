"use client";

import { useEffect, useState } from "react";
import { LiveBar } from "@/components/LiveBar";
import { NextUp } from "@/components/NextUp";
import { SeriesCard } from "@/components/SeriesCard";
import { SwissTable } from "@/components/SwissTable";
import { formatEt } from "@/lib/time";
import type { Series, Tournament } from "@/lib/types";

const POLL_MS = 60_000;
const CLOCK_MS = 30_000;

const SYNC_DOT: Record<Tournament["syncState"], { color: string; label: string }> = {
  ok: { color: "#3fcf8e", label: "auto-syncing" },
  degraded: { color: "#e4432f", label: "degraded — serving fallback snapshot" },
  manual: { color: "#d8c089", label: "manual mode" },
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

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;

    async function refresh(): Promise<void> {
      controller = new AbortController();
      try {
        const response = await fetch("/api/state", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("state endpoint returned HTTP " + response.status);

        const payload: unknown = await response.json();
        if (!isTournament(payload)) throw new Error("state endpoint returned an invalid payload");
        if (active) setTournament(payload);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("[poll] keeping the last valid tournament state", error);
        }
      }
    }

    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(id);
    };
  }, []);

  const upcoming = pickUpcoming(tournament.series, nowMs, 3);
  const results = tournament.series
    .filter((series) => series.status === "completed" || series.status === "unconfirmed")
    .sort((a, b) => (b.startUtc ?? "").localeCompare(a.startUtc ?? ""));
  const dot = SYNC_DOT[tournament.syncState];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 pb-16">
      <header>
        <h1 className="text-2xl font-bold tracking-wide text-[#c9d3dc]">
          The International 2026
        </h1>
        <p className="text-sm text-[#6b7785]">Shanghai · Aug 13–23 · all times Eastern</p>
        <p className="mt-1 flex items-center gap-2 text-xs text-[#6b7785]" aria-live="polite">
          <span
            aria-hidden
            style={{ background: dot.color }}
            className="inline-block h-2 w-2 rounded-full"
          />
          <span>
            Last synced {formatEt(tournament.lastSyncUtc)} · {dot.label}
            {tournament.syncState === "degraded" &&
              " · snapshot " + ageOf(tournament.lastSyncUtc, nowMs) + " old"}
          </span>
        </p>
      </header>

      <LiveBar series={tournament.series} />
      <NextUp upcoming={upcoming} />
      <SwissTable rows={tournament.swiss} />

      <section>
        <h2 className="text-xs uppercase tracking-widest text-[#6b7785]">
          Results ({results.length})
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {results.map((series) => (
            <SeriesCard key={series.id} series={series} />
          ))}
        </div>
      </section>

      <footer className="border-t border-[#232a33] pt-4 text-xs leading-relaxed text-[#6b7785]">
        Not affiliated with or endorsed by Valve Corporation. Dota 2 is a trademark of Valve.
        Match data from OpenDota.
      </footer>
    </main>
  );
}

function isTournament(value: unknown): value is Tournament {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Partial<Tournament>;
  return (
    candidate.leagueId === 19719 &&
    Array.isArray(candidate.teams) &&
    Array.isArray(candidate.swiss) &&
    Array.isArray(candidate.series) &&
    typeof candidate.lastSyncUtc === "string" &&
    (candidate.syncState === "ok" ||
      candidate.syncState === "degraded" ||
      candidate.syncState === "manual")
  );
}

function ageOf(utc: string, nowMs: number): string {
  const parsed = Date.parse(utc);
  if (Number.isNaN(parsed)) return "unknown";

  const minutes = Math.floor(Math.max(0, nowMs - parsed) / 60_000);
  if (minutes < 1) return "less than 1m";
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  return Math.floor(hours / 24) + "d";
}

/** Soonest-first upcoming matches that have not started yet. */
function pickUpcoming(series: Series[], nowMs: number, limit: number): Series[] {
  return series
    .filter((item) => item.status === "scheduled" || item.status === "tbd")
    .filter((item) => item.startUtc != null && Date.parse(item.startUtc) >= nowMs)
    .sort((a, b) => (a.startUtc ?? "").localeCompare(b.startUtc ?? ""))
    .slice(0, limit);
}
