"use client";

import { useEffect, useMemo, useState } from "react";
import { RuneDivider, SectionAmbient } from "@/components/SectionAmbient";
import { SeriesCard } from "@/components/SeriesCard";
import type { TimeMode } from "@/lib/time";
import type { Series, Team, TeamId } from "@/lib/types";

const PAGE_SIZE = 8;

export function ResultsSection({
  series,
  teams,
  timeMode,
  localTimeZone,
}: {
  series: Series[];
  teams: Team[];
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  const [teamId, setTeamId] = useState<TeamId | "all">("all");
  const [round, setRound] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const completed = useMemo(
    () =>
      [...series]
        .filter((item) => item.status === "completed")
        .sort((a, b) => (b.startUtc ?? "").localeCompare(a.startUtc ?? "") || b.id.localeCompare(a.id)),
    [series],
  );
  const rounds = [...new Set(completed.map((item) => item.roundLabel))];
  const filtered = completed
    .filter((item) => round === "all" || item.roundLabel === round)
    .filter((item) => teamId === "all" || item.a.teamId === teamId || item.b.teamId === teamId);
  const visible = filtered.slice(0, limit);
  const visibleIdSignature = visible.map((item) => item.id).join("|");
  const grouped = groupByRound(visible);

  // A scheduled card's canonical #series-<id> link remains valid after the
  // match becomes final, even when that final is older than the first Results
  // page. Reveal the target, clear filters that could hide it, then scroll once
  // React has committed the card. Hash navigation stays the site's only route.
  useEffect(() => {
    const revealHash = () => {
      const anchor = window.location.hash.replace(/^#/, "");
      if (!anchor.startsWith("series-")) return;
      const id = anchor.slice("series-".length);
      const index = completed.findIndex((item) => item.id === id);
      if (index < 0) return;
      setRound("all");
      setTeamId("all");
      setLimit((current) => Math.max(current, index + 1));
    };

    revealHash();
    window.addEventListener("hashchange", revealHash);
    return () => window.removeEventListener("hashchange", revealHash);
  }, [completed]);

  useEffect(() => {
    const anchor = window.location.hash.replace(/^#/, "");
    if (!anchor.startsWith("series-")) return;
    document.getElementById(anchor)?.scrollIntoView();
  }, [visibleIdSignature]);

  return (
    <section id="results" className="command-section" aria-labelledby="results-heading">
      <SectionAmbient name="results" />
      <div className="section-heading">
        <span className="eyebrow">Latest first · every final deep-linked</span>
        <h2 id="results-heading">Results</h2>
        <p>Expand a series for individual games, final kill scores, duration, sides, and OpenDota links.</p>
      </div>
      <RuneDivider />

      <div className="filter-bar" aria-label="Result filters">
        <label>
          <span>Round</span>
          <select
            value={round}
            onChange={(event) => {
              setRound(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="all">All rounds</option>
            {rounds.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Team</span>
          <select
            value={teamId}
            onChange={(event) => {
              setTeamId(event.target.value === "all" ? "all" : Number(event.target.value));
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="all">All teams</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <span className="filter-count numeric">{filtered.length} finals</span>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <strong>No results in this view</strong>
          <span>Change the round or team filter.</span>
        </div>
      ) : (
        <div className="result-groups">
          {grouped.map((group) => (
            <section key={group.label} className="result-group">
              <h3>{group.label}</h3>
              <div className="series-grid">
                {group.items.map((item) => (
                  <SeriesCard
                    key={item.id}
                    series={item}
                    timeMode={timeMode}
                    localTimeZone={localTimeZone}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {limit < filtered.length && (
        <button className="show-more" type="button" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
          Show {Math.min(PAGE_SIZE, filtered.length - limit)} more results
        </button>
      )}
    </section>
  );
}

function groupByRound(series: Series[]) {
  const groups = new Map<string, Series[]>();
  for (const item of series) {
    const bucket = groups.get(item.roundLabel) ?? [];
    bucket.push(item);
    groups.set(item.roundLabel, bucket);
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}
