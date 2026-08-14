# Gate D — data, schedule, and live experience

**Date:** 2026-08-14  
**Status:** complete locally; not pushed or deployed  
**Parent:** `7916bf7`

## Delivered

- Added per-source status/observation metadata, snapshot generation time, and served mode.
- Normalized legacy snapshots and made degraded/manual fallback states explicit.
- Added a narrow checked-in schedule provider adapter and deterministic adapter tests.
- Documented Steam, OpenDota, and PandaScore schedule options and retained managed scheduling.
- Added deduplicated hydration-stale, visibility, online, and 60-second refresh triggers with
  abort-on-unmount and last-valid-payload retention.
- Strengthened snapshot automation with scoped permissions, no-op output, expected commit SHA
  capture, and bounded production-alias verification.
- Added deployment SHA metadata to `/api/state` without exposing secrets.
- Replaced the HTTP-only uptime check with a semantic contract for league/team/series counts,
  Swiss parity, source health, snapshot age, sync mode, and expected deployment SHA.
- Refreshed `data/tournament.json` once to add source health; a second run was a verified no-op.

## Files

- `lib/types.ts`, `lib/opendota.ts`, `lib/state.ts`, `lib/validation.ts`
- `lib/schedule.ts`, `lib/public-state.ts`
- `lib/schedule.test.ts`, `lib/public-state.test.ts`, `lib/validation.test.ts`, `lib/resolve.test.ts`
- `components/TournamentView.tsx`
- `app/api/state/route.ts`
- `scripts/snapshot.ts`, `scripts/smoke.ts`, `scripts/uptime.ts`
- `.github/workflows/snapshot.yml`
- `data/tournament.json`
- `README.md`, `docs/SCHEDULE-PROVIDER.md`, `docs/gates/GATE-C.md`, `docs/gates/GATE-D.md`

## Verification

| Check | Result |
| --- | --- |
| Deterministic suite | 111/111 passed |
| ESLint | passed, zero warnings |
| TypeScript | passed |
| Next.js 16 build | passed; `/` and `/api/state` report one-minute revalidation |
| Snapshot refresh | wrote health metadata once, then validated no-op |
| Local production API contract | passed: 16 teams, 39 series, 24 completed, fresh snapshot |
| Production deployment | not performed |

## Provider decision and risks

- PandaScore is supported and offers free fixtures, but requires a private token and an explicit
  provider-team-ID to OpenDota-team-ID mapping. It is deferred until credentials, terms, TI15
  coverage, and the crosswalk are approved.
- Valve's historical scheduled-games method has no current supported official contract.
- Future matches therefore remain managed; results and live detection remain automatic.
- The production uptime script will intentionally reject the old deployment because it lacks the
  new source-health contract. Preview verification is the next applicable remote check.

## Commit

Recorded in the next gate report because a commit cannot contain its own hash.
