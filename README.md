# TI15 — The International 2026 tracker

**Production:** [ti15-bracket26.vercel.app](https://ti15-bracket26.vercel.app)

**Repository:** [gabrielsfprofessional/ti15-bracket26](https://github.com/gabrielsfprofessional/ti15-bracket26)

A mobile-first, read-only tournament command center for The International 2026 in Shanghai,
August 13–23. Results and live detection come from OpenDota; future scheduling is checked in and
manually verified. The project is free, unmonetized, and not affiliated with or endorsed by Valve.

This README is the operational source of truth. Dated gate reports live in `docs/gates/`;
`docs/CODE-REVIEW.md` is a historical pre-snapshot audit and must not be used as current guidance.

## Release status

| Gate | Scope | Status |
| --- | --- | --- |
| Baseline | Validated OpenDota series pipeline, schedule, snapshot fallback | Complete |
| C | Swiss fate, schedule enrichment, strict validation, Next 16, ESLint, CI | Complete locally; not released |
| D | Source health, schedule adapter, resilient refresh, workflow hardening | Complete locally; not released |
| E | Command-center information architecture and game-level results | Complete locally; not released |
| F | “Aegis Vault” visual system and rights-aware art direction | Complete locally; not released |
| G | WCAG 2.2 AA, performance, SEO, and sharing | Preview-qualified; exceptions documented below |
| H | Component/E2E coverage, preview audit, release checkpoint | Preview complete; production approval required |
| Production | Push and production alias change | Requires explicit approval |

The protected local history is intentionally ahead of `origin/main`. Do not squash, rewrite,
reset, or discard it. No production deployment is authorized until the preview checklist is
presented and the user explicitly approves release.

### Preview checkpoint — 2026-08-14

The protected release-candidate preview is
[`ti15-bracket26-iombinjr9-ti-bracket-26.vercel.app`](https://ti15-bracket26-iombinjr9-ti-bracket-26.vercel.app)
at application commit `57b8601`. It verified league `19719`, 16 unique teams, 39 series,
24 completed series, eight scheduled series, seven TBD series, 59 individual games, 24–24 Swiss
parity, healthy match/live sources, managed schedule status, and the expected one-minute ISR cache
contract. The preview is protected by Vercel authentication.

Three mobile Lighthouse samples produced a median Performance score of 94, Accessibility 100,
Best Practices 100, LCP 2.61 seconds, CLS 0, and a 194 ms total-blocking-time lab proxy. Two
release exceptions remain explicit: LCP is 0.11 seconds above the 2.5-second target, and the
protected preview scores 61 for SEO because the preview layer is intentionally non-crawlable.
The application’s canonical, manifest, robots, sitemap, Open Graph, and SportsEvent surfaces were
verified independently. A human screenshot comparison remains pending because the in-app browser
had no available browser surface; automated Edge checks passed every required viewport.

## Data architecture

```text
/api/state
  ├─ OpenDota league matches → completed games grouped by series_id
  ├─ OpenDota live feed → live confirmation only
  ├─ checked-in schedule adapter → future times and official round metadata
  ├─ checked-in bracket topology → Main Event dependency graph
  ├─ manual overrides → final authority
  ├─ strict candidate validation
  └─ data/tournament.json → last-known-good fallback
```

Source precedence is fixed:

```text
overrides > confirmed live state > completed games > schedule/topology > TBD
```

Runtime requests are bounded, cached, identified, and rate-limit aware. `/api/state` is cached for
60 seconds with five minutes of stale-while-revalidate protection. The browser polls every 60
seconds and never discards its last valid payload after a failed refresh.

### Non-negotiable correctness rules

- Team identity is always resolved by OpenDota team ID, never raw names.
- Series scores come only from completed games sharing a `series_id`.
- `/api/live` `radiant_score` and `dire_score` are kill counts, never series scores.
- Sides can swap; winners are tallied by team ID.
- All stored timestamps are UTC ISO 8601. Display zones use IANA identifiers.
- A live or upstream anomaly cannot replace the committed last-known-good state.
- The site never invents teams, matches, pairings, topology, results, or official start times.
- Team logos are committed locally and never hotlinked.
- Scheduled refresh uses GitHub Actions; do not add a sub-daily Vercel cron.

### TI15 Swiss fate

Fate is derived from the record itself, never an alphabetical or unimplemented tiebreak rank:

```text
wins >= 4                         → advanced
losses >= 4                       → eliminated
wins + losses >= 5               → elimination_round
otherwise                         → active
```

A 4–0 or 0–4 team stops after Round 4. A completed valid field resolves to three advanced,
ten entering the Elimination Round, and three eliminated. Manual fate overrides remain
authoritative and non-provisional.

## Scheduling policy

`data/schedule.json` holds Swiss and Elimination Round rows only. The Main Event is a dependency
graph rather than a list of concrete pairings, so it lives in `data/bracket-topology.ts` instead —
a schedule row accepts only concrete team IDs and loses its own ID once a played series claims it,
and both are fatal for `winner_of`/`loser_of` references.

`data/schedule.json` is the checked-in fallback and manual correction surface. OpenDota provides
completed games and live detection but no future schedule endpoint. Until a supported, stable,
legally usable organizer/provider API is documented and integrated behind `lib/schedule.ts`,
future schedule updates are managed rather than automatic. Never scrape Liquipedia HTML or rely
on undocumented page markup.

The dated provider assessment, including the deferred PandaScore option, is in
`docs/SCHEDULE-PROVIDER.md`.

When a played OpenDota series claims a schedule row, OpenDota retains authority for start time,
score, winner, games, status, and observation time. The row adds `section`, `round`, `roundLabel`,
known `bestOf`, and `scheduleId`. Claims are one-to-one so a rematch cannot consume another row.

## Main Event bracket

`data/bracket-topology.ts` is the checked-in, typed graph of the 14 Main Event series: stable id,
Valve node id, stage, best-of, official UTC start, and two `SlotRef`s. It carries no score, winner
or status. It was verified on 2026-08-16 against Valve's league `19719` data (node group "Playoff",
nodes 14–27). Every series is Bo3 except the Bo5 Grand Final, which has **no bracket reset**.

The node 24/25 crossing is official. Lower quarterfinal 1 (Valve node 25, the earlier slot) takes
the loser of upper semifinal 1 and the winner of lower round 1 match 2; lower quarterfinal 2 (node
24) takes the loser of upper semifinal 2 and the winner of lower round 1 match 1. Do not "correct"
it into a straight bracket.

`lib/bracket.ts` reconciles played and live series onto that graph:

1. Instantiate all 14 nodes. Both participants concrete → `scheduled`; otherwise `tbd`.
2. Resolve, then claim, then repeat to a fixpoint, so a quarterfinal result can resolve a
   semifinal and that semifinal can resolve both destinations inside one request.
3. A node claims at most one OpenDota series and each series is claimed at most once, by unordered
   team ids inside the shared window in `lib/claim.ts` — the same rule the schedule adapter uses.
   A series a schedule row already owns is never taken.
4. The **stable topology id survives the claim**; only `seriesId`, score, winner, games, live game,
   status, source and observation time are copied on. Slot order stays the topology's and the score
   follows it. The claimed raw series is removed so nothing is published twice.
5. Overrides apply after reconciliation and address a bracket match by its stable id.

The topology's own shape — 14 unique nodes, valid references, one terminal node, no cycles, a
dependency never starting after its dependant — is checked by `validateBracketTopology()`, which
runs in the unit suite (and therefore in CI before the build) and in `npm run smoke`.

### Deep-link namespaces

One series is published by several sections, and two elements cannot share a DOM id. Exactly one
section owns the canonical `series-<id>` anchor for a given state — Schedule while a match is
upcoming, Results once it is final — so every `#series-<id>` link lands on a card that is actually
rendered. The curated views take their own prefix: `bracket-<id>` and `elimination-<id>`. An E2E
test expands every disclosure and asserts the whole document has unique ids.

## Validation and fallback

Candidates are rejected for an invalid league/team set, duplicate series or completed game IDs, the
same upstream OpenDota series published under two IDs, unknown concrete teams, non-UTC timestamps,
impossible scores/winners, invalid enum values, Swiss recomputation mismatch, series regression, or
completed-history regression — which also covers a completed bracket node reverting its status or
losing a game, because bracket nodes keep a stable ID. Rejections are
logged as structured, non-sensitive reasons and the committed snapshot is served as `degraded`.

The scheduled snapshot job validates before writing, skips no-op commits, and leaves the previous
file untouched on failure.

## Local development

Node.js 20.9+ is required (CI and scheduled workflows use Node 22).

```bash
npm ci
npm run dev
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e    # requires a production build; starts/stops its own local server
npm run smoke       # explicit live-provider check
npm run snapshot    # validates, writes only material changes
npm run uptime      # production state contract check
```

Core tests are deterministic and network-free. `smoke`, `snapshot`, and `uptime` are explicit
network jobs and do not belong in the unit suite.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests with read-only repository permission:

1. `npm ci`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm test`
5. `npm run build`
6. install Playwright Chromium and run `npm run test:e2e`

`.github/workflows/snapshot.yml` remains a separate scheduled operational workflow.

## Release procedure

1. Finish and commit each local gate with a dated report in `docs/gates/`.
2. Run lint, TypeScript, unit/component/E2E tests, build, live smoke, uptime, and production audit.
3. Create a Vercel preview and inspect desktop, 390 px, and 320 px layouts.
4. Verify `/api/state`, caching, schedule coverage, degraded fallback, counts, accessibility, and
   performance against the preview.
5. Present the preview URL, exact commit range, risks, and rollback target.
6. Stop and request explicit approval.
7. Only after approval: push, wait for the production alias to serve the expected SHA, and rerun
   full production smoke and visual checks.

## Licensing, artwork, and attribution

The code is MIT licensed. `public/art/source/**` is source material only and is not an approved
production asset set. Its provenance and permitted use must be documented before any derivative
ships; the product retains a CSS/abstract fallback. No unofficial artwork is presented as Valve
key art and no fake official tournament logo is created.

Team marks in `public/logos/**` belong to their respective organizations. Dota 2 and The
International are Valve Corporation properties. Match data is provided by OpenDota.
