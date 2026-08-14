import type { NextConfig } from "next";

// Deliberately minimal. No crons block anywhere in this project: Vercel Hobby
// only allows daily crons and a sub-daily one fails the deploy outright. All
// scheduled syncing runs on GitHub Actions instead.
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
