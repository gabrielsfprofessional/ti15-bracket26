const PRODUCTION_STATE_URL = "https://ti15-bracket26.vercel.app/api/state";

async function main(): Promise<void> {
  const url = process.env.UPTIME_URL ?? PRODUCTION_STATE_URL;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "TI15-Bracket-Uptime/1.0 (+https://github.com/gabrielsfprofessional/ti15-bracket26)",
    },
  });

  if (!response.ok) {
    throw new Error(url + " returned HTTP " + response.status);
  }

  const payload: unknown = await response.json();
  if (payload == null || typeof payload !== "object") {
    throw new Error(url + " returned a non-object JSON payload");
  }

  const syncState = (payload as Record<string, unknown>).syncState;
  if (typeof syncState !== "string" || syncState === "error") {
    throw new Error(url + " returned unsafe syncState " + String(syncState));
  }

  console.log("[uptime] HTTP 200, syncState=" + syncState);
}

main().catch((error: unknown) => {
  console.error("[uptime] FAILED", error);
  process.exitCode = 1;
});
