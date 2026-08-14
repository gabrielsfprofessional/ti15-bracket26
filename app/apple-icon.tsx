import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#090b0f", color: "#d7b56d", fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 62, border: "10px solid #272e37" }}>
      TI
    </div>,
    size,
  );
}
