"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ti15] render failed", { digest: error.digest, name: error.name });
  }, [error]);

  return (
    <main className="state-page">
      <div className="state-page__identity">
        <span className="eyebrow">Last-resort display guard</span>
        <h1>The International <strong>2026</strong></h1>
      </div>
      <section className="state-error" aria-labelledby="error-heading">
        <h2 id="error-heading">Tournament view temporarily unavailable</h2>
        <p>
          The page could not render its last valid tournament state. Retry once; the data pipeline
          will continue protecting the committed snapshot in the background.
        </p>
        <button type="button" onClick={reset}>Retry</button>
      </section>
      <p className="state-page__legal">
        Unofficial and not affiliated with Valve Corporation. Match data from OpenDota.
      </p>
    </main>
  );
}
