import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://ti15-bracket26.vercel.app/sitemap.xml",
    host: "https://ti15-bracket26.vercel.app",
  };
}
