import { teamName } from "@/data/teams";
import { SeriesCard } from "@/components/SeriesCard";
import type { TimeMode } from "@/lib/time";
import type { Series } from "@/lib/types";

/** Teams that go into the elimination round, and the slots that come out of it. */
const ENTRANTS = 10;
const SURVIVORS = 5;

/**
 * The elimination round: the last five Bo3s of the group stage. Ten teams in,
 * five out, and the five winners join the three teams that advanced directly to
 * make the eight-team Main Event field.
 *
 * Pairings here are CHOSEN, not seeded — the best 3-2 team picks any of the five
 * 2-3 teams, then the next 3-2 team picks from what is left, and so on. That is
 * not derivable from any API, so nothing on this page infers a matchup. Until
 * the pairings are hand-entered into data/schedule.json, the section renders its
 * pre-pairing state rather than an empty shell.
 */
export function EliminationSection({
  series,
  timeMode,
  localTimeZone,
}: {
  series: Series[];
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  const elimination = series
    .filter((item) => item.section === "elimination")
    .sort((a, b) => (a.startUtc ?? "9999").localeCompare(b.startUtc ?? "9999") || a.id.localeCompare(b.id));

  const decided = elimination.filter((item) => item.status === "completed" && item.winnerId != null);

  return (
    <section id="elimination" className="command-section" aria-labelledby="elimination-heading">
      <div className="section-heading">
        <span className="eyebrow">Group stage · win or go home</span>
        <h2 id="elimination-heading">Elimination round</h2>
        <p>
          Ten teams, five Bo3 series. Every winner takes a Main Event place; every loser is out of
          the tournament. The five survivors join the three teams that advanced directly to form the
          eight-team Main Event field.
        </p>
      </div>

      {elimination.length === 0 ? (
        <PendingPairings />
      ) : (
        <>
          <p className="elimination-progress">
            <strong className="numeric">{decided.length}</strong> of{" "}
            <strong className="numeric">{elimination.length}</strong> series decided ·{" "}
            <span>{SURVIVORS} Main Event places at stake</span>
          </p>
          <ol className="elimination-list">
            {elimination.map((item) => (
              <li key={item.id}>
                <SeriesCard series={item} timeMode={timeMode} localTimeZone={localTimeZone} />
                <Stakes series={item} />
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/**
 * Spells out what the series is worth, and names the outcome once there is one.
 * Before a result this is the same sentence on every card, which is the point —
 * the stakes are identical and absolute.
 */
function Stakes({ series }: { series: Series }) {
  const settled = series.status === "completed" && series.winnerId != null;

  if (!settled) {
    return (
      <p className="elimination-stakes">
        <span className="elimination-stakes__advance">Winner → Main Event</span>
        <span className="elimination-stakes__sep" aria-hidden>·</span>
        <span className="elimination-stakes__out">Loser eliminated</span>
      </p>
    );
  }

  const loserId = series.a.teamId === series.winnerId ? series.b.teamId : series.a.teamId;
  return (
    <p className="elimination-stakes elimination-stakes--settled">
      <span className="elimination-stakes__advance">
        <strong>{teamName(series.winnerId)}</strong> → Main Event
      </span>
      <span className="elimination-stakes__sep" aria-hidden>·</span>
      <span className="elimination-stakes__out">
        <strong>{teamName(loserId)}</strong> eliminated
      </span>
    </p>
  );
}

/**
 * The state this section is in until Round 5 finishes. It explains the format
 * and why nothing is listed yet, rather than leaving a heading over emptiness.
 */
function PendingPairings() {
  return (
    <div className="elimination-pending">
      <div className="elimination-pending__rule" aria-hidden>
        <span />
        <span className="elimination-pending__glyph" />
        <span />
      </div>
      <strong>Pairings are announced after Round 5</strong>
      <p>
        The {ENTRANTS} teams that finish the Swiss stage without four wins or four losses play this
        round. Matchups are <em>chosen, not seeded</em>: the highest-placed 3–2 team picks its
        opponent from the 2–3 teams, then the next 3–2 team picks from the rest.
      </p>
      <p className="elimination-pending__note">
        Because the picks are made on stage, no API publishes them. They are entered by hand and
        verified before they appear here — this site never infers a matchup from standings order.
      </p>
    </div>
  );
}
