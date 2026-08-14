# Gate G — accessibility, performance, SEO, and sharing

**Date:** 2026-08-14  
**Status:** complete locally; preview performance audit pending  
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
| Preview Lighthouse | pending Gate H preview URL |

## Risks

- Lighthouse performance thresholds must be measured against the Vercel preview rather than
  inferred from localhost.
- Browser-engine text rendering can vary with the documented system font stack.
- The in-app visual browser was unavailable in this session; automated Edge viewport and
  accessibility coverage passed, but the preview screenshot review remains explicitly pending.

## Commit

Recorded in the next gate report because a commit cannot contain its own hash.
