import { SeriesCard } from "@/components/SeriesCard";
import type { TimeMode } from "@/lib/time";
import type { Series } from "@/lib/types";

export function BracketSection({
  series,
  timeMode,
  localTimeZone,
}: {
  series: Series[];
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  const bracket = series.filter((item) => ["upper", "lower", "grand_final"].includes(item.section));

  return (
    <section id="bracket" className="command-section" aria-labelledby="bracket-heading">
      <div className="section-heading">
        <span className="eyebrow">Main Event · topology held until verified</span>
        <h2 id="bracket-heading">Bracket</h2>
        <p>The winner-of/loser-of propagation engine is ready; only authoritative pairings are published.</p>
      </div>

      {bracket.length === 0 ? (
        <div className="bracket-placeholder">
          <div className="vault-mark" aria-hidden><span /></div>
          <div>
            <strong>Main Event bracket will appear when official pairings are released</strong>
            <p>No topology, seed, or matchup is inferred from Swiss display order.</p>
          </div>
        </div>
      ) : (
        <BracketRenderer series={bracket} timeMode={timeMode} localTimeZone={localTimeZone} />
      )}
    </section>
  );
}

function BracketRenderer({
  series,
  timeMode,
  localTimeZone,
}: {
  series: Series[];
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  const rounds = groupRounds(series);
  return (
    <>
      <div className="bracket-rounds" tabIndex={0} aria-label="Bracket rounds; scroll horizontally within this region">
        {rounds.map((round) => (
          <section key={round.key} className="bracket-round" aria-labelledby={`bracket-${round.key}`}>
            <h3 id={`bracket-${round.key}`}>{round.label}</h3>
            <div className="bracket-round__matches">
              {round.items.map((item) => (
                <div key={item.id} className="bracket-connector">
                  <SeriesCard series={item} timeMode={timeMode} localTimeZone={localTimeZone} compact />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <details className="bracket-linear">
        <summary>Accessible linear bracket list</summary>
        <ol>
          {series.map((item) => (
            <li key={item.id}>
              <a href={`#series-${item.id}`}>{item.roundLabel}: {slotLabel(item.a)} vs {slotLabel(item.b)}</a>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}

function groupRounds(series: Series[]) {
  const groups = new Map<string, { key: string; label: string; items: Series[] }>();
  for (const item of series) {
    const key = `${item.section}-${item.round}`;
    const group = groups.get(key) ?? { key, label: item.roundLabel, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.items[0].round - b.items[0].round);
}

function slotLabel(slot: Series["a"]): string {
  if (slot.label) return slot.label;
  if (slot.kind === "team") return `Team ${slot.teamId}`;
  if (slot.kind === "winner_of") return `Winner of ${slot.matchId}`;
  if (slot.kind === "loser_of") return `Loser of ${slot.matchId}`;
  return "TBD";
}
