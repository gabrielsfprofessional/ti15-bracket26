import type { Metadata, Viewport } from "next";
import "./globals.css";

// Absolute base for OG/Twitter image URLs. Without it, the Phase 4 share cards
// resolve against a relative path and fail silently — the card just never renders
// on Discord or iMessage, with no build error to warn you. The literal fallback
// keeps the production build correct even before NEXT_PUBLIC_SITE_URL is set in
// the Vercel dashboard; the env var is what makes preview deploys point at
// themselves rather than at production.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ti15-bracket26.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
