import type { Metadata, Viewport } from "next";
import { ART_ENABLED, artBodyClass } from "@/lib/art";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ti15-bracket26.vercel.app";
const DESCRIPTION =
  "Unofficial live companion for The International 2026 in Shanghai: live series, complete schedule, Swiss standings, game results, and verified bracket updates.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TI15 Live Tracker — The International 2026",
    template: "%s · TI15 Live Tracker",
  },
  description: DESCRIPTION,
  applicationName: "TI15 Live Tracker",
  alternates: { canonical: "/" },
  keywords: ["TI15", "The International 2026", "Dota 2", "Shanghai", "schedule", "standings"],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TI15 Live Tracker",
    title: "TI15 Live Tracker — The International 2026",
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "TI15 live tournament tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TI15 Live Tracker — The International 2026",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  icons: ART_ENABLED
    ? {
        // The medallion PNG leads because it is the identity mark; icon.svg stays
        // as the fallback so turning the art off still leaves a usable favicon.
        icon: [
          { url: "/art/aegis-icon.png", type: "image/png", sizes: "180x144" },
          { url: "/icon.svg", type: "image/svg+xml" },
        ],
        apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
      }
    : {
        icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
        apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
      },
  manifest: "/manifest.webmanifest",
  category: "sports",
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#090b0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      {ART_ENABLED && (
        <head>
          {/*
            Only the hero is preloaded, and only the one variant the viewport
            will actually paint — `media` keeps the other off the wire entirely,
            and `type` keeps browsers without AVIF from fetching a file they
            cannot decode (they pick up the WebP from <picture> instead).
            Every other art surface is lazy-loaded. Nothing here blocks the live
            dock or the next-up data, which render from the server payload.
          */}
          <link
            rel="preload"
            as="image"
            href="/art/hero-mobile.avif"
            type="image/avif"
            media="(max-width: 819px)"
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            href="/art/hero-desktop.avif"
            type="image/avif"
            media="(min-width: 820px)"
            fetchPriority="high"
          />
        </head>
      )}
      <body className={artBodyClass}>{children}</body>
    </html>
  );
}
