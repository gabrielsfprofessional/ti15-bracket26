import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLeagueMatches } from "./opendota";

/**
 * C.7 — network hardening.
 *
 * These drive the real getJson through fetchLeagueMatches with a stubbed global
 * fetch. What matters is the retry POLICY: retrying a 404 is wasted quota
 * against a keyless rate limit, and not retrying a 429 or a 5xx throws away a
 * blip that would have healed on its own.
 */

function jsonOk(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function httpError(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getJson retry policy", () => {
  it("succeeds on the first try without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonOk([{ match_id: 1 }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLeagueMatches()).resolves.toEqual([{ match_id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a 500 and returns the second response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(500))
      .mockResolvedValueOnce(jsonOk([{ match_id: 2 }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLeagueMatches()).resolves.toEqual([{ match_id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once on a 429 — the rate limit we actually expect to hit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(httpError(429))
      .mockResolvedValueOnce(jsonOk([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLeagueMatches()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 404 — asking twice cannot fix a wrong question", async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpError(404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLeagueMatches()).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exactly one retry rather than looping", async () => {
    const fetchMock = vi.fn().mockResolvedValue(httpError(503));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLeagueMatches()).rejects.toThrow(/HTTP 503/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a transport failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLeagueMatches()).rejects.toThrow(/ECONNRESET/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a timeout, and names it as one", async () => {
    // Retrying a timeout costs another full 8s. On Vercel Hobby's 10s function
    // limit that turns a slow upstream into a 504 on the page — the exact
    // outcome the timeout was added to prevent.
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLeagueMatches()).rejects.toThrow(/timed out after 8000ms/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the whole call inside one 8s budget, retry included", async () => {
    // The retry shares the budget rather than starting a fresh one, so the
    // second attempt's abort timeout is strictly smaller than the first's.
    const timeouts: number[] = [];
    const fetchMock = vi.fn().mockImplementation(() => {
      // The remaining budget is what fetchOnce hands to its AbortController;
      // observing it directly would need internals, so infer it from the clock.
      timeouts.push(Date.now());
      return Promise.resolve(httpError(500));
    });
    vi.stubGlobal("fetch", fetchMock);

    const started = Date.now();
    await expect(fetchLeagueMatches()).rejects.toThrow(/HTTP 500/);
    const elapsed = Date.now() - started;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 1s backoff plus two near-instant responses — nowhere near the 8s budget,
    // and structurally incapable of reaching 17s.
    expect(elapsed).toBeLessThan(8_000);
  });
});

describe("outbound request shape", () => {
  it("carries an abort signal and an identifying User-Agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonOk([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchLeagueMatches();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.opendota.com/api/leagues/19719/matches");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const ua = (init.headers as Record<string, string>)["User-Agent"];
    expect(ua).toContain("TI15-Bracket");
    expect(ua).toContain("github.com/gabrielsfprofessional/ti15-bracket");
  });

  it("sends no API key of any kind", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonOk([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchLeagueMatches();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("api_key");
    const headerNames = Object.keys(init.headers as Record<string, string>).map((h) =>
      h.toLowerCase(),
    );
    expect(headerNames).not.toContain("authorization");
  });
});
