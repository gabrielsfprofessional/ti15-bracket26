/**
 * Time formatting. Everything is stored as UTC ISO 8601 and displayed in Eastern.
 *
 * The offset is NEVER hardcoded. In August, Eastern is EDT (UTC-4); a fixed -5
 * would make every match time an hour wrong. The IANA zone handles the switch,
 * and `timeZoneName: "short"` prints EDT now and EST automatically in winter.
 *
 * Shanghai runs 12 hours ahead of Eastern, so most of this event lands in the US
 * late evening through early morning. A bare clock time is genuinely ambiguous
 * here, so every public formatter emits the weekday alongside the time.
 */

export const ET_ZONE = "America/New_York";

const PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

type Parts = Record<string, string>;

function parts(iso: string): Parts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const out: Parts = {};
  for (const p of PARTS_FMT.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** "Thu Aug 20" — the day half, on its own. */
export function formatEtDay(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const p = parts(iso);
  if (!p) return "TBD";
  return `${p.weekday} ${p.month} ${p.day}`;
}

/** "11:00 PM EDT" — the clock half, with a live zone abbreviation. */
export function formatEtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = parts(iso);
  if (!p) return "";
  return `${p.hour}:${p.minute} ${p.dayPeriod} ${p.timeZoneName}`;
}

/** "Thu Aug 20, 11:00 PM EDT" — the canonical public form. Never a bare clock. */
export function formatEt(iso: string | null | undefined): string {
  if (!iso) return "Time TBD";
  const p = parts(iso);
  if (!p) return "Time TBD";
  return `${p.weekday} ${p.month} ${p.day}, ${p.hour}:${p.minute} ${p.dayPeriod} ${p.timeZoneName}`;
}

/** The zone abbreviation alone at a given instant: "EDT" in August, "EST" in January. */
export function etAbbreviation(iso: string): string {
  return parts(iso)?.timeZoneName ?? "";
}

/**
 * "in 4h 12m". PURE — the caller supplies `nowMs`, so this never reads the clock
 * itself and stays testable and server/client consistent.
 * Returns null when there is nothing to count down to.
 */
export function countdown(targetIso: string | null | undefined, nowMs: number): string | null {
  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;

  let secs = Math.floor((target - nowMs) / 1000);
  if (secs <= 0) return null;
  if (secs < 60) return "in <1m";

  const days = Math.floor(secs / 86400);
  secs -= days * 86400;
  const hours = Math.floor(secs / 3600);
  secs -= hours * 3600;
  const mins = Math.floor(secs / 60);

  // Two units of precision is enough; "in 2d 4h 37m" is noise.
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

/** How long ago something happened: "3m ago". Used for the last-synced stamp. */
export function ago(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";

  const secs = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
