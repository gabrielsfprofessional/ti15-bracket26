import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://ti15-bracket26.vercel.app/",
      lastModified: new Date("2026-08-14T00:00:00Z"),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
