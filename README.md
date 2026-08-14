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
| E | Command-center information architecture and game-level results | Pending |
| F | “Aegis Vault” visual system and rights-aware art direction | Pending |
| G | WCAG 2.2 AA, performance, SEO, and sharing | Pending |
| H | Component/E2E coverage, preview audit, release checkpoint | Pending |
| Production | Push and production alias change | Requires explicit approval |

The protected local history is intentionally ahead of `origin/main`. Do not squash, rewrite,
reset, or discard it. No production deployment is authorized until the preview checklist is
presented and the user explicitly approves release.

## Data architecture

```text
/api/state
  ├─ OpenDota league matches → completed games grouped by series_id
  ├─ OpenDota live feed → live confirmation only
  ├─ checked-in schedule adapter → future times and official round metadata
  ├─ manual overrides → final authority
  ├─ strict candidate validation
  └─ data/tournament.json → last-known-good fallback
```

Source precedence is fixed:

```text
overrides > confirmed live state > completed games > schedule > TBD
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

## Validation and fallback

Candidates are rejected for an invalid league/team set, duplicate series or completed game IDs,
unknown concrete teams, non-UTC timestamps, impossible scores/winners, invalid enum values,
Swiss recomputation mismatch, series regression, or completed-history regression. Rejections are
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
