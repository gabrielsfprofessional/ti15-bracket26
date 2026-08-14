import scheduleFile from "@/data/schedule.json";
import type { ScheduleEntry, ScheduleFile, SourceObservation } from "./types";

export interface ScheduleProviderSnapshot {
  provider: "checked_in";
  matches: ScheduleEntry[];
  streamUrl?: string;
  health: SourceObservation;
}

/**
 * Narrow provider boundary for future schedule integrations. The checked-in
 * schedule remains the sole production provider until a credentialed source is
 * separately approved, mapped to OpenDota team IDs, and verified for TI15.
 */
export function readSchedule(nowMs: number): ScheduleProviderSnapshot {
  const file = scheduleFile as unknown as ScheduleFile;
  return {
    provider: "checked_in",
    matches: file.matches ?? [],
    streamUrl: file.streamUrl,
    health: {
      status: "managed",
      observedUtc: new Date(nowMs).toISOString(),
    },
  };
}
