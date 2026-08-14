# Gate H — testing and release checkpoint

**Date:** 2026-08-14  
**Status:** preview qualification complete; production approval required
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

## Preview qualification

- Protected preview: `https://ti15-bracket26-iombinjr9-ti-bracket-26.vercel.app`
- Inspector: `https://vercel.com/ti-bracket-26/ti15-bracket26/8a7qRVPvYESfRi2tMuWqKfCcTpkW`
- Deployment: `dpl_8a7qRVPvYESfRi2tMuWqKfCcTpkW`
- Audited application SHA: `57b86017ba56a8ac16fd4861389d3a77b525b5dc`
- `/api/state`: HTTP 200; `public, s-maxage=60, stale-while-revalidate=300`; Vercel ISR cache served
  stale-while-revalidate as designed.
- State contract: league 19719; 16 unique teams; 39 series; 24 completed; eight scheduled; seven
  TBD; 59 game summaries; 24–24 Swiss parity; sync `ok`; mode `live`; match/live sources `ok`;
  schedule `managed`.
- Metadata routes: manifest, robots, sitemap, and 1200×630 share image all returned HTTP 200 with
  the correct content types; the page includes canonical metadata and SportsEvent JSON-LD.
- A protected-preview build demonstrated safe snapshot fallback when the upstream match request
  failed during prerender; bounded ISR subsequently recovered to healthy live state without a
  blank or invalid response.
- Mobile Lighthouse median across three samples: Performance 94, Accessibility 100, Best
  Practices 100, SEO 61, LCP 2.61 s, CLS 0, and TBT 194 ms. LCP remains 0.11 s over target. SEO is
  held down only by the protected preview's intentionally non-crawlable layer; field INP is not
  available in a lab run.

## Release boundary and remaining risks

- Production is unchanged and still fails the new contract because it serves the old 25-series
  placeholder state without source-health metadata.
- The in-app visual browser had no available browser surface. Automated Edge tests cover 320,
  390, 768, 1024, 1280, and 1440 px with no horizontal overflow and no serious/critical axe
  findings, but human desktop/390/320 screenshot comparison remains a named approval risk.
- No Git push, production deployment, alias change, or protection-setting change has occurred.
- Stop here and request explicit approval before pushing or changing production.

## Commit

`b89b6b7` — `Gate H: add production-grade test coverage`
