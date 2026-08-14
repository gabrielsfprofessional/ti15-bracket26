import { validatePublicState } from "../lib/public-state";

const PRODUCTION_STATE_URL = "https://ti15-bracket26.vercel.app/api/state";
const POLL_MS = 15_000;
const POLL_TIMEOUT_MS = 8 * 60_000;

async function inspect(url: string, expectedSha?: string): Promise<ReturnType<typeof validatePublicState>> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent":
        "TI15-Bracket-Uptime/2.0 (+https://github.com/gabrielsfprofessional/ti15-bracket26)",
    },
  });

  if (!response.ok) throw new Error(url + " returned HTTP " + response.status);
  return validatePublicState(await response.json(), {
    nowMs: Date.now(),
    expectedSha,
    maximumSnapshotAgeMs: Number(process.env.UPTIME_MAX_SNAPSHOT_AGE_MS) || undefined,
  });
}

async function main(): Promise<void> {
  const url = process.env.UPTIME_URL ?? PRODUCTION_STATE_URL;
  const expectedSha = process.env.UPTIME_EXPECTED_SHA?.trim() || undefined;
  const deadline = Date.now() + (expectedSha ? POLL_TIMEOUT_MS : 0);
  let lastFailure = "no check completed";

  do {
    try {
      const result = await inspect(url, expectedSha);
      if (result.valid) {
        console.log("[uptime] verified", result.summary);
        return;
      }
      lastFailure = result.errors.join("; ");
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    if (!expectedSha || Date.now() >= deadline) break;
    console.log("[uptime] waiting for production alias:", lastFailure);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  } while (Date.now() < deadline);

  throw new Error(lastFailure);
}

main().catch((error: unknown) => {
  console.error("[uptime] FAILED", error);
  process.exitCode = 1;
});
