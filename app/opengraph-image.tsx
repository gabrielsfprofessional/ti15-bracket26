import { ImageResponse } from "next/og";

export const alt = "TI15 live tournament tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(circle at 80% 25%, #52231f 0%, transparent 38%), radial-gradient(circle at 20% 100%, #12383e 0%, transparent 36%)" }} />
      <div style={{ position: "absolute", right: 90, top: 80, width: 320, height: 420, display: "flex", transform: "rotate(45deg)", border: "2px solid #d7b56d55", boxShadow: "0 0 0 34px #d7b56d12, 0 0 0 70px #57c7d40b" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#d7b56d", fontSize: 24, letterSpacing: 6, textTransform: "uppercase" }}>
          TI15 · Shanghai · August 13–23
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, lineHeight: 0.95, letterSpacing: -4, fontWeight: 800 }}>The International</div>
          <div style={{ fontSize: 92, lineHeight: 0.95, letterSpacing: -4, fontWeight: 800, color: "#d7b56d" }}>2026</div>
          <div style={{ marginTop: 34, fontSize: 30, color: "#c4cbd4" }}>Live matches · Complete schedule · Swiss standings · Game results</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#9aa6b5" }}>
          <span style={{ color: "#57c7d4" }}>Unofficial tournament companion</span>
          <span>·</span>
          <span>ti15-bracket26.vercel.app</span>
        </div>
      </div>
    </div>,
    size,
  );
}
