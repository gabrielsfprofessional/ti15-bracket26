# TI15 — The International 2026

### ▸ **[ti15-bracket26.vercel.app](https://ti15-bracket26.vercel.app)**

Live bracket, standings and schedule for The International 2026 (Dota 2), Shanghai, Aug 13–23 2026.
Read-only, free, unmonetised. All times displayed in Eastern.

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · deployed on Vercel.
No database, no auth, no backend server.

---

## Architecture

> Automate the volatile, hardcode the stable, let manual override always win.

There is no database and there are no API keys — the entire tournament state is derived on
demand from a public, keyless endpoint and assembled by two pure functions:

```
/api/state → OpenDota → toSeries() → merge schedule + overrides → resolve() → Tournament
```

That route is served with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, so
the CDN absorbs the traffic and OpenDota sees roughly one request a minute regardless of how
many people are watching. The browser polls `/api/state` and updates in place.

A committed snapshot at `data/tournament.json`, refreshed on a schedule by GitHub Actions, is
the **fallback** for when OpenDota is unreachable — disaster recovery, not the freshness
mechanism. Serving it flips the site into a visibly `degraded` state rather than a blank page.

**Source precedence**, enforced during assembly:

```
overrides.json  >  /api/live  >  completed matches  >  schedule.json  >  TBD
```

### Data source

OpenDota, keyless — no API key, no auth, no signup. Two requests per sync.

| Endpoint | Used for |
| --- | --- |
| `/api/leagues/19719/matches` | every played **game**, with `series_id` + `series_type` |
| `/api/live` | detecting a game in progress (filtered to `league_id === 19719`) |
| `/api/leagues/19719/teams` | one-off only, via `npm run logos` — not called at runtime |

Rate limit is roughly 60 req/min. Every request sends an identifying `User-Agent`.

---

## Four things this codebase is careful about

These each produce a silently *wrong* site rather than an error, so each is covered by tests
or by an explicit guard.

1. **Team names are always `null`** on the matches endpoint. `radiant_team_id` / `dire_team_id`
   are populated. Names are resolved by joining the id against the hardcoded table in
   [`data/teams.ts`](data/teams.ts) — never read off a match object. (The API's own team list
   is dirty too: it returns `"Nigma Galaxy "` with a trailing space.)

2. **`/api/live` scores are kill counts, not series scores.** The live feed is used only to
   detect that a game is in progress and to get the two team ids. Every series score is derived
   from completed games sharing a `series_id`.

3. **The live feed lags on removal.** A finished game keeps appearing in `/api/live` with
   `deactivate_time: 0` after `/matches` has already recorded it complete. A live game whose
   `match_id` is already a completed game is dropped, or the site invents a phantom extra game
   of a series that is already over.

4. **No `crons` block in `vercel.json`.** Vercel Hobby only permits daily crons and a sub-daily
   one fails the deploy outright. All scheduled syncing runs on GitHub Actions.

Sides swap between games in a series, so wins are tallied by **team id**, never by
radiant/dire — a side-based tally crowns the wrong team, and there is a unit test that fails
if anyone reintroduces one.

---

## Time handling

Every timestamp is stored as **UTC ISO 8601**. Local times are never stored.

Display uses `Intl.DateTimeFormat` with the IANA zone `America/New_York` and
`timeZoneName: "short"` — so it prints `EDT` (UTC−4) during the tournament and `EST`
automatically in winter. **The offset is never hardcoded**; a fixed −5 would make every match
time an hour wrong.

Shanghai runs 12 hours ahead of Eastern, which puts most of this event in the US late evening
through early morning. A bare clock time is genuinely ambiguous here, so every formatter emits
the weekday alongside the time:

```
Thu Aug 20, 11:00 PM EDT
```

---

## Layout

```
app/          layout.tsx, page.tsx, api/state/route.ts
components/   LiveBar, NextUp, SwissTable, SeriesCard
data/         teams.ts (16 hardcoded), schedule.json (hand-entered), overrides.json (wins)
lib/          types.ts, series.ts, resolve.ts, opendota.ts, time.ts
scripts/      logos.ts
public/logos/ 16 committed team logos — never hotlinked
```

### The two pure functions

Both are `no I/O, no Date.now(), same input → same output`, and both are unit tested before
anything is wired to them.

- **`lib/series.ts` → `toSeries(games[]): Series[]`** groups individual games into series.
  This is the one place a bug corrupts every number on the site.
- **`lib/resolve.ts` → `resolve(t): Tournament`** replaces `winner_of` / `loser_of` bracket
  references with concrete team ids and sets `championId`. Idempotent, and runs to a fixpoint
  so a chain of results propagates in a single call.

---

## Editing the site without touching code

Both files are plain JSON with an embedded `_readme`, editable on github.com from a phone.

**[`data/schedule.json`](data/schedule.json)** — upcoming match times. OpenDota has **no
schedule endpoint**; there is no way to fetch future match times, so this file is the only
source for them. `startUtc` must be UTC ISO 8601 ending in `Z` (Shanghai → UTC: subtract 8
hours). Once a match is actually played, OpenDota takes over and the row is ignored.

**[`data/overrides.json`](data/overrides.json)** — corrects anything, and beats every other
source. During a live event an API will lag or a series will be remade; editing this file fixes
the site in about a minute, with no code change. It can patch any series field, force a team's
Swiss fate, hide a series outright, set the champion, or flip the status dot to `manual`.

---

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 83 unit tests
npm run build
npm run logos      # one-off: re-download the 16 team logos into public/logos/
```

Requires Node 20+. There is nothing to configure — no environment variables, no secrets, no
database.

---

## Deploying

Import the repo into Vercel and accept the detected Next.js defaults. No environment variables
and no `vercel.json` are required, and none should be added — in particular, do not add a
`crons` block (see #4 above).

`/api/state` is served with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`,
so a slow or rate-limited OpenDota degrades to slightly stale data rather than a blank page.

---

## Status

| Phase | |
| --- | --- |
| 0 — endpoint verification | done |
| 1 — correct data pipeline, plain page | done |
| 2 — correctness hardening, live deploy | done |
| 3 — snapshot fallback, GitHub Actions cron, uptime check | in progress |
| 4 — "Aegis Vault" design system, mobile layout | not started |
| 5 — OG image, share, deep links, reduced motion | not started |
| 6 — Main Event bracket topology | blocked: Valve has not published the structure |

Two known open items, both deliberate:

- `data/schedule.json` holds a single row labelled `PLACEHOLDER — replace`. Real upcoming times
  must be hand-entered; none are invented.
- `SWISS_ROUNDS` in [`lib/opendota.ts`](lib/opendota.ts) is `null`, so every team reads
  `active`. Advance/elimination colouring needs the number of Swiss rounds, which is neither in
  the API nor published. Setting that one constant derives every team's fate from the final
  standings; until then `overrides.json` can mark a fate by hand. Guessing would paint a live
  team as eliminated.

---

## License and attribution

The **code** is [MIT](LICENSE).

The **artwork is not**, and is explicitly carved out of that grant:

| | |
| --- | --- |
| `public/art/**` | Derived from Dota 2 / The International key art. Valve Corporation's IP. |
| `public/logos/**` | Esports organisation marks, each the property of its team. |

Neither is mine to relicense. If you fork this, delete both directories or replace them with
assets you have the right to use.

Not affiliated with or endorsed by Valve Corporation. Dota 2 is a trademark of Valve.
Match data from OpenDota.
