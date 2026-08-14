"use client";

import { useEffect, useState } from "react";
import { SeriesCard } from "@/components/SeriesCard";
import { countdown } from "@/lib/time";
import type { Series } from "@/lib/types";

/**
 * The next three upcoming matches, chosen on the server.
 *
 * The countdown is client-only and starts as null, so the server HTML and the
 * first client render agree and nothing hydration-mismatches. It then recomputes
 * every 30 seconds, as specified.
 */
export function NextUp({ upcoming }: { upcoming: Series[] }) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (upcoming.length === 0) {
    return (
      <section>
        <h2 className="text-xs uppercase tracking-widest text-[#6b7785]">Next up</h2>
        <p className="mt-2 text-sm text-[#9aa7b4]">
          No upcoming matches entered yet. OpenDota has no schedule endpoint — add them by hand to{" "}
          <code className="text-[#d8c089]">data/schedule.json</code>.
        </p>
      </section>
    );
  }

  const next = upcoming[0];
  const untilNext = nowMs === null ? null : countdown(next.startUtc, nowMs);

  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest text-[#6b7785]">Next up</h2>

      {untilNext && (
        <p className="tabular mt-1 text-lg font-semibold text-[#d8c089]" aria-live="polite">
          {untilNext}
        </p>
      )}

      <div className="mt-2 flex flex-col gap-2">
        {upcoming.map((s) => (
          <SeriesCard key={s.id} series={s} />
        ))}
      </div>
    </section>
  );
}
