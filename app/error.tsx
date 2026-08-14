"use client";

import { useEffect } from "react";

/**
 * The last line of defence. Whatever went wrong, a visitor must never see a raw
 * stack trace, a blank page, or the string "undefined" — this is a public site
 * that people will open on a phone in the middle of a match.
 *
 * It deliberately shows no error detail. The message is operational advice, not
 * diagnostics; the detail goes to the console and to Vercel's logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ti15] render failed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold tracking-wide text-[#c9d3dc]">The International 2026</h1>

      <div className="border border-[#e4432f] p-4">
        <p className="text-sm font-semibold text-[#e4432f]">Live data is temporarily unavailable</p>
        <p className="mt-2 text-sm leading-relaxed text-[#9aa7b4]">
          OpenDota did not answer in time. Scores are unaffected — this page just could not read
          them right now. Try again in a moment.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-4 min-h-11 border border-[#6b7785] px-4 text-sm text-[#c9d3dc]"
        >
          Retry
        </button>
      </div>

      <p className="text-xs leading-relaxed text-[#6b7785]">
        Not affiliated with or endorsed by Valve Corporation. Dota 2 is a trademark of Valve. Match
        data from OpenDota.
      </p>
    </main>
  );
}
