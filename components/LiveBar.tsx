import { teamName } from "@/data/teams";
import type { Series } from "@/lib/types";

/**
 * Shown only while OpenDota's live feed has a game for this league.
 *
 * The game number is derived, not fetched: in a series that stands at 1-1, the
 * game in progress is game 3. The live endpoint's own radiant_score/dire_score
 * are kill counts and are never read here or anywhere else.
 */
export function LiveBar({ series }: { series: Series[] }) {
  const live = series.filter((s) => s.status === "live");
  if (live.length === 0) return null;

  return (
    <section className="border border-[#e4432f] p-3">
      <h2 className="text-xs uppercase tracking-widest text-[#e4432f]">Live now</h2>

      <ul className="mt-2 flex flex-col gap-3">
        {live.map((s) => {
          const gameNumber = s.scoreA + s.scoreB + 1;
          return (
            <li key={s.id}>
              <div className="text-base font-semibold text-[#c9d3dc]">
                {teamName(s.a.teamId)} <span className="tabular text-[#9aa7b4]">{s.scoreA}</span>
                <span className="mx-2 text-[#6b7785]">vs</span>
                <span className="tabular text-[#9aa7b4]">{s.scoreB}</span> {teamName(s.b.teamId)}
              </div>
              <div className="text-sm text-[#9aa7b4]">
                Game {gameNumber} of Bo{s.bestOf}
                <span className="mx-1">·</span>
                series {s.scoreA}–{s.scoreB}
                {s.streamUrl && (
                  <>
                    <span className="mx-1">·</span>
                    <a
                      className="underline"
                      href={s.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Watch
                    </a>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
