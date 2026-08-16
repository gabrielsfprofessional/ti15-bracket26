"use client";

import { useEffect, useMemo, useState } from "react";
import { AegisMedallion } from "@/components/AegisMedallion";
import { BracketCard } from "@/components/BracketCard";
import { SectionAmbient } from "@/components/SectionAmbient";
import { teamName } from "@/data/teams";
import { ART_ENABLED } from "@/lib/art";
import {
  buildBracketView,
  defaultStageKey,
  STAGE_BY_ANCHOR,
  type BracketLaneView,
  type BracketStageView,
} from "@/lib/bracket-view";
import type { TimeMode } from "@/lib/time";
import type { Series, TeamId } from "@/lib/types";

/**
 * The Main Event board.
 *
 * ONE set of cards serves both layouts. The desktop board shows every stage
 * side by side; below 1024px the same markup becomes a stage navigator, with CSS
 * hiding the stages that are not selected. Rendering a separate mobile tree
 * would duplicate every series in the accessibility tree and, because each card
 * carries a deep-link id, produce fourteen duplicate DOM ids.
 *
 * Nothing here measures the DOM. Stage selection is state, lane and column
 * geometry is CSS Grid, and the connectors are decorative pseudo-elements — the
 * dependency structure is carried in text by the linear list below the board.
 */
export function BracketSection({
  series,
  timeMode,
  localTimeZone,
  championId = null,
}: {
  series: Series[];
  timeMode: TimeMode;
  localTimeZone?: string;
  championId?: TeamId | null;
}) {
  const view = useMemo(() => buildBracketView(series), [series]);
  const [activeStage, setActiveStage] = useState(() => defaultStageKey(view));

  // A deep link into a stage that is currently hidden on mobile has to open it,
  // or the linear list below the board would scroll to nothing. STAGE_BY_ANCHOR
  // is derived from the topology alone, so this never re-runs on a poll and can
  // never fight a stage the visitor picked.
  useEffect(() => {
    const applyHash = () => {
      const stage = STAGE_BY_ANCHOR.get(window.location.hash.replace(/^#/, ""));
      if (stage) setActiveStage(stage);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const stageIndex = Math.max(0, view.stages.findIndex((stage) => stage.key === activeStage));
  const current = view.stages[stageIndex];
  const champion = championId != null ? teamName(championId) : null;

  return (
    <section id="bracket" className="command-section" aria-labelledby="bracket-heading">
      <SectionAmbient name="section" />
      <div className="section-heading">
        <span className="eyebrow">Main Event · double elimination · August 20–23</span>
        <h2 id="bracket-heading">Bracket</h2>
        <p>
          Eight teams, 14 series, every match Bo3 except the Bo5 Grand Final. There is no bracket
          reset: winners and losers flow through the paths below exactly once.
        </p>
      </div>

      {!view.hasBracket ? (
        <div className="bracket-placeholder">
          {/* The Aegis slot. Dormant is the correct and meaningful state here. */}
          {ART_ENABLED ? (
            <AegisMedallion won={championId != null} size={120} />
          ) : (
            <div className="vault-mark" aria-hidden><span /></div>
          )}
          <div>
            <strong>Main Event bracket will appear when official pairings are released</strong>
            <p>No topology, seed, or matchup is inferred from Swiss display order.</p>
          </div>
        </div>
      ) : (
        <>
          {champion && (
            <p className="bracket-champion">
              {ART_ENABLED && <AegisMedallion won size={72} />}
              <span>
                <strong>{champion}</strong> wins The International 2026
              </span>
            </p>
          )}

          <StageNavigator
            stages={view.stages}
            activeStage={current?.key ?? ""}
            stageIndex={stageIndex}
            onSelect={setActiveStage}
          />

          <div className="bracket-board">
            {view.lanes.map((lane) => (
              <Lane
                key={lane.lane}
                lane={lane}
                activeStage={current?.key ?? ""}
                timeMode={timeMode}
                localTimeZone={localTimeZone}
              />
            ))}
          </div>

          <details className="bracket-linear">
            <summary>Accessible linear bracket list</summary>
            <ol>
              {view.linear.map((match) => (
                <li key={match.id}>
                  <a href={`#${match.anchorId}`}>{match.label}</a>
                  {": "}
                  {match.aText} vs {match.bText} · {match.statusText}
                  {match.paths.length > 0 && <> · {match.paths.join(" · ")}</>}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}

function Lane({
  lane,
  activeStage,
  timeMode,
  localTimeZone,
}: {
  lane: BracketLaneView;
  activeStage: string;
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  // Marked here rather than with a CSS :has() so the lane heading disappears
  // with its stages on mobile instead of standing over nothing.
  const holdsActive = lane.stages.some((stage) => stage.key === activeStage);
  return (
    <section
      className={`bracket-lane bracket-lane--${lane.lane}`}
      data-active={holdsActive ? "" : undefined}
      aria-labelledby={`bracket-lane-${lane.lane}`}
    >
      <h3 id={`bracket-lane-${lane.lane}`} className="bracket-lane__heading">{lane.label}</h3>
      <div className="bracket-lane__stages">
        {lane.stages.map((stage) => (
          <Stage
            key={stage.key}
            stage={stage}
            isActive={stage.key === activeStage}
            timeMode={timeMode}
            localTimeZone={localTimeZone}
          />
        ))}
      </div>
    </section>
  );
}

function Stage({
  stage,
  isActive,
  timeMode,
  localTimeZone,
}: {
  stage: BracketStageView;
  isActive: boolean;
  timeMode: TimeMode;
  localTimeZone?: string;
}) {
  return (
    <section
      className="bracket-stage"
      data-stage={stage.key}
      data-active={isActive ? "" : undefined}
      aria-labelledby={`bracket-stage-${stage.key}`}
    >
      <h4 id={`bracket-stage-${stage.key}`} className="bracket-stage__heading">{stage.label}</h4>
      <ol className="bracket-stage__matches">
        {stage.matches.map((match) => (
          <li key={match.id}>
            <BracketCard match={match} timeMode={timeMode} localTimeZone={localTimeZone} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Mobile stage navigation. Native buttons, no gestures, no carousel: the desktop
 * tree is not shrunk down, it is paged through one stage at a time. Hidden at
 * 1024px and up, where every stage is on screen already.
 */
function StageNavigator({
  stages,
  activeStage,
  stageIndex,
  onSelect,
}: {
  stages: BracketStageView[];
  activeStage: string;
  stageIndex: number;
  onSelect: (key: string) => void;
}) {
  const current = stages[stageIndex];
  return (
    <div className="bracket-nav">
      <div className="bracket-nav__chips" role="group" aria-label="Bracket stage">
        {stages.map((stage) => (
          <button
            key={stage.key}
            type="button"
            aria-pressed={stage.key === activeStage}
            onClick={() => onSelect(stage.key)}
          >
            {stage.shortLabel}
          </button>
        ))}
      </div>
      <div className="bracket-nav__steps">
        {/* Announced before the controls that change it, and in the same order
            it is laid out, so DOM order and reading order agree. */}
        <p className="bracket-nav__current numeric">
          Stage <strong>{stageIndex + 1}</strong> of <strong>{stages.length}</strong>
          {current && <> · {current.shortLabel}</>}
        </p>
        <button
          type="button"
          className="bracket-nav__step"
          disabled={stageIndex <= 0}
          onClick={() => onSelect(stages[stageIndex - 1]?.key ?? activeStage)}
        >
          <span aria-hidden>‹</span> Previous stage
        </button>
        <button
          type="button"
          className="bracket-nav__step"
          disabled={stageIndex >= stages.length - 1}
          onClick={() => onSelect(stages[stageIndex + 1]?.key ?? activeStage)}
        >
          Next stage <span aria-hidden>›</span>
        </button>
      </div>
    </div>
  );
}
