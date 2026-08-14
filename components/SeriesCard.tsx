import { getTeam } from "@/data/teams";
import { formatEtDay, formatEtTime } from "@/lib/time";
import type { Series, SlotRef } from "@/lib/types";

/**
 * One series. The two things this has to answer in under two seconds are WHEN it
 * starts and WHO is playing, so the day+time line and the two team rows are the
 * only things given any weight. Phase 1 styling is plain on purpose.
 */
export function SeriesCard({ series }: { series: Series }) {
  const winnerA = series.winnerId != null && series.a.teamId === series.winnerId;
  const winnerB = series.winnerId != null && series.b.teamId === series.winnerId;

  return (
    <article id={`series-${series.id}`} className="border border-[#232a33] p-3">
      <div className="flex items-baseline justify-between gap-3 text-xs text-[#6b7785]">
        <span className="uppercase tracking-wide">{series.roundLabel}</span>
        <span className="tabular">Bo{series.bestOf}</span>
      </div>

      {/* WHEN — day is never omitted; a bare clock is ambiguous for this event. */}
      <div className="mt-1 mb-2">
        <div className="text-base font-semibold text-[#c9d3dc]">{formatEtDay(series.startUtc)}</div>
        <div className="tabular text-sm text-[#9aa7b4]">{formatEtTime(series.startUtc)}</div>
      </div>

      {/* WHO */}
      <div className="flex flex-col gap-1">
        <TeamSide slot={series.a} score={series.scoreA} isWinner={winnerA} />
        <TeamSide slot={series.b} score={series.scoreB} isWinner={winnerB} />
      </div>

      <div className="mt-2 text-xs text-[#6b7785]">
        <span>{series.status}</span>
        <span className="mx-1">·</span>
        <span>{series.source}</span>
      </div>
    </article>
  );
}

export function TeamSide({
  slot,
  score,
  isWinner = false,
  showScore = true,
}: {
  slot: SlotRef;
  score?: number;
  isWinner?: boolean;
  showScore?: boolean;
}) {
  const team = getTeam(slot.teamId);

  return (
    <div className="flex items-center gap-2">
      {team ? (
        // Plain <img>: these are 16 small committed files served from our own
        // origin, never a hotlink to Steam's CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center text-[10px] text-[#6b7785]">
          —
        </span>
      )}

      <span className={isWinner ? "font-semibold text-[#c9d3dc]" : "text-[#9aa7b4]"}>
        {team ? team.name : (slot.label ?? "TBD")}
      </span>

      {showScore && score != null && (
        <span className={`tabular ml-auto ${isWinner ? "text-[#3fcf8e]" : "text-[#6b7785]"}`}>
          {score}
        </span>
      )}
    </div>
  );
}
