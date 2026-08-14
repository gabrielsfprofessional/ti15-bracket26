const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export interface PublicStateCheckOptions {
  nowMs: number;
  expectedSha?: string;
  minimumSeries?: number;
  maximumSnapshotAgeMs?: number;
}

export interface PublicStateCheck {
  valid: boolean;
  errors: string[];
  summary: {
    syncState: string;
    teams: number;
    series: number;
    completed: number;
    snapshotGeneratedUtc: string | null;
    deploymentSha: string | null;
  };
}

/** Pure production/preview contract validation used by the uptime poller. */
export function validatePublicState(
  value: unknown,
  options: PublicStateCheckOptions,
): PublicStateCheck {
  const errors: string[] = [];
  const root = isRecord(value) ? value : {};
  if (!isRecord(value)) errors.push("payload is not an object");

  if (root.leagueId !== 19719) errors.push(`leagueId is ${String(root.leagueId)}`);

  const teams = Array.isArray(root.teams) ? root.teams.filter(isRecord) : [];
  const teamIds = teams.map((team) => team.id).filter((id): id is number => Number.isSafeInteger(id));
  if (teams.length !== 16 || new Set(teamIds).size !== 16) {
    errors.push(`expected 16 unique teams, received ${teams.length} rows/${new Set(teamIds).size} ids`);
  }

  const minimumSeries = options.minimumSeries ?? 39;
  const series = Array.isArray(root.series) ? root.series.filter(isRecord) : [];
  if (series.length < minimumSeries || series.length > 256) {
    errors.push(`series count ${series.length} is outside ${minimumSeries}..256`);
  }
  const seriesIds = series.map((item) => item.id).filter((id): id is string => typeof id === "string");
  if (seriesIds.length !== series.length || new Set(seriesIds).size !== series.length) {
    errors.push("series IDs are missing or duplicated");
  }
  const completed = series.filter((item) => item.status === "completed").length;

  const swiss = Array.isArray(root.swiss) ? root.swiss.filter(isRecord) : [];
  if (swiss.length !== 16) errors.push(`expected 16 Swiss rows, received ${swiss.length}`);
  const wins = swiss.reduce((sum, row) => sum + numeric(row.wins), 0);
  const losses = swiss.reduce((sum, row) => sum + numeric(row.losses), 0);
  if (wins !== losses) errors.push(`Swiss parity failed: ${wins} wins/${losses} losses`);

  const syncState = typeof root.syncState === "string" ? root.syncState : "missing";
  if (syncState !== "ok" && syncState !== "manual") {
    errors.push(`syncState is ${syncState}`);
  }

  const sourceHealth = isRecord(root.sourceHealth) ? root.sourceHealth : null;
  if (!sourceHealth) errors.push("sourceHealth is missing");
  const expectedMode = syncState === "manual" ? "manual" : "live";
  if (sourceHealth?.mode !== expectedMode) {
    errors.push(`served mode is ${String(sourceHealth?.mode)}, expected ${expectedMode}`);
  }
  for (const key of ["matches", "live", "schedule"] as const) {
    const observation = sourceHealth && isRecord(sourceHealth[key]) ? sourceHealth[key] : null;
    if (!observation || !isUtcIso(observation.observedUtc)) {
      errors.push(`${key} observation time is invalid`);
    }
    const allowed = key === "schedule" ? ["ok", "managed"] : ["ok"];
    if (!observation || !allowed.includes(String(observation.status))) {
      errors.push(`${key} source status is ${String(observation?.status)}`);
    }
  }

  const snapshotGeneratedUtc =
    sourceHealth && typeof sourceHealth.snapshotGeneratedUtc === "string"
      ? sourceHealth.snapshotGeneratedUtc
      : null;
  if (!isUtcIso(snapshotGeneratedUtc)) {
    errors.push("snapshot generation time is invalid");
  } else {
    const maximumAge = options.maximumSnapshotAgeMs ?? 36 * 3_600_000;
    const age = options.nowMs - Date.parse(snapshotGeneratedUtc);
    if (age < -5 * 60_000 || age > maximumAge) {
      errors.push(`snapshot age ${Math.round(age / 60_000)}m is outside the accepted window`);
    }
  }

  const deploymentSha = typeof root.deploymentSha === "string" ? root.deploymentSha : null;
  if (options.expectedSha && deploymentSha !== options.expectedSha) {
    errors.push(`deployment SHA is ${deploymentSha ?? "missing"}, expected ${options.expectedSha}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: { syncState, teams: teams.length, series: series.length, completed, snapshotGeneratedUtc, deploymentSha },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function numeric(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : 0;
}

function isUtcIso(value: unknown): value is string {
  return typeof value === "string" && UTC_ISO.test(value) && !Number.isNaN(Date.parse(value));
}
