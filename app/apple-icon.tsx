import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { ART_ENABLED } from "@/lib/art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Inlined at build time; the icon route never reaches the network. */
const MEDALLION = ART_ENABLED ? loadMedallion() : null;

function loadMedallion(): string | null {
  try {
    const file = readFileSync(path.join(process.cwd(), "public", "art", "aegis-icon.png"));
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

export default function AppleIcon() {
  if (!MEDALLION) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#090b0f", color: "#d7b56d", fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 62, border: "10px solid #272e37" }}>
        TI
      </div>,
      size,
    );
  }

  // The medallion is a 5:4 ellipse, so it is centred in the square rather than
  // stretched to fill it.
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0709" }}>
      {/* Satori renders this to a PNG; next/image does not apply here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MEDALLION} width={168} height={134} alt="" />
    </div>,
    size,
  );
}
