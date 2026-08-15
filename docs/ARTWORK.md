# Artwork, type, and attribution review

**Reviewed:** 2026-08-14
**Status: SUPERSEDED for the art decision.** Provenance was established on 2026-08-14 — the
sources are AI-generated fan art commissioned by the project owner — and derivatives now ship
under the terms recorded in [ART.md](./ART.md). Read that file for anything about the four
source PNGs. The type stack and attribution notes below remain current, and the code-native
abstract treatment described here is still the `NEXT_PUBLIC_ART=off` fallback.

**Original production decision (no longer in force):** use the code-native abstract fallback;
do not render the four source PNGs

## Source-material inventory

The files under `public/art/source/` arrived without an embedded license record, author credit, or
documented chain of custody. They are therefore retained only as unapproved source material and are
not referenced by the application, metadata, preload graph, manifest, or generated share card.
No crop or derivative has been shipped.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `dota_2_branding_1.png` | 1,468,898 | `2B18754810D7AA99260766BFCE59B898F74919ECA55D57B08996EFEEBE718C99` |
| `dota_2_branding_2.png` | 1,086,873 | `F112BB8D9F72F5700926520128F9987202B2E29EB1A2153B7A69488F13E8A4A0` |
| `dota_2_branding_3.png` | 1,083,032 | `751440857D6B2F46532F9249462E7314F1EBB19549E0D0A6AFA42264B6CAF733` |
| `dota_2_branding_4.png` | 1,297,526 | `8A6C463CC88EA5D26CADFCAF90EB2F904EBB444BCEA92EF804D143EECDF616EC` |

Approval requires a rights holder/source URL, license terms, permitted derivative and promotional
use, required attribution, and confirmation that the noncommercial deployment is covered. Until
all five are recorded here, these files must not enter a page or social asset.

## Shipped visual fallback

The “Aegis Vault” hero, icon, Apple icon, and 1200×630 sharing image are original, code-native
geometry made from gradients, borders, type, and abstract rune-like shapes. They do not reproduce
Valve key art, the Dota logo, the Aegis, or an official tournament mark. The product calls itself an
unofficial companion everywhere relevant and does not imply endorsement.

The fallback has no bitmap hero payload. This keeps the real first contentful asset below the
requested mobile/desktop artwork budgets and avoids an uncertain-rights preload.

## Type stack

No font is fetched at runtime. The stack uses locally installed/system faces:

- UI: `Inter` when installed, then `ui-sans-serif`, `system-ui`, Apple system, and Segoe UI;
- display: Arial Narrow/Roboto Condensed when installed, then Segoe UI;
- numeric: Cascadia Mono/SFMono/Consolas/`ui-monospace`.

Browser-provided generic and operating-system fonts are used under their platform distribution
terms. Scores, records, timers, and dates opt into tabular numerals.

## Other rights and attribution

- Team marks in `public/logos/` remain locally served and belong to their organizations.
- Dota 2 and The International are Valve Corporation properties.
- Match data attribution points to OpenDota.
- The site is free, noncommercial, and not affiliated with or endorsed by Valve.
