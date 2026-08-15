/**
 * Derives every shipped art asset from the four unmodified sources in
 * public/art/source/. Run with `npm run art`. Outputs are committed, so the
 * site never depends on this script at build or request time.
 *
 * Two rules drive every crop below, and both come from docs/ART.md:
 *   1. No baked wordmark and no Dota 2 logo mark may survive into a shipped
 *      derivative. Site identity is live text only.
 *   2. Only dota_2_branding_3.png is free of baked marks, so it carries every
 *      surface that needs an unconstrained crop (both heroes and the share
 *      card). The others are cropped to bands that provably exclude their marks.
 *
 * sharp is resolved from the copy Next.js already installs; it is deliberately
 * not added to package.json, since nothing at runtime imports it.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = (n: number) => path.join("public", "art", "source", `dota_2_branding_${n}.png`);
const OUT = path.join("public", "art");

type Box = { left: number; top: number; width: number; height: number };

/** Aegis ellipse in source _2, measured off a coordinate-grid overlay. */
const AEGIS = { cx: 487, cy: 224, rx: 135, ry: 108 };

/**
 * Cuts the medallion out of _2 with a smoothstep radial falloff rather than a
 * hard ellipse. A hard cut slices the gold ring and reads as die-cut; fading
 * across the fire glow instead reads as the shield emitting light, which is
 * what the champion slot wants. Past `warmFrom` the blue channel is pulled
 * down because cool spill from the character behind the Aegis otherwise
 * survives the cut as a haze on the top-right.
 */
async function medallion(fade: number, warm: boolean, out: string, width: number) {
  const { cx, cy, rx, ry } = AEGIS;
  const box: Box = {
    left: Math.round(cx - rx * fade),
    top: Math.round(cy - ry * fade),
    width: Math.round(rx * fade * 2),
    height: Math.round(ry * fade * 2),
  };
  const { data, info } = await sharp(SRC(2)).extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bcx = cx - box.left;
  const bcy = cy - box.top;
  const warmFrom = 0.94;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const dx = (x - bcx) / rx;
      const dy = (y - bcy) / ry;
      const r = Math.hypot(dx, dy);

      let alpha: number;
      if (r <= 1) alpha = 1;
      else if (r >= fade) alpha = 0;
      else {
        const t = (r - 1) / (fade - 1);
        alpha = 1 - t * t * (3 - 2 * t);
      }

      if (warm && r > warmFrom) {
        const k = Math.min(1, (r - warmFrom) / (fade - warmFrom));
        data[i + 2] = Math.round(data[i + 2] * (1 - 0.75 * k));
        data[i + 1] = Math.round(data[i + 1] * (1 - 0.18 * k));
      }
      data[i + 3] = Math.round(data[i + 3] * alpha);
    }
  }

  let pipe = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).resize({
    width,
    kernel: "lanczos3",
  });
  // The tight variant loses its glow, so it needs the contrast back to stay
  // legible once it is scaled down to a 32px favicon.
  if (!warm) pipe = pipe.modulate({ saturation: 1.18, brightness: 1.1 }).linear(1.22, -14);

  if (warm) {
    // Decorative, so it ships as AVIF + WebP with alpha. A PNG of the same
    // medallion is ~376KB, which is more than the whole desktop hero costs.
    await pipe.clone().avif({ quality: 58, effort: 6 }).toFile(path.join(OUT, `${out}.avif`));
    await pipe.clone().webp({ quality: 78, effort: 6, alphaQuality: 90 }).toFile(path.join(OUT, `${out}.webp`));
    return;
  }
  // The icon stays PNG: it feeds the favicon and the Apple touch icon, and
  // neither is a place to gamble on format support.
  await pipe.png({ compressionLevel: 9, palette: true, quality: 92 }).toFile(path.join(OUT, `${out}.png`));
}

/** Emits an AVIF + WebP pair. AVIF is the primary; WebP is the fallback. */
async function pair(input: ReturnType<typeof sharp>, name: string, avifQ: number, webpQ: number) {
  await input.clone().avif({ quality: avifQ, effort: 6 }).toFile(path.join(OUT, `${name}.avif`));
  await input.clone().webp({ quality: webpQ, effort: 6 }).toFile(path.join(OUT, `${name}.webp`));
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // --- Heroes and share card: source _3, the only mark-free file. ------------
  // The source band runs cool and muddy through its centre, and a touch of
  // contrast and saturation is what separates "atmospheric" from "dirty". It is
  // baked in here rather than applied as a CSS filter: the hero is the LCP
  // element, and a filter on it costs a full filter pass before first paint.
  const grade = (p: ReturnType<typeof sharp>) => p.modulate({ saturation: 1.14 }).linear(1.07, -9);

  // Wide band through the hero lineup, sized for the desktop hero's aspect.
  await pair(
    grade(sharp(SRC(3)).extract({ left: 0, top: 40, width: 978, height: 340 }).resize({ width: 1600, kernel: "lanczos3" })),
    "hero-desktop",
    52,
    72,
  );
  // Near-square centre crop; the desktop band is far too wide to letterbox on
  // a 390px viewport without losing every face.
  await pair(
    grade(sharp(SRC(3)).extract({ left: 239, top: 30, width: 500, height: 490 }).resize({ width: 780, kernel: "lanczos3" })),
    "hero-mobile",
    50,
    70,
  );

  // --- Ambients: cropped to bands that exclude every mark. -------------------
  // _4's Dota 2 plaque and TI15 wordmark sit above y=210; this band starts below it.
  await pair(
    sharp(SRC(4)).extract({ left: 0, top: 232, width: 1141, height: 400 }).resize({ width: 1100, kernel: "lanczos3" }),
    "ambient-results",
    44,
    64,
  );
  // _1's DOTA 2 wordmark begins near y=405 and its banner marks sit at the
  // outer edges, so this takes the inner upper band only.
  await pair(
    sharp(SRC(1)).extract({ left: 210, top: 55, width: 730, height: 330 }).resize({ width: 1100, kernel: "lanczos3" }),
    "ambient-section",
    44,
    64,
  );

  // --- Medallion: source _2. -------------------------------------------------
  await medallion(1.22, true, "aegis", 440); // champion slot, glow intact
  await medallion(1.02, false, "aegis-icon", 180); // favicon / touch icon

  // Static 1200x630 share card backdrop. Text is composited by the OG route.
  await sharp(SRC(3))
    .extract({ left: 0, top: 24, width: 978, height: 514 })
    .resize({ width: 1200, height: 630, kernel: "lanczos3" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(OUT, "og-backdrop.jpg"));

  console.log("art derivatives written to", OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
