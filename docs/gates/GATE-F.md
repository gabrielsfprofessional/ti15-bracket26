# Gate F — “Aegis Vault” visual system

**Date:** 2026-08-14  
**Status:** complete locally; not pushed or deployed  
**Parent:** `815272b`

## Delivered

- Introduced a restrained obsidian/charcoal foundation with Aegis-gold hierarchy, ember live
  energy, and cyan data/focus accents.
- Defined reusable color, surface, border, text, spacing, radius, shadow, type, duration, and easing
  tokens in one stylesheet.
- Built the hero, rune geometry, live dock, filters, cards, standings, bracket, responsive tables,
  loading state, and last-resort error state without hiding match information under artwork.
- Added focus-visible treatment, safe-area support, restrained live pulse, and complete
  `prefers-reduced-motion` overrides.
- Removed unused Motion and Lucide runtime dependencies; the visual system is CSS-native.
- Audited the four source PNGs by filename, byte size, and SHA-256. Their provenance/permission is
  unverified, so none is referenced or transformed for production.
- Documented the local/system font stack and retained tabular numeric treatment.

## Files

- `app/globals.css`, `app/loading.tsx`, `app/error.tsx`
- `docs/ARTWORK.md`, `docs/gates/GATE-E.md`, `docs/gates/GATE-F.md`
- `package.json`, `package-lock.json`
- `README.md`

## Verification

| Check | Result |
| --- | --- |
| Bitmap hero payload | 0 bytes; code-native fallback |
| Unapproved art references | none in application, metadata, manifest, or share routes |
| Runtime font requests | none |
| Runtime dependency audit | 0 vulnerabilities |
| Reduced-motion browser assertion | passed |
| Required-width overflow assertion | passed at 320/390/768/1024/1280/1440 px |

## Risks

- The source PNGs remain intentionally unapproved until a rights chain and permitted-use terms are
  recorded. They are not initial-page assets.
- Exact typeface selection varies by operating system because the product intentionally avoids a
  remote font dependency.

## Commit

`8bc3dc8` — `Gate F: establish the Aegis Vault visual system`
