import { describe, expect, it } from "vitest";
import { ago, countdown, etAbbreviation, formatEt, formatEtDay, formatEtTime } from "./time";

describe("Eastern formatting", () => {
  it("renders August as EDT (UTC-4), not a hardcoded UTC-5", () => {
    // 2026-08-21T03:00Z is 11:00 PM Eastern on Aug 20. A fixed -5 offset would
    // print 10:00 PM and be wrong for every match of this tournament.
    expect(formatEt("2026-08-21T03:00:00Z")).toBe("Thu Aug 20, 11:00 PM EDT");
  });

  it("switches to EST in winter without any code change", () => {
    expect(formatEt("2026-01-15T17:30:00Z")).toBe("Thu Jan 15, 12:30 PM EST");
    expect(etAbbreviation("2026-01-15T17:30:00Z")).toBe("EST");
    expect(etAbbreviation("2026-08-21T03:00:00Z")).toBe("EDT");
  });

  it("carries the weekday across the date-line-crossing Shanghai schedule", () => {
    // A 10:00 AM Shanghai start on Aug 15 is the previous EVENING in the US.
    const shanghai10amAug15 = "2026-08-15T02:00:00Z";
    expect(formatEt(shanghai10amAug15)).toBe("Fri Aug 14, 10:00 PM EDT");
    expect(formatEtDay(shanghai10amAug15)).toBe("Fri Aug 14");
    expect(formatEtTime(shanghai10amAug15)).toBe("10:00 PM EDT");
  });

  it("handles midnight and noon without printing 0:00", () => {
    expect(formatEt("2026-08-20T04:00:00Z")).toBe("Thu Aug 20, 12:00 AM EDT");
    expect(formatEt("2026-08-20T16:00:00Z")).toBe("Thu Aug 20, 12:00 PM EDT");
  });

  it("degrades safely on missing or malformed input", () => {
    expect(formatEt(null)).toBe("Time TBD");
    expect(formatEt(undefined)).toBe("Time TBD");
    expect(formatEt("not a date")).toBe("Time TBD");
    expect(formatEtDay(null)).toBe("TBD");
    expect(formatEtTime(null)).toBe("");
  });
});

describe("countdown", () => {
  const now = Date.parse("2026-08-20T12:00:00Z");

  it("formats hours and minutes", () => {
    expect(countdown("2026-08-20T16:12:00Z", now)).toBe("in 4h 12m");
  });

  it("formats minutes only under an hour", () => {
    expect(countdown("2026-08-20T12:25:00Z", now)).toBe("in 25m");
  });

  it("formats days and hours over a day out", () => {
    expect(countdown("2026-08-22T16:00:00Z", now)).toBe("in 2d 4h");
  });

  it("collapses the final minute rather than ticking seconds", () => {
    expect(countdown("2026-08-20T12:00:30Z", now)).toBe("in <1m");
  });

  it("returns null once the target has passed or is now", () => {
    expect(countdown("2026-08-20T12:00:00Z", now)).toBeNull();
    expect(countdown("2026-08-20T11:59:00Z", now)).toBeNull();
    expect(countdown(null, now)).toBeNull();
    expect(countdown("garbage", now)).toBeNull();
  });

  it("is pure — it never reads the clock itself", () => {
    const a = countdown("2026-08-20T16:12:00Z", now);
    const b = countdown("2026-08-20T16:12:00Z", now);
    expect(a).toBe(b);
  });
});

describe("ago", () => {
  const now = Date.parse("2026-08-20T12:00:00Z");

  it("describes recent syncs", () => {
    expect(ago("2026-08-20T11:59:30Z", now)).toBe("just now");
    expect(ago("2026-08-20T11:52:00Z", now)).toBe("8m ago");
    expect(ago("2026-08-20T09:00:00Z", now)).toBe("3h ago");
    expect(ago("2026-08-18T12:00:00Z", now)).toBe("2d ago");
  });

  it("never shows a negative age from small clock skew", () => {
    expect(ago("2026-08-20T12:00:10Z", now)).toBe("just now");
  });

  it("handles a missing timestamp", () => {
    expect(ago(null, now)).toBe("never");
  });
});
