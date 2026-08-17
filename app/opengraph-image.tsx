import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { ART_ENABLED } from "@/lib/art";

export const alt = "TI15 live tournament tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Read once at module scope, and only from disk. The card is generated at build
 * time, so this never touches the network and never runs per request. The
 * backdrop is derived from the mark-free source (see docs/ART.md); every word on
 * the card is live text composited here, never baked pixels.
 */
const BACKDROP = ART_ENABLED ? loadBackdrop() : null;

function loadBackdrop(): string | null {
  try {
    const file = readFileSync(path.join(process.cwd(), "public", "art", "og-backdrop.jpg"));
    return `data:image/jpeg;base64,${file.toString("base64")}`;
  } catch {
    // Falls through to the abstract treatment rather than failing the build.
    return null;
  }
}

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#090b0f",
        color: "#eef2f5",
        fontFamily: "Arial, sans-serif",
        padding: "72px 82px",
      }}
    >
      {BACKDROP ? (
        <>
          {/* Satori renders this to a PNG; next/image does not apply here. */}
          <img src={BACKDROP} width={1200} height={630} style={{ position: "absolute", inset: 0 }} alt="" />
          {/* Same scrim intent as the hero: heaviest under the type column. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(100deg, rgba(11,7,9,0.94) 0%, rgba(11,7,9,0.93) 50%, rgba(11,7,9,0.58) 76%, rgba(11,7,9,0.24) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background: "linear-gradient(180deg, rgba(11,7,9,0.42) 0%, rgba(11,7,9,0.2) 45%, rgba(11,7,9,0.88) 100%)",
            }}
          />
        </>
      ) : (
        <>
          <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(circle at 80% 25%, #52231f 0%, transparent 38%), radial-gradient(circle at 20% 100%, #12383e 0%, transparent 36%)" }} />
          <div style={{ position: "absolute", right: 90, top: 80, width: 320, height: 420, display: "flex", transform: "rotate(45deg)", border: "2px solid #d7b56d55", boxShadow: "0 0 0 34px #d7b56d12, 0 0 0 70px #57c7d40b" }} />
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#f0ce83", fontSize: 24, letterSpacing: 6, textTransform: "uppercase" }}>
          TI15 · Shanghai · August 13–23
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, lineHeight: 0.95, letterSpacing: -4, fontWeight: 800 }}>The International</div>
          <div style={{ fontSize: 92, lineHeight: 0.95, letterSpacing: -4, fontWeight: 800, color: "#f0ce83" }}>2026</div>
          <div style={{ marginTop: 34, fontSize: 30, color: "#d3d9e0" }}>Live matches · Complete schedule · Swiss standings · Game results</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#aab4c1" }}>
          <span style={{ color: "#7fd7e2" }}>Unofficial tournament companion</span>
          <span>·</span>
          <span>ti15-bracket26.vercel.app</span>
        </div>
      </div>
    </div>,
    size,
  );
}
