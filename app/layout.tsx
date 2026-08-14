import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TI15 — The International 2026",
  description:
    "Live bracket, standings and schedule for The International 2026 in Shanghai. All times in Eastern.",
};

export const viewport: Viewport = {
  // viewport-fit=cover so the sticky live bar can clear the iPhone home indicator
  // via safe-area insets in Phase 2.
  viewportFit: "cover",
  themeColor: "#0A0D12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
