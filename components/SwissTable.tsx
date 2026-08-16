import { getTeam, teamName } from "@/data/teams";
import { TeamLogo } from "@/components/TeamLogo";
import type { Series, SwissRow, TeamId } from "@/lib/types";

/**
 * "Qualified for the Main Event", not "qualified directly": only the three teams
 * that reached four wins went straight through. The other five won an
 * Elimination Round series to get there, and saying otherwise would credit them
 * with a Swiss finish they did not have.
 */
const STATE: Record<SwissRow["state"], { label: string; description: string }> = {
  active: { label: "Active", description: "Still playing the Swiss stage" },
  advanced: { label: "Advanced", description: "Qualified for the Main Event" },
  elimination_round: { label: "Elimination Round", description: "Moves to the Elimination Round" },
  eliminated: { label: "Eliminated", description: "Out of the tournament" },
};

export function SwissTable({ rows, series }: { rows: SwissRow[]; series: Series[] }) {
  // Every team has settled, so this is the record the stage finished on rather
  // than a table still in motion.
  const stageComplete =
    rows.length > 0 && rows.every((row) => row.state === "advanced" || row.state === "eliminated");

  return (
    <section id="standings" className="command-section" aria-labelledby="standings-heading">
      <div className="section-heading">
        <span className="eyebrow">
          {stageComplete
            ? "Group stage complete · four wins advanced · four losses eliminated"
            : "Four wins advance · four losses eliminate"}
        </span>
        <h2 id="standings-heading">{stageComplete ? "Final Swiss standings" : "Swiss standings"}</h2>
        <p>
          {stageComplete
            ? "Final Group Stage records. The Elimination Round decided the last Main Event places without changing a team's Swiss record. "
            : ""}
          Sorted by record for readability. Official tiebreak seeding is not calculated or implied.
        </p>
      </div>

      <ul className="fate-legend" aria-label="Advancement status legend">
        {(Object.keys(STATE) as SwissRow["state"][]).map((state) => (
          <li key={state}>
            <span className={`fate-dot fate-dot--${state}`} aria-hidden />
            <strong>{STATE[state].label}</strong>
            <span>{STATE[state].description}</span>
          </li>
        ))}
      </ul>

      <div className="standings-table-wrap">
        <table className="standings-table">
          <caption className="sr-only">TI15 Swiss records, fate, and series journey</caption>
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">Record</th>
              <th scope="col">Status</th>
              <th scope="col">Series journey</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const team = getTeam(row.teamId);
              return (
                <tr key={row.teamId} data-fate={row.state}>
                  <th scope="row">
                    <span className="standings-team">
                      <TeamLogo teamId={row.teamId} size={28} />
                      <span>
                        <strong>{teamName(row.teamId)}</strong>
                        <small>{team?.short}</small>
                      </span>
                    </span>
                  </th>
                  <td className="standings-record numeric">{row.wins}–{row.losses}</td>
                  <td>
                    <span className={`fate-label fate-label--${row.state}`}>{STATE[row.state].label}</span>
                  </td>
                  <td>
                    <Journey teamId={row.teamId} state={row.state} series={series} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Journey({
  teamId,
  state,
  series,
}: {
  teamId: TeamId;
  state: SwissRow["state"];
  series: Series[];
}) {
  const results = series
    .filter((item) => item.section === "swiss" && item.status === "completed")
    .filter((item) => item.a.teamId === teamId || item.b.teamId === teamId)
    .sort((a, b) => (a.startUtc ?? "").localeCompare(b.startUtc ?? "") || a.id.localeCompare(b.id))
    .map((item) => (item.winnerId === teamId ? "W" : "L"));
  const endedAfterFour = results.length === 4 && (state === "advanced" || state === "eliminated");

  return (
    <span role="img" className="journey" aria-label={`${teamName(teamId)} series: ${results.join(", ") || "none completed"}${endedAfterFour ? ", stage ended after four" : ""}`}>
      {Array.from({ length: 5 }, (_, index) => {
        const result = results[index];
        if (result) return <span key={index} className={`journey__result journey__result--${result.toLowerCase()}`} aria-hidden>{result}</span>;
        if (index === 4 && endedAfterFour) return <span key={index} className="journey__result journey__result--stop" aria-hidden>■</span>;
        return <span key={index} className="journey__result journey__result--pending" aria-hidden>·</span>;
      })}
    </span>
  );
}
