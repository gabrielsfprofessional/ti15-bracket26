# Gate H — testing and release checkpoint

**Date:** 2026-08-14  
**Status:** local qualification complete; preview pending  
**Parent:** `3199364`

## Delivered

- Upgraded Vitest to the non-vulnerable 4.1 line and added a jsdom component-test layer.
- Added deterministic component coverage for live/idle display, full-schedule discovery,
  time-mode switching, textual standings fate, four-series stage exits, expandable games, and
  degraded snapshot visibility.
- Added a production-build Playwright suite covering keyboard navigation, complete schedule/team
  filtering, stable deep links, failed refresh/offline retention, required responsive widths,
  reduced motion, and axe scanning with no serious/critical violations.
- Added a cross-platform test server runner that starts and terminates the exact Next process,
  avoiding orphaned Windows processes while remaining compatible with Linux CI.
- Extended candidate validation to reject malformed game summaries and live-game counters.
- Added E2E/browser installation to normal read-only pull-request/push CI; scheduled snapshot
  automation remains separate.
- Ignored and removed generated Playwright artifacts.

## Files

- `components/command-center.test.tsx`, `vitest.setup.tsx`, `vitest.config.mts`
- `tests/e2e/tournament.spec.ts`, `playwright.config.ts`, `scripts/run-e2e.mjs`
- `lib/validation.ts`, `lib/validation.test.ts`
- `.github/workflows/ci.yml`, `.gitignore`
- `README.md`, `docs/gates/GATE-G.md`, `docs/gates/GATE-H.md`

## Local verification

| Check | Result |
| --- | --- |
| `npm ci` | passed from lockfile; 0 vulnerabilities |
| ESLint | passed; zero warnings |
| TypeScript | passed |
| Deterministic/unit/component suite | 123/123 passed across 9 files |
| Next.js 16 production build | passed; 10 static routes; `/` and `/api/state` revalidate at 1m |
| Playwright E2E/accessibility | 5/5 passed |
| Production dependency audit | 0 vulnerabilities |
| Full dependency audit | 0 vulnerabilities |
| Live smoke | 16 teams; 39 series; 24 completed; 8 scheduled; 7 TBD; sources healthy |
| Snapshot repeat | validated no-op |
| Current production contract | expected failure: old deployment has 25 series and no health metadata |

## Pending release checkpoint

- Create a Vercel preview from this committed state.
- Verify preview `/api/state`, deployment SHA, cache headers, fallback semantics, current counts, and
  Lighthouse targets.
- The in-app visual browser has no available browser surface in this session; this must remain a
  named manual-review risk rather than being marked complete.
- Stop before push or production alias changes and request explicit approval.

## Commit

`b89b6b7` — `Gate H: add production-grade test coverage`
