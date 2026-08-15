import { ART_ENABLED } from "@/lib/art";

/**
 * Very low-opacity art behind a section, as texture rather than as an image.
 * Purely decorative and always lazy — it must never compete with the data on
 * top of it, and it must never be on the critical path for painting it.
 */
export function SectionAmbient({ name }: { name: "results" | "section" }) {
  if (!ART_ENABLED) return null;

  return (
    <div className="section-ambient" aria-hidden>
      <picture>
        <source type="image/avif" srcSet={`/art/ambient-${name}.avif`} />
        <source type="image/webp" srcSet={`/art/ambient-${name}.webp`} />
        <img src={`/art/ambient-${name}.webp`} alt="" width={1100} height={385} loading="lazy" decoding="async" />
      </picture>
    </div>
  );
}

/** Hairline engraved separator. Decorative; never carries meaning on its own. */
export function RuneDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`rune-divider ${className}`.trim()} aria-hidden>
      <span className="rune-divider__glyph" />
    </div>
  );
}
