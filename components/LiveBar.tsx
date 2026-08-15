import { teamName } from "@/data/teams";
import { FlipScore } from "@/components/FlipScore";
import { TeamLogo } from "@/components/TeamLogo";
import { formatDuration, formatTournamentTime, type TimeMode } from "@/lib/time";
import type { Series } from "@/lib/types";

export function LiveBar({
  series,
  nextSeries,
  timeMode,
  localTimeZone,
}: {
  series: Series[];
  nextSeries?: Series;
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  const live = series.filter((item) => item.status === "live");

  return (
    <section id="live" className={`live-dock ${live.length ? "live-dock--active" : ""}`} aria-labelledby="live-heading">
      <div className="live-dock__label">
        <span className="live-beacon" aria-hidden />
        <h2 id="live-heading">{live.length ? "Live now" : "Live desk"}</h2>
      </div>

      {live.length === 0 ? (
        <div className="live-dock__idle">
          <div>
            <strong>No matches live</strong>
            <span>
              {nextSeries
                ? `Next: ${formatTournamentTime(nextSeries.startUtc, timeMode, localTimeZone)}`
                : "Next match time has not been published"}
            </span>
          </div>
          {nextSeries?.streamUrl && (
            <a className="watch-button watch-button--quiet" href={nextSeries.streamUrl} target="_blank" rel="noopener noreferrer">
              Watch hub
            </a>
          )}
        </div>
      ) : (
        <ul className="live-dock__matches">
          {live.map((item) => {
            const gameNumber = item.liveGame?.gameNumber ?? item.scoreA + item.scoreB + 1;
            return (
              <li key={item.id}>
                <div className="live-match__teams">
                  <div>
                    <TeamLogo teamId={item.a.teamId} size={32} />
                    <span>{teamName(item.a.teamId)}</span>
                    <strong className="numeric"><FlipScore value={item.scoreA} /></strong>
                  </div>
                  <span className="live-match__versus">series</span>
                  <div>
                    <TeamLogo teamId={item.b.teamId} size={32} />
                    <span>{teamName(item.b.teamId)}</span>
                    <strong className="numeric"><FlipScore value={item.scoreB} /></strong>
                  </div>
                </div>
                <div className="live-match__context">
                  <span>Game {gameNumber} · Bo{item.bestOf}</span>
                  {item.liveGame && item.liveGame.gameTimeSeconds >= 0 && (
                    <span className="numeric">Game clock {formatDuration(item.liveGame.gameTimeSeconds)}</span>
                  )}
                  {item.liveGame && (
                    <span className="numeric">
                      Current-game kills: {teamName(item.liveGame.radiantTeamId)} {item.liveGame.radiantKills}–{item.liveGame.direKills} {teamName(item.liveGame.direTeamId)}
                    </span>
                  )}
                </div>
                {item.streamUrl && (
                  <a className="watch-button" href={item.streamUrl} target="_blank" rel="noopener noreferrer">
                    Watch live
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
