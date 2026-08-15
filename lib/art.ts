/**
 * Kill switch for the photographic art layer.
 *
 * The abstract, code-native "Aegis Vault" treatment that shipped before the art
 * is still present in globals.css and is what renders whenever this is off, so
 * the art can be pulled without a redesign — set NEXT_PUBLIC_ART=off and
 * redeploy. Provenance and the terms the art ships under are in docs/ART.md.
 *
 * Read at module scope so it is inlined at build time and costs nothing per
 * request. Anything other than the literal "off" leaves the art on.
 */
export const ART_ENABLED = process.env.NEXT_PUBLIC_ART !== "off";

/** Body class the CSS keys every art surface off. */
export const artBodyClass = ART_ENABLED ? "art-on" : "art-off";
