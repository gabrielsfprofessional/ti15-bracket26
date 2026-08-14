import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildTournament } from "../lib/opendota";
import type { Tournament } from "../lib/types";
import { assertTournamentValid, tournamentDataChanged } from "../lib/validation";

const SNAPSHOT_PATH = fileURLToPath(new URL("../data/tournament.json", import.meta.url));

async function readCommittedSnapshot(): Promise<Tournament | null> {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as Tournament;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function main(): Promise<void> {
  const committed = await readCommittedSnapshot();
  const candidate = await buildTournament(Date.now());

  if (candidate.syncState === "degraded") {
    throw new Error("OpenDota returned partial data; refusing to replace the snapshot");
  }

  assertTournamentValid(candidate, committed?.series.length ?? 0);

  if (committed && !tournamentDataChanged(candidate, committed)) {
    console.log(
      "[snapshot] validated successfully; tournament data is unchanged, so no file was written",
    );
    return;
  }

  await writeFile(SNAPSHOT_PATH, JSON.stringify(candidate, null, 2) + "\n", "utf8");
  console.log(
    "[snapshot] wrote " +
      candidate.series.length +
      " series at " +
      candidate.lastSyncUtc,
  );
}

main().catch((error: unknown) => {
  console.error("[snapshot] FAILED — committed snapshot left untouched", error);
  process.exitCode = 1;
});
