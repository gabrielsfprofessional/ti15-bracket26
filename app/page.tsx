import { LiveBar } from "@/components/LiveBar";
import { NextUp } from "@/components/NextUp";
import { SeriesCard } from "@/components/SeriesCard";
import { SwissTable } from "@/components/SwissTable";
import { buildTournament } from "@/lib/opendota";
import { formatEt } from "@/lib/time";
import type { Series, Tournament } from "@/lib/types";

// Re-fetch OpenDota at most once a minute. Phase 3 moves the source of truth to
// a committed data/tournament.json written by the GitHub Actions sync.
export const revalidate = 60;

const SYNC_DOT: Record<Tournament["syncState"], { color: string; label: string }> = {
  ok: { color: "#3fcf8e", label: "auto-syncing" },
  degraded: { color: "#e4432f", label: "degraded — OpenDota did not answer" },
  manual: { color: "#d8c089", label: "manual mode" },
};

export default async function Page() {
  const nowMs = Date.now();
  const t = await buildTournament(nowMs);

  const upcoming = pickUpcoming(t.series, nowMs, 3);
  // "unconfirmed" belongs here, not in the live bar. It has played games and a
  // real score, so dropping it would make a series vanish from the site
  // entirely — the opposite failure to the stale LIVE badge it replaced.
  const results = t.series
    .filter((s) => s.status === "completed" || s.status === "unconfirmed")
    .sort((a, b) => (b.startUtc ?? "").localeCompare(a.startUtc ?? ""));

  const dot = SYNC_DOT[t.syncState];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 pb-16">
      <header>
        <h1 className="text-2xl font-bold tracking-wide text-[#c9d3dc]">The International 2026</h1>
        <p className="text-sm text-[#6b7785]">
          Shanghai · Aug 13–23 · all times Eastern
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs text-[#6b7785]">
          <span
            aria-hidden
            style={{ background: dot.color }}
            className="inline-block h-2 w-2 rounded-full"
          />
          <span>
            Last synced {formatEt(t.lastSyncUtc)} · {dot.label}
          </span>
        </p>
      </header>

      <LiveBar series={t.series} />

      <NextUp upcoming={upcoming} />

      <SwissTable rows={t.swiss} />

      <section>
        <h2 className="text-xs uppercase tracking-widest text-[#6b7785]">
          Results ({results.length})
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {results.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      </section>

      <footer className="border-t border-[#232a33] pt-4 text-xs leading-relaxed text-[#6b7785]">
        Not affiliated with or endorsed by Valve Corporation. Dota 2 is a trademark of Valve. Match
        data from OpenDota.
      </footer>
    </main>
  );
}

/** Soonest-first upcoming matches that have not started yet. */
function pickUpcoming(series: Series[], nowMs: number, limit: number): Series[] {
  return series
    .filter((s) => s.status === "scheduled" || s.status === "tbd")
    .filter((s) => s.startUtc != null && Date.parse(s.startUtc) >= nowMs)
    .sort((a, b) => (a.startUtc ?? "").localeCompare(b.startUtc ?? ""))
    .slice(0, limit);
}
