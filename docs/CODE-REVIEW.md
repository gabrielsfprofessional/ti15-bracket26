# HISTORICAL — archived 2026-08-14

> **Do not use this document as current implementation guidance.** It predates the committed
> snapshot, scheduled workflow, live polling, verified schedule, and Gate C hardening. The current
> source of truth is `README.md`; current evidence is recorded in `docs/gates/`.

# Original review (preserved verbatim below)

# 1. VERDICT

Do not ship. The pure scoring and timezone functions are directionally good (`lib/series.ts:36`, `lib/time.ts:13`), but the launch architecture in the brief is not built: there is no `scripts/sync.ts`, no `data/tournament.json`, no tracked workflow file, and request-time rendering calls OpenDota directly (`app/page.tsx:20`, `app/page.tsx:21`, `app/api/state/route.ts:15`). The single biggest risk is a rate limit, API outage, or empty OpenDota response turning a last-good public bracket into empty or placeholder data because `buildTournament()` converts failed fetches into empty arrays (`lib/opendota.ts:71`, `lib/opendota.ts:73`, `lib/opendota.ts:74`).

# 2. WHAT WAS ACTUALLY BUILT

| Module | Lines | Real responsibility | Evidence |
|---|---:|---|---|
| `.gitignore` | 7 | Ignores dependency/build/local env artifacts. | `.gitignore:1` |
| `app/api/state/route.ts` | 19 | Runtime API route that builds tournament JSON from OpenDota on each GET and returns cache headers. | `app/api/state/route.ts:14`, `app/api/state/route.ts:15`, `app/api/state/route.ts:17`, `app/api/state/route.ts:19` |
| `app/globals.css` | 19 | Imports Tailwind, sets dark body colors, adds tabular numeric font helper. | `app/globals.css:1`, `app/globals.css:13`, `app/globals.css:20` |
| `app/layout.tsx` | 20 | Defines metadata, viewport fit, theme color, root HTML/body. | `app/layout.tsx:4`, `app/layout.tsx:10`, `app/layout.tsx:17` |
| `app/page.tsx` | 69 | Server-rendered page that calls OpenDota via `buildTournament()`, computes next/completed series, renders live, next-up, standings, completed list, and footer. | `app/page.tsx:19`, `app/page.tsx:20`, `app/page.tsx:21`, `app/page.tsx:23`, `app/page.tsx:24`, `app/page.tsx:49`, `app/page.tsx:51`, `app/page.tsx:53`, `app/page.tsx:60`, `app/page.tsx:66` |
| `components/LiveBar.tsx` | 50 | Displays live series from already-computed series scores; does not read live kill counts. | `components/LiveBar.tsx:11`, `components/LiveBar.tsx:12`, `components/LiveBar.tsx:21`, `components/LiveBar.tsx:25`, `components/LiveBar.tsx:32` |
| `components/NextUp.tsx` | 48 | Client countdown for server-selected upcoming series; updates countdown every 30 seconds. | `components/NextUp.tsx:15`, `components/NextUp.tsx:18`, `components/NextUp.tsx:20`, `components/NextUp.tsx:24`, `components/NextUp.tsx:50` |
| `components/SeriesCard.tsx` | 70 | Renders one series card with round, best-of, ET day/time, two team rows, scores, status, and source. | `components/SeriesCard.tsx:10`, `components/SeriesCard.tsx:17`, `components/SeriesCard.tsx:18`, `components/SeriesCard.tsx:23`, `components/SeriesCard.tsx:24`, `components/SeriesCard.tsx:29`, `components/SeriesCard.tsx:34`, `components/SeriesCard.tsx:36` |
| `components/SwissTable.tsx` | 64 | Renders standings rows from computed Swiss W-L data and local team metadata. | `components/SwissTable.tsx:20`, `components/SwissTable.tsx:23`, `components/SwissTable.tsx:36`, `components/SwissTable.tsx:54`, `components/SwissTable.tsx:57`, `components/SwissTable.tsx:58` |
| `data/overrides.json` | 42 | Manual override input for sync state, stream URL, champion, series patches, Swiss patches, hidden series. | `data/overrides.json:3`, `data/overrides.json:4`, `data/overrides.json:36`, `data/overrides.json:39`, `data/overrides.json:40`, `data/overrides.json:41` |
| `data/schedule.json` | 36 | Hand-entered upcoming schedule source; currently contains one placeholder row. | `data/schedule.json:3`, `data/schedule.json:4`, `data/schedule.json:19`, `data/schedule.json:23`, `data/schedule.json:27`, `data/schedule.json:33` |
| `data/teams.ts` | 45 | Hardcoded 16-team table and name/logo lookup helpers. | `data/teams.ts:4`, `data/teams.ts:15`, `data/teams.ts:34`, `data/teams.ts:37`, `data/teams.ts:42` |
| `lib/opendota.ts` | 300 | Fetches OpenDota matches/live, assembles runtime tournament state, merges live/schedule/overrides, computes Swiss rows. | `lib/opendota.ts:17`, `lib/opendota.ts:18`, `lib/opendota.ts:42`, `lib/opendota.ts:54`, `lib/opendota.ts:59`, `lib/opendota.ts:70`, `lib/opendota.ts:95`, `lib/opendota.ts:297` |
| `lib/resolve.ts` | 91 | Pure resolver for `winner_of`/`loser_of` slot references and champion propagation. | `lib/resolve.ts:13`, `lib/resolve.ts:21`, `lib/resolve.ts:41`, `lib/resolve.ts:53`, `lib/resolve.ts:84` |
| `lib/series.ts` | 141 | Pure converter from OpenDota game rows to series rows. | `lib/series.ts:17`, `lib/series.ts:36`, `lib/series.ts:43`, `lib/series.ts:72`, `lib/series.ts:80`, `lib/series.ts:96` |
| `lib/time.ts` | 90 | Pure ET date/time, countdown, and age formatters using `America/New_York`. | `lib/time.ts:13`, `lib/time.ts:15`, `lib/time.ts:23`, `lib/time.ts:37`, `lib/time.ts:45`, `lib/time.ts:53`, `lib/time.ts:70`, `lib/time.ts:92` |
| `lib/types.ts` | 134 | Public tournament model, raw OpenDota models, schedule/override file models. | `lib/types.ts:51`, `lib/types.ts:67`, `lib/types.ts:84`, `lib/types.ts:116`, `lib/types.ts:137` |
| `lib/resolve.test.ts` | 191 | Unit tests for bracket slot resolution, full fake bracket propagation, idempotence, non-mutation, cycle termination. | `lib/resolve.test.ts:73`, `lib/resolve.test.ts:88`, `lib/resolve.test.ts:123`, `lib/resolve.test.ts:168`, `lib/resolve.test.ts:192`, `lib/resolve.test.ts:208` |
| `lib/series.test.ts` | 204 | Unit tests for best-of mapping, team-id scoring, live incomplete series, extra games, distinct series IDs, bad team leaks, purity. | `lib/series.test.ts:41`, `lib/series.test.ts:60`, `lib/series.test.ts:65`, `lib/series.test.ts:97`, `lib/series.test.ts:137`, `lib/series.test.ts:147`, `lib/series.test.ts:168` |
| `lib/time.test.ts` | 73 | Unit tests for EDT/EST formatting, Shanghai date-line cases, malformed time handling, countdown, age. | `lib/time.test.ts:4`, `lib/time.test.ts:5`, `lib/time.test.ts:17`, `lib/time.test.ts:30`, `lib/time.test.ts:39`, `lib/time.test.ts:72` |
| `next.config.ts` | 8 | Minimal Next config with React strict mode and a comment about avoiding Vercel crons. | `next.config.ts:3`, `next.config.ts:6`, `next.config.ts:7` |
| `package.json` | 31 | Declares Next/React/Tailwind/test scripts and dependencies. | `package.json:5`, `package.json:6`, `package.json:7`, `package.json:10`, `package.json:14`, `package.json:21` |
| `postcss.config.mjs` | 5 | Registers Tailwind v4 PostCSS plugin. | `postcss.config.mjs:1`, `postcss.config.mjs:3` |
| `scripts/logos.ts` | 51 | One-off script that downloads team logos into `public/logos/`; it is not a sync pipeline. | `scripts/logos.ts:2`, `scripts/logos.ts:4`, `scripts/logos.ts:8`, `scripts/logos.ts:21`, `scripts/logos.ts:45` |
| `tsconfig.json` | 23 | Strict TypeScript config with JSON module resolution and `@/*` path alias. | `tsconfig.json:7`, `tsconfig.json:12`, `tsconfig.json:17`, `tsconfig.json:21` |
| `vitest.config.ts` | 13 | Node Vitest config scoped to `lib/**/*.test.ts` with `@` alias. | `vitest.config.ts:5`, `vitest.config.ts:6`, `vitest.config.ts:7`, `vitest.config.ts:9` |

Inventory notes:

| Item | Status | Evidence |
|---|---|---|
| Recent git history | One commit: `168a209 Phase 1: correct data pipeline for TI15 bracket site`. | command output; no file line |
| `scripts/sync.ts` | Missing. No file:line possible because the requested file is absent. | absence verified by file inventory |
| `data/tournament.json` | Missing. No file:line possible because the requested file is absent. | absence verified by file inventory |
| `.github/workflows/*.yml` | Missing; `.github/workflows` contains 0 files. No file:line possible because the requested file is absent. | absence verified by file inventory |
| `vercel.json` | Missing. No file:line possible because the requested file is absent. | absence verified by file inventory |
| Installed but unused | `lucide-react` and `motion` are declared (`package.json:15`, `package.json:16`) but no source import was found in reviewed files. | `package.json:15`, `package.json:16` |
| Dependencies outside the runtime spec | Vitest/tsx/type packages are dev tooling (`package.json:21`, `package.json:27`, `package.json:29`). | `package.json:21`, `package.json:27`, `package.json:29` |

# 3. DATA FLOW

Trace target: completed OpenDota series `1130024`, Team Falcons vs LGD Gaming.

| Hop | Concrete value | Evidence |
|---|---|---|
| Raw API shape | `/api/leagues/19719/matches` is modeled as one GAME per row, not one series. | `lib/types.ts:67`, `lib/types.ts:68` |
| Raw game 1 | `match_id=8942993144`, `series_id=1130024`, `series_type=1`, `start_time=1786590206`, `duration=2446`, radiant `9247354`, dire `10150538`, `radiant_win=false`, kill score `22-36`. | OpenDota audit fetch; raw fields modeled at `lib/types.ts:69`, `lib/types.ts:71`, `lib/types.ts:74`, `lib/types.ts:75`, `lib/types.ts:76`, `lib/types.ts:78`, `lib/types.ts:80`, `lib/types.ts:81` |
| Raw game 2 | `match_id=8943034557`, `series_id=1130024`, `series_type=1`, `start_time=1786594684`, `duration=2256`, radiant `9247354`, dire `10150538`, `radiant_win=true`, kill score `29-9`. | OpenDota audit fetch; raw fields modeled at `lib/types.ts:69`, `lib/types.ts:74`, `lib/types.ts:75`, `lib/types.ts:80` |
| Raw game 3 | `match_id=8943072784`, `series_id=1130024`, `series_type=1`, `start_time=1786598736`, `duration=2640`, radiant `9247354`, dire `10150538`, `radiant_win=true`, kill score `38-21`. | OpenDota audit fetch; raw fields modeled at `lib/types.ts:69`, `lib/types.ts:74`, `lib/types.ts:75`, `lib/types.ts:80` |
| `toSeries()` grouping | Key becomes `s-1130024` because nonzero `series_id` maps to `s-${series_id}`. | `lib/series.ts:43`, `lib/series.ts:44`, `lib/series.ts:45` |
| `toSeries()` best-of | `series_type=1` maps to `bestOf=3`; wins needed is `2`. | `lib/series.ts:17`, `lib/series.ts:19`, `lib/series.ts:25`, `lib/series.ts:72`, `lib/series.ts:73` |
| `toSeries()` pair | `a={kind:"team", teamId:9247354}`, `b={kind:"team", teamId:10150538}` because first game radiant/dire pair is preserved when those IDs are the canonical pair. | `lib/series.ts:74`, `lib/series.ts:122`, `lib/series.ts:138`, `lib/series.ts:140`, `lib/series.ts:141`, `lib/series.ts:148` |
| `toSeries()` score | Game winners by team ID: LGD, Falcons, Falcons -> `scoreA=2`, `scoreB=1`, `winnerId=9247354`, `status="completed"`. | `lib/series.ts:80`, `lib/series.ts:81`, `lib/series.ts:82`, `lib/series.ts:83`, `lib/series.ts:87`, `lib/series.ts:88`, `lib/series.ts:107`, `lib/series.ts:109` |
| `toSeries()` timestamps | `startUtc="2026-08-13T03:03:26.000Z"` and `updatedUtc="2026-08-13T06:09:36.000Z"` from `start_time` and max `start_time + duration`. | `lib/series.ts:93`, `lib/series.ts:94`, `lib/series.ts:108`, `lib/series.ts:113`, `lib/series.ts:152`, `lib/series.ts:153` |
| Assembly | `assembleTournament()` builds `played=toSeries(matches)`, merges live, schedule, stream URL, overrides, Swiss rows, then calls `resolve()`. | `lib/opendota.ts:95`, `lib/opendota.ts:98`, `lib/opendota.ts:99`, `lib/opendota.ts:100`, `lib/opendota.ts:101`, `lib/opendota.ts:103`, `lib/opendota.ts:104`, `lib/opendota.ts:107`, `lib/opendota.ts:119` |
| Live merge | Audit fetch found `liveLeagueRows=0`; with no live rows, `mergeLive()` returns the completed series unchanged. | `lib/opendota.ts:133`, `lib/opendota.ts:137`, `lib/opendota.ts:138` |
| Schedule merge | Placeholder schedule row is separate (`placeholder-1`), so this completed OpenDota series remains `source="opendota"`. | `data/schedule.json:23`, `data/schedule.json:24`, `data/schedule.json:27`, `lib/opendota.ts:187`, `lib/opendota.ts:191`, `lib/opendota.ts:197`, `lib/opendota.ts:211` |
| Overrides | No series override exists, so no patch changes `s-1130024`. | `data/overrides.json:39`, `lib/opendota.ts:245`, `lib/opendota.ts:247`, `lib/opendota.ts:252`, `lib/opendota.ts:253` |
| `resolve()` | Concrete team slots are returned unchanged; no grand final exists, so champion remains the existing value. | `lib/resolve.ts:53`, `lib/resolve.ts:54`, `lib/resolve.ts:84`, `lib/resolve.ts:85`, `lib/resolve.ts:86` |
| `data/tournament.json` | Missing, so there is no committed entry to inspect or deploy as the source of truth. No file:line possible because the file is absent. | absence verified by file inventory |
| Render selection | Completed series are filtered and rendered with `SeriesCard`. | `app/page.tsx:24`, `app/page.tsx:25`, `app/page.tsx:26`, `app/page.tsx:60`, `app/page.tsx:61` |
| Team names | `9247354` resolves to `Team Falcons`; `10150538` resolves to `LGD Gaming`. | `data/teams.ts:21`, `data/teams.ts:24`, `data/teams.ts:34`, `components/SeriesCard.tsx:53`, `components/SeriesCard.tsx:69` |
| ET timestamp | `2026-08-13T03:03:26.000Z` renders as day `Wed Aug 12` and time `11:03 PM EDT`. | `lib/time.ts:13`, `lib/time.ts:15`, `lib/time.ts:23`, `lib/time.ts:37`, `lib/time.ts:41`, `lib/time.ts:45`, `lib/time.ts:49`, `components/SeriesCard.tsx:23`, `components/SeriesCard.tsx:24` |
| Final on-screen string | `Group Stage | Bo3 | Wed Aug 12 | 11:03 PM EDT | Team Falcons 2 | LGD Gaming 1 | completed · opendota`. | `components/SeriesCard.tsx:17`, `components/SeriesCard.tsx:18`, `components/SeriesCard.tsx:23`, `components/SeriesCard.tsx:24`, `components/SeriesCard.tsx:29`, `components/SeriesCard.tsx:30`, `components/SeriesCard.tsx:34`, `components/SeriesCard.tsx:36` |

# 4. SPEC CONFORMANCE TABLE

| Requirement | Status | Evidence (file:line) | Note |
|---|---|---|---|
| TI league ID `19719` | Met | `lib/opendota.ts:17`, `lib/types.ts:52`, `scripts/logos.ts:13` | Correct constant. |
| OpenDota base `https://api.opendota.com` | Met | `lib/opendota.ts:18`, `scripts/logos.ts:21` | Runtime API base is correct. |
| No API keys | Met | `lib/opendota.ts:42`, `lib/opendota.ts:43`, `lib/opendota.ts:44` | Fetch sends User-Agent and Accept only; no key code found in reviewed source. |
| Runtime uses `/leagues/19719/matches` | Met | `lib/opendota.ts:53`, `lib/opendota.ts:54`, `lib/opendota.ts:55` | Correct completed-game endpoint. |
| Runtime uses `/api/live` only for live state | Met | `lib/opendota.ts:58`, `lib/opendota.ts:59`, `lib/opendota.ts:61`, `lib/opendota.ts:62` | Correct live endpoint and league filter. |
| Team names from stable local table | Met | `data/teams.ts:4`, `data/teams.ts:15`, `data/teams.ts:34`, `data/teams.ts:42` | Better deviation: runtime avoids extra teams API dependency. |
| `/api/teams/{id}` support | Missing | `lib/opendota.ts:53`, `lib/opendota.ts:58`, `scripts/logos.ts:21` | Neutral deviation if logos are already self-hosted; worse only if team metadata changes. |
| GitHub Actions cron -> `scripts/sync.ts` -> `data/tournament.json` -> deploy | Missing | `app/page.tsx:20`, `app/page.tsx:21`, `app/api/state/route.ts:15`; no `scripts/sync.ts` or `data/tournament.json` file exists | Worse deviation: public requests depend on OpenDota instead of committed last-good state. |
| Browser polls `/api/state` every 60s | Missing | `app/api/state/route.ts:4`, `app/api/state/route.ts:6`, `components/NextUp.tsx:18`, `components/NextUp.tsx:20` | Worse deviation: only the countdown updates client-side. |
| No database, no auth | Met | `app/api/state/route.ts:14`, `app/page.tsx:19` | No DB/auth code found in reviewed files. |
| No backend server | Deviated | `app/api/state/route.ts:14`, `app/api/state/route.ts:15` | Worse: a serverless API route performs runtime OpenDota assembly. |
| Precedence: overrides > live > completed > schedule > TBD | Met for runtime assembly | `lib/opendota.ts:98`, `lib/opendota.ts:99`, `lib/opendota.ts:100`, `lib/opendota.ts:103`, `lib/opendota.ts:104`, `lib/opendota.ts:245`, `lib/opendota.ts:253` | Not backed by committed `data/tournament.json`. |
| Swiss group Aug 13-16, Bo3 | Partial | `lib/opendota.ts:160`, `lib/opendota.ts:162`, `lib/opendota.ts:163`, `data/schedule.json:25`, `data/schedule.json:28` | Completed OpenDota series use Bo3; actual future schedule is not entered. |
| Main Event Aug 20-23, 8 teams, double elimination | Missing/deferred | `lib/resolve.test.ts:5`, `lib/resolve.test.ts:40`, `lib/resolve.test.ts:54`; no production topology file exists | Correctly not hardcoded in production yet if Valve topology is still unavailable; topology publication is unverified. |
| Grand final Bo5 | Missing/deferred | `lib/types.ts:30`, `lib/series.ts:17`, `lib/resolve.test.ts:54` | Types support Bo5; production grand final row is not built. |
| `series_type` mapping `0=Bo1,1=Bo3,2=Bo5` | Met | `lib/series.ts:17`, `lib/series.test.ts:42`, `lib/series.test.ts:43`, `lib/series.test.ts:44`, `lib/series.test.ts:45` | Covered by unit tests. |
| Next.js 15 App Router | Met | `package.json:17`, `app/page.tsx:19`, `app/api/state/route.ts:14` | App Router structure present. |
| TypeScript strict | Met | `tsconfig.json:7`, `package.json:28` | Strict mode on. |
| Tailwind v4 | Met | `package.json:22`, `package.json:26`, `app/globals.css:1` | Tailwind v4 packages present. |
| `motion/react` | Missing at runtime | `package.json:16`; no source import found | Neutral: dependency is unused, no animation surface built. |
| `lucide-react` | Missing at runtime | `package.json:15`; no source import found | Neutral: dependency is unused. |
| Purpose: learn WHEN and WHO in under 2 seconds on phone | Partial | `components/SeriesCard.tsx:21`, `components/SeriesCard.tsx:23`, `components/SeriesCard.tsx:27`, `components/SeriesCard.tsx:29`, `components/NextUp.tsx:50`, `data/schedule.json:27`, `data/schedule.json:29`, `data/schedule.json:30` | The card hierarchy is correct, but the current next-up data is a placeholder with `TBD` teams. |

# 5. TRAP VERIFICATION

| Trap | Result | Proof | Note |
|---|---|---|---|
| T1: Match endpoint team names are null; resolve names by team ID only. | Pass | Raw fields are typed nullable (`lib/types.ts:77`, `lib/types.ts:79`); hardcoded table is the name source (`data/teams.ts:6`, `data/teams.ts:9`, `data/teams.ts:15`); `toSeries()` reads team IDs and winners only (`lib/series.ts:80`, `lib/series.ts:81`, `lib/series.ts:82`, `lib/series.ts:83`, `lib/series.ts:125`, `lib/series.ts:126`). | Grep hits for `radiant_team_name`/`dire_team_name` are type/test/data comments only: `data/teams.ts:7`, `lib/types.ts:77`, `lib/types.ts:79`, `lib/series.test.ts:31`, `lib/series.test.ts:33`. |
| T2: `/api/live` scores are kill counts, not series scores. | Pass | Raw live scores are documented as kills (`lib/types.ts:98`, `lib/types.ts:99`); live merge does not read those fields (`lib/opendota.ts:143`, `lib/opendota.ts:150`, `lib/opendota.ts:152`, `lib/opendota.ts:164`, `lib/opendota.ts:167`); displayed live score comes from `Series.scoreA/scoreB` (`components/LiveBar.tsx:25`, `components/LiveBar.tsx:27`, `components/LiveBar.tsx:32`). | Series scores derive from completed games in `toSeries()` (`lib/series.ts:80`, `lib/series.ts:83`). |
| T3: No schedule endpoint; upcoming times from `data/schedule.json`. | Pass for code path, fail for data completeness | Runtime fetches matches and live only (`lib/opendota.ts:54`, `lib/opendota.ts:59`); schedule rows come from imported JSON (`lib/opendota.ts:1`, `lib/opendota.ts:2`, `lib/opendota.ts:191`). | The only schedule row is a placeholder (`data/schedule.json:23`, `data/schedule.json:27`, `data/schedule.json:29`, `data/schedule.json:30`). |
| T4: No Vercel crons; scheduling in GitHub Actions with `workflow_dispatch`. | Fail | `next.config.ts` only comments that crons should be elsewhere (`next.config.ts:3`, `next.config.ts:4`, `next.config.ts:5`); no `vercel.json` exists; `.github/workflows` has 0 files; no file:line possible for absent files. | Missing workflow means no cron and no `workflow_dispatch`. |
| T5: ET uses IANA `America/New_York`, renders EDT and weekday. | Pass | IANA zone constant (`lib/time.ts:13`); `Intl.DateTimeFormat` uses that zone and `timeZoneName:"short"` (`lib/time.ts:15`, `lib/time.ts:16`, `lib/time.ts:17`, `lib/time.ts:23`); public formatters include weekday (`lib/time.ts:37`, `lib/time.ts:41`, `lib/time.ts:53`, `lib/time.ts:57`); tests assert EDT and weekday (`lib/time.test.ts:5`, `lib/time.test.ts:8`, `lib/time.test.ts:17`, `lib/time.test.ts:20`). | Series cards split weekday/date and clock into adjacent lines (`components/SeriesCard.tsx:23`, `components/SeriesCard.tsx:24`). |

# 6. FINDINGS

| ID | Severity | file:line | What is wrong | Why it matters at 2am during a Bo5 | Recommended fix (not applied) | Effort |
|---|---|---|---|---|---|---|
| F-01 | BLOCKER | `app/page.tsx:20`, `app/page.tsx:21`, `app/api/state/route.ts:15`; no `scripts/sync.ts`; no `data/tournament.json` | The specified last-good data pipeline is not built; the page and API route build tournament state at request time. | A public viewer can receive degraded or placeholder state when OpenDota is slow, down, empty, or rate-limited; there is no committed snapshot to keep the site correct. | Add `scripts/sync.ts` that fetches, validates, resolves, and atomically writes `data/tournament.json`; change page/API to serve that snapshot; keep live overlay optional and non-destructive. | 2-4h |
| F-02 | BLOCKER | `lib/opendota.ts:71`, `lib/opendota.ts:73`, `lib/opendota.ts:74`, `lib/opendota.ts:78`, `lib/opendota.ts:80`, `lib/opendota.ts:115`, `lib/opendota.ts:116` | Failed OpenDota fetches become empty arrays and still assemble a tournament; a fulfilled empty matches array is even marked `ok` if live succeeds. | A transient 429/500 can turn completed results into an empty completed list, while an empty 200 response can look healthy. | Treat rejected or below-threshold matches as sync failure; abort writes; serve last-good snapshot; mark degraded only while preserving last-good data. | 1-2h |
| F-03 | BLOCKER | `data/schedule.json:19`, `data/schedule.json:23`, `data/schedule.json:27`, `data/schedule.json:29`, `data/schedule.json:30`, `components/NextUp.tsx:24`, `components/NextUp.tsx:50` | The only future schedule row is explicitly a placeholder with `TBD` teams. | The primary job is "when and who"; the page cannot answer "who" for the next match from current committed data. | Replace placeholder with the hand-entered real TI15 upcoming schedule; use labels only where teams are truly unknown. | 30-60m |
| F-04 | HIGH | `lib/series.ts:80`, `lib/series.ts:82`, `lib/series.ts:83`, `lib/series.ts:87`, `lib/series.ts:88`, `lib/series.ts:89`, `lib/series.test.ts:137`, `lib/series.test.ts:145` | Extra games after a team reaches the best-of threshold keep incrementing displayed scores. The winner is fixed at first threshold, but the score is not capped or flagged. | A remake/regame can display an impossible `3-1 Bo3` or `4-2 Bo5`, which is visibly wrong. | Stop counting display scores after the threshold, or mark the series invalid/degraded and require an override/hide. Add a test that asserts no `3-1 Bo3`. | 30-45m |
| F-05 | HIGH | `next.config.ts:3`, `next.config.ts:4`, `next.config.ts:5`; no `.github/workflows/*.yml`; no `vercel.json` | The deployment scheduling layer is absent: no GitHub Actions cron, no `workflow_dispatch`, and no Vercel config to verify. | The site will not auto-refresh via committed data, and the developer cannot manually dispatch a known-good sync from a phone. | Add `.github/workflows/sync.yml` with cron and `workflow_dispatch`; keep `vercel.json` without crons or omit it intentionally with documented proof. | 45-90m |
| F-06 | HIGH | `app/api/state/route.ts:4`, `app/api/state/route.ts:6`, `components/NextUp.tsx:18`, `components/NextUp.tsx:20`, `app/page.tsx:19`, `app/page.tsx:21` | The browser does not poll `/api/state` every 60s; only countdown text updates every 30s. | During live matches, a viewer can leave the page open and miss score/status changes. | Add a small client state shell that fetches `/api/state` every 60s, swaps state atomically, and handles failed polls without clearing UI. | 1h |
| F-07 | HIGH | `lib/opendota.ts:49`, `lib/opendota.ts:50`, `lib/opendota.ts:95`, `lib/opendota.ts:98`, `lib/opendota.ts:109` | There is no schema/minimum validation gate before state is accepted. `getJson()` casts unknown JSON directly to typed arrays. | Bad or partial API data can flow into public state without tripping a hard failure. | Add validation for league ID, min team count, min completed series count after event start, valid team IDs, valid series types, and JSON shape before any write/serve decision. | 1h |
| F-08 | HIGH | `app/page.tsx:49`, `app/page.tsx:51`, `app/page.tsx:53`, `app/page.tsx:55`, `lib/resolve.test.ts:5`, `lib/resolve.test.ts:40`, `lib/resolve.test.ts:54` | The production Main Event bracket and mobile bracket stepper are not built; only a fake bracket exists in tests. | From Aug 20, the site will not show the actual double-elimination bracket shape. | Keep topology deferred until Valve publishes it, then add production bracket data, resolver integration, and below-1024 stepper UI. | 3-5h after topology |
| F-09 | MEDIUM | `app/page.tsx:37`, `app/page.tsx:44`, `lib/time.ts:92`, `lib/time.ts:103` | Staleness is not prominent. The page shows an exact "Last synced" timestamp, but the existing relative age formatter is unused and there is no 6h stale warning. | A stale page can still look "auto-syncing" to viewers who do not parse the exact timestamp. | Render relative age, set stale thresholds, and make stale/degraded state high-contrast in the primary bar. | 30m |
| F-10 | MEDIUM | `components/SeriesCard.tsx:53`, `components/SeriesCard.tsx:68`, `components/SeriesCard.tsx:69`, `data/teams.ts:42`, `data/teams.ts:44` | Unknown concrete team IDs render as `TBD` in `SeriesCard`, while `teamName()` would render `Team <id>`. | A new/dirty team ID would look like an unknown matchup instead of a data-quality problem with a visible ID. | In `TeamSide`, if `slot.kind === "team"` and lookup misses, render `Team ${slot.teamId}` and optionally mark degraded. | 15-30m |
| F-11 | MEDIUM | `app/layout.tsx:11`, `app/layout.tsx:12`, `components/LiveBar.tsx:16`, `components/LiveBar.tsx:36`, `components/LiveBar.tsx:37` | Code-level mobile/accessibility work is Phase 2 only: live bar is not sticky, safe-area insets are comments only, no custom focus states are present, and no reduced-motion handling exists. | On a phone in a live room, the most important live state may scroll away or be harder to operate with keyboard/assistive tech. | Add sticky live/next bar with `env(safe-area-inset-*)`, visible focus classes, and reduced-motion handling before adding animations. | 1h |
| F-12 | LOW | `data/schedule.json:8`, `data/schedule.json:9` | The schedule README example for `2026-08-15T09:00:00Z` labels Eastern as `Fri Aug 15, 05:00 AM EDT`; August 15, 2026 is Saturday in Eastern. | Manual schedule instructions are load-bearing, and a wrong weekday example invites a one-day mental error. | Correct the example weekday and add a small schedule-time test if examples move into code. | 5-10m |
| F-13 | LOW | `package.json:15`, `package.json:16` | `lucide-react` and `motion` are installed but unused in reviewed source. | Small dependency noise, not a launch correctness problem. | Remove until used, or use intentionally in the Phase 2 UI. | 5-10m |

# 7. FAILURE-MODE MATRIX

| Question | Verdict |
|---|---|
| 1. If OpenDota returns 500, 429, or empty array, does `sync.ts` overwrite good `tournament.json`? | Fail. `scripts/sync.ts` and `data/tournament.json` are absent; runtime fetch rejection becomes `[]` (`lib/opendota.ts:71`, `lib/opendota.ts:73`, `lib/opendota.ts:74`), and fulfilled empty matches can still produce `syncState:"ok"` (`lib/opendota.ts:115`, `lib/opendota.ts:116`). |
| 2. Is there a validation gate before write? | Missing. There is no write path, and runtime JSON is cast without schema validation (`lib/opendota.ts:49`, `lib/opendota.ts:50`). |
| 3. What renders if `tournament.json` is stale by 6 hours? | Unverified for snapshot because `data/tournament.json` is absent; runtime page shows exact last sync only (`app/page.tsx:44`) and does not use `ago()` (`lib/time.ts:92`). |
| 4. Series with more games than best-of implies. | Partial/fail. Winner is locked at first threshold (`lib/series.ts:87`, `lib/series.ts:88`, `lib/series.ts:89`), but scores keep incrementing for every later game (`lib/series.ts:80`, `lib/series.ts:82`, `lib/series.ts:83`). |
| 5. In-progress series `1-0`. | Pass. Bo3 one-game series is `live` with no winner in test (`lib/series.test.ts:97`, `lib/series.test.ts:103`, `lib/series.test.ts:104`), and LiveBar renders `series 1-0` from `scoreA/scoreB` (`components/LiveBar.tsx:21`, `components/LiveBar.tsx:32`). |
| 6. Two series between same pair. | Pass. Group key is `series_id` (`lib/series.ts:43`, `lib/series.ts:45`), and tests assert distinct series IDs do not merge (`lib/series.test.ts:147`, `lib/series.test.ts:153`, `lib/series.test.ts:154`). |
| 7. Null or unknown team ID. | Partial. Lookups do not crash (`data/teams.ts:37`, `data/teams.ts:39`, `data/teams.ts:42`, `data/teams.ts:44`), but `SeriesCard` renders unknown concrete team slots as `TBD` (`components/SeriesCard.tsx:53`, `components/SeriesCard.tsx:69`). |
| 8. `/api/live` series not yet in `/matches`. | Pass. `mergeLive()` creates a fresh live series with IDs, zero series score, `status:"live"`, and `source:"live"` (`lib/opendota.ts:156`, `lib/opendota.ts:157`, `lib/opendota.ts:164`, `lib/opendota.ts:167`, `lib/opendota.ts:168`, `lib/opendota.ts:172`). |
| 9. Empty state before any match exists in a section. | Partial. Next-up has an empty message (`components/NextUp.tsx:24`, `components/NextUp.tsx:28`); LiveBar returns null (`components/LiveBar.tsx:12`, `components/LiveBar.tsx:13`); completed series only shows count and empty list (`app/page.tsx:55`, `app/page.tsx:57`, `app/page.tsx:59`). |
| 10. Does `resolve()` terminate on malformed/cyclic topology? | Pass. `maxPasses = series.length + 1` caps fixpoint resolution (`lib/resolve.ts:19`, `lib/resolve.ts:21`, `lib/resolve.ts:22`, `lib/resolve.ts:35`), and a cycle test covers termination (`lib/resolve.test.ts:208`, `lib/resolve.test.ts:216`, `lib/resolve.test.ts:217`, `lib/resolve.test.ts:218`). |

# 8. TEST COVERAGE

Test command run: `npm.cmd run test`. Result: 3 test files passed, 42 tests passed. The run also emitted a Vite CJS Node API deprecation warning. Command output has no file:line citation; test scope is configured in `vitest.config.ts:5`, `vitest.config.ts:6`, `vitest.config.ts:7`.

| Area | Covered | Evidence |
|---|---|---|
| `toSeries()` empty input | Yes | `lib/series.test.ts:61`, `lib/series.test.ts:62` |
| Side swaps and scoring by team ID | Yes | `lib/series.test.ts:65`, `lib/series.test.ts:74`, `lib/series.test.ts:77`, `lib/series.test.ts:79` |
| Chronological game order | Yes | `lib/series.test.ts:84`, `lib/series.test.ts:91`, `lib/series.test.ts:94` |
| In-progress Bo3 `1-0` | Yes | `lib/series.test.ts:97`, `lib/series.test.ts:103`, `lib/series.test.ts:104` |
| Bo1 and Bo5 thresholds | Yes | `lib/series.test.ts:107`, `lib/series.test.ts:116`, `lib/series.test.ts:132`, `lib/series.test.ts:134` |
| Extra games after threshold | Partial | Winner only is asserted (`lib/series.test.ts:137`, `lib/series.test.ts:144`); score cap is not asserted. |
| Distinct same-pair series | Yes for distinct `series_id`; same-pair explicit repeat is implied by keying but not named. | `lib/series.test.ts:147`, `lib/series.test.ts:153`, `lib/series.test.ts:154` |
| `series_id=0` standalone rows | Yes | `lib/series.test.ts:158`, `lib/series.test.ts:163`, `lib/series.test.ts:164` |
| Third team in a series | Yes | `lib/series.test.ts:168`, `lib/series.test.ts:175`, `lib/series.test.ts:177`, `lib/series.test.ts:178` |
| Never read team names from match object | Yes | `lib/series.test.ts:218`, `lib/series.test.ts:223`, `lib/series.test.ts:226`, `lib/series.test.ts:227` |
| `resolve()` winner/loser propagation | Yes | `lib/resolve.test.ts:88`, `lib/resolve.test.ts:93`, `lib/resolve.test.ts:94` |
| `resolve()` full fake bracket | Yes | `lib/resolve.test.ts:123`, `lib/resolve.test.ts:164`, `lib/resolve.test.ts:165` |
| `resolve()` idempotence and no mutation | Yes | `lib/resolve.test.ts:168`, `lib/resolve.test.ts:170`, `lib/resolve.test.ts:192`, `lib/resolve.test.ts:196` |
| `resolve()` cycle termination | Yes | `lib/resolve.test.ts:208`, `lib/resolve.test.ts:216`, `lib/resolve.test.ts:217` |
| ET/EDT weekday formatting | Yes | `lib/time.test.ts:5`, `lib/time.test.ts:8`, `lib/time.test.ts:17`, `lib/time.test.ts:20` |
| Malformed/missing times | Yes | `lib/time.test.ts:30`, `lib/time.test.ts:31`, `lib/time.test.ts:33` |
| Countdown and age | Yes | `lib/time.test.ts:39`, `lib/time.test.ts:72` |
| `buildTournament()` degraded fetch behavior | Not covered | `lib/opendota.ts:70`, `lib/opendota.ts:71`, `lib/opendota.ts:73`, `lib/opendota.ts:74` |
| `mergeLive()` fresh live series and lagging live row | Not covered by tests found | `lib/opendota.ts:133`, `lib/opendota.ts:137`, `lib/opendota.ts:156` |
| `mergeSchedule()` duplicate suppression | Not covered by tests found | `lib/opendota.ts:187`, `lib/opendota.ts:193`, `lib/opendota.ts:194` |
| Overrides precedence | Not covered by tests found | `lib/opendota.ts:245`, `lib/opendota.ts:253`, `lib/opendota.ts:257` |
| API route/cache behavior | Not covered by tests found | `app/api/state/route.ts:14`, `app/api/state/route.ts:17`, `app/api/state/route.ts:19` |
| UI rendering and accessibility | Not covered by tests found | `components/SeriesCard.tsx:10`, `components/NextUp.tsx:15`, `components/LiveBar.tsx:11` |

Production build: not run. `next build` writes `.next`, and the audit instruction was read-only except for this report. Build status, type-check status, and production warnings are therefore unverified. Existing `.next` artifacts were not treated as evidence because their freshness relative to this source tree is unverified.

# 9. WHAT IS NOT BUILT YET

| Scope | Status | Evidence |
|---|---|---|
| `scripts/sync.ts` | Not built | `package.json:5`, `package.json:12`; no `scripts/sync.ts` file exists |
| Committed `data/tournament.json` | Not built | `data/schedule.json:1`, `data/overrides.json:1`, `data/teams.ts:1`; no `data/tournament.json` file exists |
| GitHub Actions sync cron and `workflow_dispatch` | Not built | no `.github/workflows/*.yml` file exists |
| Browser polling `/api/state` every 60s | Not built | `app/api/state/route.ts:4`, `app/api/state/route.ts:6`, `components/NextUp.tsx:20` |
| Snapshot validation gate | Not built | `lib/opendota.ts:49`, `lib/opendota.ts:50`, `lib/opendota.ts:95` |
| Real upcoming match schedule | Not built | `data/schedule.json:19`, `data/schedule.json:23`, `data/schedule.json:27` |
| Phase 5 playoff bracket | Not built and correctly deferred if Valve has not published topology | `lib/resolve.test.ts:5`, `lib/resolve.test.ts:40`, `lib/resolve.test.ts:54`; no production bracket topology file exists |
| Mobile bracket stepper below 1024px | Not built | `app/page.tsx:49`, `app/page.tsx:51`, `app/page.tsx:53`, `app/page.tsx:55` |
| Sticky safe-area live bar | Not built | `app/layout.tsx:11`, `app/layout.tsx:12`, `components/LiveBar.tsx:16` |
| Strong stale-state UX | Not built | `app/page.tsx:44`, `lib/time.ts:92` |

# 10. TOP 5 FIXES, RANKED

| Rank | Fix | Why now | Evidence | Effort |
|---:|---|---|---|---:|
| 1 | Add last-good sync pipeline: `scripts/sync.ts`, validation, atomic write to `data/tournament.json`, page/API read snapshot. | Prevents public empty/wrong data when OpenDota fails. | `lib/opendota.ts:71`, `lib/opendota.ts:73`, `lib/opendota.ts:74`, `app/api/state/route.ts:15` | 2-4h |
| 2 | Add validation gates that abort on rejected/empty/too-small matches and unknown schema. | Stops bad data before it reaches users or a committed snapshot. | `lib/opendota.ts:49`, `lib/opendota.ts:50`, `lib/opendota.ts:95`, `lib/opendota.ts:98` | 1h |
| 3 | Replace `data/schedule.json` placeholder with the real upcoming TI15 schedule. | The current site cannot answer "who is next." | `data/schedule.json:19`, `data/schedule.json:27`, `data/schedule.json:29`, `data/schedule.json:30` | 30-60m |
| 4 | Add GitHub Actions workflow with cron and `workflow_dispatch`. | Makes the data pipeline operable without babysitting. | no `.github/workflows/*.yml` file exists; `next.config.ts:3`, `next.config.ts:5` | 45-90m |
| 5 | Add `/api/state` client polling every 60s with non-destructive failed-poll handling. | Lets open phones update during live series. | `app/api/state/route.ts:4`, `app/api/state/route.ts:6`, `components/NextUp.tsx:20` | 1h |

# 11. UNKNOWNS

| Unknown | Why unverified |
|---|---|
| Production build result | Not run because `next build` writes `.next`, violating the read-only constraint except for this report. |
| Current deployed Vercel behavior | No deployment URL or Vercel project metadata was reviewed. |
| `data/tournament.json` freshness and `syncState` reality | The file does not exist, so `lastSyncUtc` and committed `syncState` cannot be audited. |
| Workflow correctness | No workflow YAML exists to inspect. |
| `vercel.json` cron absence by file | No `vercel.json` exists; absence cannot provide a `file:line` citation. |
| Live match behavior at event time | OpenDota audit fetch at review time returned `liveLeagueRows=0`; live behavior was reviewed by code only. |
| Exact Valve Main Event topology publication status | Not independently verified against Valve/Liquipedia; this audit used the provided spec and found no production topology file. |
| Visual phone layout | Code-level spot-check only; no browser screenshot was taken. |

# ANTI-PATTERN GREP RESULTS

Scope: reviewed source/config text files, excluding `node_modules`, `.git`, `.next`, and package-lock noise unless noted.

| Pattern group | Hits | Verdict |
|---|---|---|
| Hardcoded offsets `-5` | `components/SwissTable.tsx:51`, `lib/time.test.ts:5`, `lib/time.test.ts:6`, `lib/time.ts:4` | SwissTable hit is Tailwind `h-5 w-5`; time hits are comments/tests warning against fixed offset. |
| `EST` | `lib/series.ts:17`, `lib/series.ts:22`, `lib/time.test.ts:11`, `lib/time.test.ts:12`, `lib/time.test.ts:13`, `lib/time.ts:6`, `lib/time.ts:60` | `BEST_OF...` hits are false positives; real timezone hits are tests/docs for winter EST. |
| `18000`, `* 3600000` | No source hits | No fixed 5-hour millisecond offset found. |
| `UTC-5` | `lib/time.test.ts:5` | Test name explicitly guards against UTC-5. |
| `radiant_team_name`, `dire_team_name` | `data/teams.ts:7`, `lib/series.test.ts:31`, `lib/series.test.ts:33`, `lib/types.ts:77`, `lib/types.ts:79` | No runtime read path found; type/test/comment only. |
| `localStorage`, `sessionStorage` | No source hits | Pass. |
| `crons` | `next.config.ts:3` | Comment only; `vercel.json` absent. |
| `Date.now()` or `new Date()` inside `lib/resolve.ts` | `lib/resolve.ts:6` | Comment only; no runtime clock read in `resolve()`. |
| API key patterns | No source hits | Pass for reviewed source. |
| Remote logo URLs in components | No component hits | Logos are local paths in `data/teams.ts:16` through `data/teams.ts:31`. |
| `liquipedia.net` fetch/scrape | No source hits | Pass. |
| `TODO`, `FIXME`, `HACK`, `@ts-ignore`, `as any`, `eslint-disable` | `components/SeriesCard.tsx:60`, `components/SwissTable.tsx:45`, `lib/opendota.ts:47` | `eslint-disable` suppresses Next img lint for local PNGs; `as RequestInit` is a type cast, not `as any`. |

# INDEPENDENT CROSS-CHECK

Audit fetch: `/api/leagues/19719/matches` returned 59 game rows; `/api/live` filtered to league `19719` returned 0 live rows. This evidence is from the read-only OpenDota fetch command, not a repository file.

| Series | Independent score | Local team names | Compare to `data/tournament.json` |
|---|---|---|---|
| `1130024` | `9247354` over `10150538`, `2-1`, winner `9247354`, games `8942993144,8943034557,8943072784` | Team Falcons (`data/teams.ts:24`) over LGD Gaming (`data/teams.ts:21`) | BLOCKER: cannot compare because `data/tournament.json` is absent. |
| `1130028` | `10150413` over `10136357`, displayed from pair order as `0-2`, winner `10150413`, two games | Iron Wing (`data/teams.ts:20`) over Nigma Galaxy (`data/teams.ts:22`) | BLOCKER: cannot compare because `data/tournament.json` is absent. |
| `1130027` | `9572001` over `5017210`, displayed from pair order as `1-2`, winner `9572001`, three games | TEAM VISION (`data/teams.ts:29`) over Team Resilience (`data/teams.ts:26`) | BLOCKER: cannot compare because `data/tournament.json` is absent. |

Freshness: `lastSyncUtc` could not be checked in committed data because `data/tournament.json` is absent. Runtime `lastSyncUtc` is generated from the request clock (`lib/opendota.ts:115`), so it reflects render time, not a committed sync time.

# UI & ACCESSIBILITY SPOT-CHECK

| Check | Verdict | Evidence |
|---|---|---|
| "When + who" high priority | Partial pass | SeriesCard explicitly weights day/time and team rows (`components/SeriesCard.tsx:5`, `components/SeriesCard.tsx:6`, `components/SeriesCard.tsx:21`, `components/SeriesCard.tsx:27`). |
| Phone purpose with current data | Fail | Next-up renders schedule rows (`components/NextUp.tsx:50`), but current schedule row is placeholder/TBD (`data/schedule.json:27`, `data/schedule.json:29`, `data/schedule.json:30`). |
| Below 1024px round stepper instead of shrunken tree | Missing | No bracket/stepper component exists in reviewed source; page renders live, next-up, Swiss table, completed list (`app/page.tsx:49`, `app/page.tsx:51`, `app/page.tsx:53`, `app/page.tsx:55`). |
| Tap targets >= 44px | Mostly not applicable, partial | The only link is `Watch` (`components/LiveBar.tsx:36`, `components/LiveBar.tsx:42`) and no explicit 44px target classes exist. |
| Safe-area insets for sticky bar | Missing | Layout comment says safe-area is Phase 2 (`app/layout.tsx:11`, `app/layout.tsx:12`); LiveBar is a normal section (`components/LiveBar.tsx:16`). |
| `prefers-reduced-motion` | Missing | No reduced-motion code found; `motion` dependency is unused (`package.json:16`). |
| Visible focus states | Partial/missing | No custom focus classes found; the Watch link relies on browser default (`components/LiveBar.tsx:36`, `components/LiveBar.tsx:37`). |
| Attribution footer | Present | Footer text exists (`app/page.tsx:66`, `app/page.tsx:67`, `app/page.tsx:68`). |
