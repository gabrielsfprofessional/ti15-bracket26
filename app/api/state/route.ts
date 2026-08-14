import { NextResponse } from "next/server";
import { buildTournament } from "@/lib/opendota";

/**
 * The whole tournament as JSON. The browser polls this so the page can update in
 * place without a refresh (wired up in Phase 3).
 *
 * Cache headers are as specified: the CDN serves a cached copy for 60s and will
 * keep serving a stale one for another 5 minutes while it revalidates, so a slow
 * or rate-limited OpenDota never turns into a blank page for a visitor.
 */
export const revalidate = 60;

export async function GET() {
  const tournament = await buildTournament(Date.now());

  return NextResponse.json(tournament, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
