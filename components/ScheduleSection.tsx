"use client";

import { useMemo, useState } from "react";
import { SeriesCard } from "@/components/SeriesCard";
import { TimeControls } from "@/components/TimeControls";
import { formatTournamentDay, tournamentDayKey, type TimeMode } from "@/lib/time";
import type { Series, Team, TeamId } from "@/lib/types";

type ScheduleFilter = "all" | "live" | "upcoming" | "completed";

const FILTERS: Array<{ value: ScheduleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

export function ScheduleSection({
  series,
  teams,
  timeMode,
  localTimeZone,
  onTimeModeChange,
}: {
  series: Series[];
  teams: Team[];
  timeMode: TimeMode;
  localTimeZone?: string;
  onTimeModeChange: (mode: TimeMode) => void;
}) {
  const [filter, setFilter] = useState<ScheduleFilter>("upcoming");
  const [teamId, setTeamId] = useState<TeamId | "all">("all");

  const visible = useMemo(
    () =>
      [...series]
        .filter((item) => matchesStatus(item, filter))
        .filter((item) =>
          teamId === "all" ? true : item.a.teamId === teamId || item.b.teamId === teamId,
        )
        .sort((a, b) => (a.startUtc ?? "9999").localeCompare(b.startUtc ?? "9999") || a.id.localeCompare(b.id)),
    [filter, series, teamId],
  );

  const days = groupSchedule(visible, timeMode, localTimeZone);
  const simultaneous = new Map<string, number>();
  for (const item of visible) {
    if (item.startUtc) simultaneous.set(item.startUtc, (simultaneous.get(item.startUtc) ?? 0) + 1);
  }

  return (
    <section id="schedule" className="command-section" aria-labelledby="schedule-heading">
      <div className="section-heading section-heading--with-controls">
        <div>
          <span className="eyebrow">Every series · one timeline</span>
          <h2 id="schedule-heading">Schedule</h2>
          <p>All published future matches remain visible. Times include weekday, date, clock, and zone.</p>
        </div>
        <TimeControls value={timeMode} onChange={onTimeModeChange} />
      </div>

      <div className="filter-bar" aria-label="Schedule filters">
        <div className="segmented" role="group" aria-label="Match status">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label>
          <span>Team</span>
          <select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value === "all" ? "all" : Number(event.target.value))}
          >
            <option value="all">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </label>
        <span className="filter-count numeric">{visible.length} matches</span>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <strong>No matches in this view</strong>
          <span>Change the status or team filter to see the complete timeline.</span>
        </div>
      ) : (
        <div className="schedule-days">
          {days.map((day) => (
            <section key={day.key} className="schedule-day" aria-labelledby={`day-${day.key}`}>
              <div className="schedule-day__heading">
                <h3 id={`day-${day.key}`}>{day.label}</h3>
                <span className="numeric">{day.count} matches</span>
              </div>
              {day.rounds.map((round) => (
                <div key={round.label} className="schedule-round">
                  <h4>{round.label}</h4>
                  <div className="series-grid">
                    {round.items.map((item) => (
                      <div key={item.id} className="schedule-slot">
                        {(simultaneous.get(item.startUtc ?? "") ?? 0) > 1 && (
                          <span className="simultaneous-note">
                            {simultaneous.get(item.startUtc ?? "")} matches at this time
                          </span>
                        )}
                        {/* Schedule owns the canonical `series-<id>` anchor
                            until a match is final, at which point Results owns
                            it — so a `#series-<id>` link always lands on a card
                            that is actually rendered for that state, and the
                            Completed filter cannot duplicate an id. */}
                        <SeriesCard
                          series={item}
                          timeMode={timeMode}
                          localTimeZone={localTimeZone}
                          compact
                          anchorPrefix={ownsCanonicalAnchor(item) ? "series" : "schedule"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function ownsCanonicalAnchor(item: Series): boolean {
  return item.status === "scheduled" || item.status === "tbd" || item.status === "unconfirmed";
}

function matchesStatus(item: Series, filter: ScheduleFilter): boolean {
  if (filter === "all") return true;
  if (filter === "live") return item.status === "live";
  if (filter === "completed") return item.status === "completed";
  return item.status === "scheduled" || item.status === "tbd" || item.status === "unconfirmed";
}

function groupSchedule(series: Series[], mode: TimeMode, localTimeZone?: string) {
  const days = new Map<string, { key: string; label: string; items: Series[] }>();
  for (const item of series) {
    const key = tournamentDayKey(item.startUtc, mode, localTimeZone);
    const day = days.get(key) ?? {
      key,
      label: formatTournamentDay(item.startUtc, mode, localTimeZone),
      items: [],
    };
    day.items.push(item);
    days.set(key, day);
  }

  return [...days.values()].map((day) => {
    const rounds = new Map<string, Series[]>();
    for (const item of day.items) {
      const bucket = rounds.get(item.roundLabel) ?? [];
      bucket.push(item);
      rounds.set(item.roundLabel, bucket);
    }
    return {
      key: day.key,
      label: day.label,
      count: day.items.length,
      rounds: [...rounds].map(([label, items]) => ({ label, items })),
    };
  });
}
