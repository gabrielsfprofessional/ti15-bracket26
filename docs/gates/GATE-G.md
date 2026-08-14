# Gate G — accessibility, performance, SEO, and sharing

**Date:** 2026-08-14  
**Status:** preview-qualified with documented LCP and protected-SEO exceptions
**Parent:** `8bc3dc8`

## Delivered

- Added a keyboard skip link, explicit landmarks/headings, named controls, textual statuses,
  44-pixel primary targets, strong focus rings, responsive overflow containment, and useful
  match-state-only live announcements.
- Raised muted text from the previous failing token to `#a5b0be` on the obsidian surface and kept
  all state meaning textual rather than color-only.
- Added complete canonical, Open Graph, Twitter, icon, Apple icon, manifest, robots, and sitemap
  metadata.
- Generated a code-native 1200×630 share image and abstract application icons without unverified
  tournament claims or unofficial Valve-style key art.
- Added SportsEvent JSON-LD only for verified scheduled matches with concrete team IDs and start
  times; TBD rows and unverified bracket topology are excluded.
- Avoided remote fonts, bitmap hero preload, bulk historical client data, and JS motion libraries.

## Files

- `app/layout.tsx`, `app/page.tsx`
- `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts`
- `app/opengraph-image.tsx`, `app/apple-icon.tsx`, `app/icon.svg`
- `README.md`, `docs/gates/GATE-F.md`, `docs/gates/GATE-G.md`

## Verification

| Check | Result |
| --- | --- |
| Automated axe scan | 0 serious or critical violations |
| Keyboard skip/navigation | passed in production browser build |
| Horizontal overflow | none at 320/390/768/1024/1280/1440 px |
| Reduced motion | animation and transition durations reduced |
| Next metadata routes | generated successfully by production build |
| Remote runtime fonts | none |
| Preview Lighthouse mobile median (3 samples) | Performance 94; Accessibility 100; Best Practices 100; SEO 61 |
| LCP | median 2.61 s; 2.55–2.68 s range; target missed by 0.11 s |
| CLS | 0 in all three samples |
| Blocking-time proxy | median 194 ms; field INP unavailable in a lab audit |
| SEO surface verification | canonical, metadata, JSON-LD, manifest, robots, sitemap, and share image routes passed |

## Risks

- Mobile Performance, Accessibility, and Best Practices targets pass. Median LCP remains 0.11
  seconds over the 2.5-second target; this is a release exception, not a claimed pass.
- Vercel's protected preview is intentionally non-crawlable, so Lighthouse reports SEO 61 from
  `is-crawlable` and `robots-txt` even though the application's SEO routes and metadata pass
  semantic verification. Recheck SEO after a reviewed production promotion.
- Browser-engine text rendering can vary with the documented system font stack.
- The in-app visual browser was unavailable in this session; automated Edge viewport and
  accessibility coverage passed, but human preview/production screenshot comparison remains
  explicitly pending.

## Preview evidence

- URL: `https://ti15-bracket26-iombinjr9-ti-bracket-26.vercel.app`
- Deployment: `dpl_8a7qRVPvYESfRi2tMuWqKfCcTpkW`
- Audited application SHA: `57b86017ba56a8ac16fd4861389d3a77b525b5dc`
- Audit time: 2026-08-14 23:03–23:06 UTC

## Commit

`3199364` — `Gate G: complete accessibility and sharing surfaces`
