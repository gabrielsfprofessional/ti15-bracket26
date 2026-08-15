import { ART_ENABLED } from "@/lib/art";

/**
 * The Aegis medallion, derived from the commissioned fan art (see docs/ART.md).
 *
 * `won` drives the whole point of the element: through the group stage it sits
 * desaturated and dim with a slow ember breath behind it, because it is the
 * thing that has not been won yet. It saturates to full gold only once a
 * champion is decided.
 *
 * Always decorative — every medallion instance is aria-hidden and the
 * surrounding component carries the real text. It is never the site's identity
 * mark; that is live text in the hero.
 */
export function AegisMedallion({
  won = false,
  size = 132,
  className = "",
  priority = false,
}: {
  won?: boolean;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  if (!ART_ENABLED) return null;

  // Source is 440x352; height is derived so the box never causes a shift.
  const height = Math.round((size * 352) / 440);

  return (
    <span
      className={`aegis ${won ? "aegis--won" : "aegis--dormant"} ${className}`.trim()}
      style={{ width: size, height }}
      aria-hidden
    >
      <span className="aegis__ember" />
      <picture>
        <source type="image/avif" srcSet="/art/aegis.avif" />
        <source type="image/webp" srcSet="/art/aegis.webp" />
        <img
          src="/art/aegis.webp"
          alt=""
          width={440}
          height={352}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
        />
      </picture>
    </span>
  );
}
