# Gate C — correctness and release baseline

**Date:** 2026-08-14  
**Status:** complete locally; not pushed or deployed  
**Baseline:** `f367c92`, three commits ahead of `origin/main` at `7c25fe8`

## Delivered

- Replaced full-field rank-cut Swiss fate with record thresholds, including Round 4 exits.
- Preserved official schedule section, round, label, best-of, and ID on claimed OpenDota series.
- Added one-to-one rematch regressions and retained OpenDota result/start authority.
- Expanded the last-known-good gate to validate team identity, IDs, timestamps, enums, scores,
  winners, Swiss recomputation, and append-only completed history.
- Added structured fallback rejection logging.
- Upgraded Next.js 15.5.23 to 16.3.1 and recorded the Node.js 20.9+ floor.
- Replaced interactive `next lint` with ESLint CLI flat config.
- Added read-only push/pull-request CI while keeping snapshot automation separate.
- Aligned live fetch caching with the 60-second state cadence and removed a duplicate UI clock.

## Files

- `.github/workflows/ci.yml`
- `eslint.config.mjs`
- `package.json`, `package-lock.json`, `tsconfig.json`, `postcss.config.mjs`
- `lib/opendota.ts`, `lib/validation.ts`, `lib/state.ts`
- `lib/merge.test.ts`, `lib/validation.test.ts`
- `scripts/snapshot.ts`
- `app/page.tsx`, `components/TournamentView.tsx`, `components/NextUp.tsx`
- `README.md`, `docs/CODE-REVIEW.md`, `docs/gates/GATE-C.md`

## Verification

| Check | Result |
| --- | --- |
| Original suite | 91/91 passed before changes |
| Expanded deterministic suite | 105/105 passed |
| ESLint flat config | passed, zero warnings |
| TypeScript | passed |
| Next.js 16 Turbopack build | passed |
| Production dependency audit | 0 vulnerabilities (`npm audit --omit=dev`) |
| Validated snapshot workflow | passed; no-op, no file written |
| Live smoke | passed: 16 teams, 39 series, 24 completed, 8 scheduled, 7 TBD |
| Production uptime | passed: HTTP 200, `syncState=ok` |

## Risks

- Next.js 16 changes the default build bundler to Turbopack and requires Node.js 20.9+; both are
  explicitly covered by local build and CI configuration.
- Developer-only audit findings remain outside the production dependency gate and will be reviewed
  with the Gate H test-tooling upgrade.
- Production still serves the old release until the explicit approval checkpoint.

## Commit

`7916bf7` — `Gate C: harden tournament correctness and CI`
