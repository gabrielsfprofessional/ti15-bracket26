import { TeamLogo } from "@/components/TeamLogo";
import type { BracketMatchView } from "@/lib/bracket-view";
import { formatTournamentTime, type TimeMode } from "@/lib/time";
import type { Series, SlotRef } from "@/lib/types";

const HAS_SCORE = new Set<Series["status"]>(["live", "unconfirmed", "completed"]);

/**
 * One node of the bracket board.
 *
 * Deliberately NOT a SeriesCard. A full card carries a per-game disclosure, and
 * fourteen of those inside a bracket would put ~40 collapsed <details> elements
 * on the board competing with the structure it exists to show. The full card
 * still renders every one of these series in Results, which is where per-game
 * detail belongs. This one shows the four things a bracket has to answer: who,
 * what score, what state, and when.
 *
 * The DOM id is bracket-scoped on purpose — the same series is published in
 * Schedule and Results too, and two elements cannot share an id.
 */
export function BracketCard({
  match,
  timeMode,
  localTimeZone,
}: {
  match: BracketMatchView;
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  const { series } = match;
  const showScore = HAS_SCORE.has(series.status);
  const winnerA = series.winnerId != null && series.a.teamId === series.winnerId;
  const winnerB = series.winnerId != null && series.b.teamId === series.winnerId;

  return (
    <article
      id={match.anchorId}
      className={`bracket-card status-${series.status}`}
      data-decided={match.isDecided ? "" : undefined}
      aria-label={`${match.label}: ${match.aText} versus ${match.bText}, ${match.statusText}`}
    >
      <div className="bracket-card__meta">
        <span className="bracket-card__label">{match.label}</span>
        <span className="numeric">Bo{series.bestOf}</span>
      </div>

      <div className="bracket-card__sides">
        <BracketSide
          slot={series.a}
          name={match.aText}
          score={series.scoreA}
          showScore={showScore}
          isWinner={winnerA}
          isLoser={match.isDecided && !winnerA}
        />
        <BracketSide
          slot={series.b}
          name={match.bText}
          score={series.scoreB}
          showScore={showScore}
          isWinner={winnerB}
          isLoser={match.isDecided && !winnerB}
        />
      </div>

      <div className="bracket-card__footer">
        <span className={`bracket-status bracket-status--${series.status}`}>
          {/* Live is stated in words as well as colour and motion. */}
          {series.status === "live" && <span className="bracket-status__pulse" aria-hidden />}
          {match.statusText}
        </span>
        <span className="bracket-card__time numeric">
          {formatTournamentTime(series.startUtc, timeMode, localTimeZone)}
        </span>
      </div>

      <a className="deep-link bracket-card__link" href={`#${match.anchorId}`} aria-label={`Link to ${match.label}`}>
        #
      </a>
    </article>
  );
}

function BracketSide({
  slot,
  name,
  score,
  showScore,
  isWinner,
  isLoser,
}: {
  slot: SlotRef;
  name: string;
  score: number;
  showScore: boolean;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const unresolved = slot.kind !== "team";
  return (
    <div
      className={`bracket-side ${isWinner ? "bracket-side--winner" : ""} ${isLoser ? "bracket-side--out" : ""}`}
      data-unresolved={unresolved ? "" : undefined}
    >
      <TeamLogo teamId={slot.teamId} size={24} />
      <span className="bracket-side__name">{name}</span>
      {isWinner && <span className="sr-only">winner</span>}
      {isLoser && <span className="sr-only">eliminated from this series</span>}
      {showScore && <span className="bracket-side__score numeric">{score}</span>}
    </div>
  );
}
