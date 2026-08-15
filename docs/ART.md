# Art: provenance, terms, and derivation

**Decision date:** 2026-08-14
**Authorized by:** the project owner, who commissioned the source images.
**Supersedes:** the "do not render the four source PNGs" decision in `docs/ARTWORK.md`,
which was recorded before provenance was established.

## Provenance

The four files in `public/art/source/` are **AI-generated fan art commissioned by the project
owner**. They are not Valve key art, not scraped from a Valve property, and not licensed
stock. They are derivative of Valve intellectual property — Dota 2, The International, the
Aegis of Champions, and the hero designs are Valve Corporation properties.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `dota_2_branding_1.png` | 1,468,898 | `2B18754810D7AA99260766BFCE59B898F74919ECA55D57B08996EFEEBE718C99` |
| `dota_2_branding_2.png` | 1,086,873 | `F112BB8D9F72F5700926520128F9987202B2E29EB1A2153B7A69488F13E8A4A0` |
| `dota_2_branding_3.png` | 1,083,032 | `751440857D6B2F46532F9249462E7314F1EBB19549E0D0A6AFA42264B6CAF733` |
| `dota_2_branding_4.png` | 1,297,526 | `8A6C463CC88EA5D26CADFCAF90EB2F904EBB444BCEA92EF804D143EECDF616EC` |

The sources are retained unmodified so every shipped derivative can be re-derived and audited.
They are **never served** — nothing in the app references `public/art/source/`.

## Terms this art ships under

These are conditions, not aspirations. Each one is enforced somewhere concrete.

1. **The site stays free and unmonetized.** No ads, no affiliate links, no sponsorship.
2. **The non-affiliation disclaimer stays visible in the footer.** It is rendered
   unconditionally by `TournamentFooter` in `components/TournamentHeader.tsx` and is not behind
   the art flag.
3. **Atmospheric backdrop only.** The art is never presented as official Valve key art and is
   never the site's identity mark.
4. **No baked wordmark and no Dota 2 logo mark survives into a shipped derivative.** Site
   identity is live text: the `TI15` mark, the `The International 2026` heading, and the
   `Shanghai, China · August 13–23, 2026` line are all real DOM text in the hero. Reproducing
   an official-looking logo is what would imply endorsement.
5. **Non-commercial fan use**, disclaimed, on a tracker that invents no results.

## Which source carries which surface

The assignment is driven entirely by rule 4 above. **Only `_3` is free of baked marks**, so it
carries every surface that needs an unconstrained crop. The others are cropped to bands that
provably exclude their marks.

| Source | Marks present | Shipped as |
| --- | --- | --- |
| `_1` | `DOTA 2` wordmark + red Dota logo, `TI15`, `THE INTERNATIONAL 2026`, `SHANGHAI`; edge banner marks | `ambient-section` — inner upper band only (x 210–940, y 55–385), above the wordmark and inside the banners |
| `_2` | `TI15`, `THE INTERNATIONAL 2026`, `SHANGHAI, CHINA`, tagline, Chinese text, two Dota logos | `aegis` + `aegis-icon` — the medallion ellipse only |
| `_3` | **none** | `hero-desktop`, `hero-mobile`, `og-backdrop` |
| `_4` | Dota 2 logo in a stone plaque + `TI15` wordmark, top-centre | `ambient-results` — band from y 232 down, below the plaque |

Note that `_4` contains **no Aegis**; the medallion could only come from `_1` or `_2`, and `_2`
has the cleaner, better-lit instance.

## Derivation

`npm run art` regenerates every shipped asset from the sources. Outputs are committed, so the
site never depends on the script at build or request time.

`scripts/art.ts` resolves `sharp` from the copy Next.js already installs. It is deliberately
**not** added to `package.json` — nothing at runtime imports it, and adding it would put a
native binary in the dependency graph for an asset step that runs by hand.

### The medallion

The Aegis ellipse in `_2` is centred at (487, 224) with rx 135, ry 108, measured off a
coordinate-grid overlay. Two variants ship:

- **`aegis.avif` / `aegis.webp`** — cut with a smoothstep radial falloff out to r×1.22 rather
  than a hard ellipse. A hard cut slices the gold ring and reads as die-cut; fading across the
  fire glow instead reads as the shield emitting light, which is what the champion slot wants.
  Past r×0.94 the blue channel is pulled down 75% and green 18%, because cool spill from the
  character behind the Aegis otherwise survives the cut as a haze on the top-right.
- **`aegis-icon.png`** — tight (r×1.02), glow-free, +18% saturation, +10% brightness, contrast
  stretched. The glow variant turns to mush below ~64px; this one holds the gold ring and the
  dark S-curve down to 32px. It stays PNG because it feeds the favicon and the Apple touch
  icon, and neither is a place to gamble on format support.

### Budgets

Sources are **1150×648 at most**, not high-resolution. That is ample for the medallion and
every icon size, and fine for a heavily scrimmed backdrop where softness is hidden, but the
desktop hero is upscaled ~1.4× to 1600px. Under a 0.20→0.93 scrim this is not visible.

| Asset | AVIF | WebP | Budget |
| --- | ---: | ---: | --- |
| `hero-desktop` | 74 KB | 96 KB | ≤ 350 KB |
| `hero-mobile` | 51 KB | 69 KB | ≤ 180 KB |
| `aegis` | 22 KB | 39 KB | decorative, lazy |
| `ambient-results` | 27 KB | 40 KB | decorative, lazy |
| `ambient-section` | 40 KB | 67 KB | decorative, lazy |
| `aegis-icon.png` | 19 KB | — | icon |
| `og-backdrop.jpg` | 139 KB | — | build-time only, never on the page |

Only the hero is preloaded, and only the one variant the viewport will paint — `media` keeps
the other off the wire, and `type` keeps browsers without AVIF from fetching a file they cannot
decode. Everything else is `loading="lazy"`. The live dock and the next-up data render from the
server payload and never wait on art.

## Legibility

Every art surface is scrimmed, and contrast was measured against the **composited** pixel (art
blended under the scrim over `#0b0709`), not against the token colour.

- **Desktop hero** — scrim is heaviest under the text column (0.93) and eases to 0.20 at the
  far right. Against the brightest pixel in the source: `--text` 14.5:1, `--gold` 9.3:1.
- **Mobile hero** — text overlays the full frame, so the horizontal falloff gives way to a
  vertical one with a 0.86 floor anywhere type sits. `--gold` 7.8:1 at that floor.
- **Section ambients** — 11% opacity with a fade-out mask. If the heroes read as figures rather
  than texture, it is too strong.

WCAG 2.2 AA is maintained throughout.

## Kill switch

Set `NEXT_PUBLIC_ART=off` and redeploy. The body class flips from `art-on` to `art-off`, the
entire `ART LAYER` block in `app/globals.css` stops applying, the `<picture>` elements and the
hero preloads are not rendered at all, and the original code-native "Aegis Vault" treatment —
abstract geometry made from gradients, borders, and type — renders in its place. The OG card
and the Apple touch icon fall back to their pre-art abstract versions. See `lib/art.ts`.

## Other rights and attribution

- Team marks in `public/logos/` are locally served and belong to their organizations.
- Dota 2, The International, and the Aegis of Champions are Valve Corporation properties.
- Match data attribution points to OpenDota.
- The site is free, non-commercial, and not affiliated with or endorsed by Valve.
