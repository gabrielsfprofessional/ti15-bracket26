import { getTeam } from "@/data/teams";
import { TeamLogo } from "@/components/TeamLogo";
import { formatDuration, formatTournamentTime, type TimeMode } from "@/lib/time";
import type { GameSummary, Series, SlotRef } from "@/lib/types";

const HAS_SCORE = new Set<Series["status"]>(["live", "unconfirmed", "completed"]);

const STATUS_LABEL: Record<Series["status"], string> = {
  tbd: "Matchup TBD",
  scheduled: "Scheduled",
  live: "Live now",
  unconfirmed: "In progress · awaiting live confirmation",
  completed: "Final",
};

export function SeriesCard({
  series,
  timeMode,
  localTimeZone,
  compact = false,
}: {
  series: Series;
  timeMode: TimeMode;
  localTimeZone?: string;
  compact?: boolean;
}) {
  const winnerA = series.winnerId != null && series.a.teamId === series.winnerId;
  const winnerB = series.winnerId != null && series.b.teamId === series.winnerId;
  const showScore = HAS_SCORE.has(series.status);
  const games = series.games ?? [];

  return (
    <article
      id={`series-${series.id}`}
      className={`series-card ${compact ? "series-card--compact" : ""} status-${series.status}`}
    >
      <div className="series-card__meta">
        <span>{series.roundLabel}</span>
        <span className="numeric">Bo{series.bestOf}</span>
      </div>

      <div className="series-card__time numeric">
        {formatTournamentTime(series.startUtc, timeMode, localTimeZone)}
      </div>

      <div className="series-card__teams">
        <TeamSide slot={series.a} score={series.scoreA} isWinner={winnerA} showScore={showScore} />
        <TeamSide slot={series.b} score={series.scoreB} isWinner={winnerB} showScore={showScore} />
      </div>

      <div className="series-card__footer">
        <span className={`status-label status-label--${series.status}`}>{STATUS_LABEL[series.status]}</span>
        <a className="deep-link" href={`#series-${series.id}`} aria-label={`Link to ${series.roundLabel}`}>
          #
        </a>
      </div>

      {games.length > 0 && (
        <details className="game-details">
          <summary>
            {games.length} {games.length === 1 ? "game" : "games"} · details and OpenDota links
          </summary>
          <ol>
            {games.map((game) => (
              <GameRow
                key={game.matchId}
                game={game}
                timeMode={timeMode}
                localTimeZone={localTimeZone}
              />
            ))}
          </ol>
        </details>
      )}
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
    <div className={`team-side ${isWinner ? "team-side--winner" : ""}`}>
      <TeamLogo teamId={slot.teamId} size={28} />
      <span className="team-side__name">{slotText(slot, team?.name)}</span>
      {isWinner && <span className="sr-only">winner</span>}
      {showScore && score != null && <span className="team-side__score numeric">{score}</span>}
    </div>
  );
}

function GameRow({
  game,
  timeMode,
  localTimeZone,
}: {
  game: GameSummary;
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  const radiant = getTeam(game.radiantTeamId);
  const dire = getTeam(game.direTeamId);
  const winner = getTeam(game.winnerId);

  return (
    <li id={`game-${game.matchId}`} className="game-row">
      <div className="game-row__heading">
        <strong>Game {game.gameNumber}</strong>
        <span>{winner?.name ?? `Team ${game.winnerId}`} won</span>
      </div>
      <div className="game-row__meta numeric">
        {formatTournamentTime(game.startUtc, timeMode, localTimeZone)} · {formatDuration(game.durationSeconds)}
      </div>
      <div className="game-row__sides">
        <div className={game.winnerId === game.radiantTeamId ? "is-winner" : ""}>
          <span>Radiant · {radiant?.name ?? game.radiantTeamId}</span>
          <strong className="numeric">{game.radiantKills} final kills</strong>
        </div>
        <div className={game.winnerId === game.direTeamId ? "is-winner" : ""}>
          <span>Dire · {dire?.name ?? game.direTeamId}</span>
          <strong className="numeric">{game.direKills} final kills</strong>
        </div>
      </div>
      <a className="text-link game-row__link" href={game.openDotaUrl} target="_blank" rel="noopener noreferrer">
        Open game {game.matchId} on OpenDota
      </a>
    </li>
  );
}

function slotText(slot: SlotRef, name: string | undefined): string {
  if (name) return name;
  if (slot.kind === "team" && slot.teamId != null) return `Team ${slot.teamId}`;
  if (slot.label) return slot.label;
  if (slot.kind === "winner_of") return `Winner of ${slot.matchId ?? "previous match"}`;
  if (slot.kind === "loser_of") return `Loser of ${slot.matchId ?? "previous match"}`;
  return "TBD";
}
