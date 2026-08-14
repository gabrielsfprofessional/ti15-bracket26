# TI15 schedule-provider assessment

**Reviewed:** 2026-08-14  
**Decision:** keep the checked-in schedule as the production provider

Results and live detection remain automatic through OpenDota. Future schedule updates are managed
through `data/schedule.json`; the application must not claim fully automatic scheduling.

## Current provider

`lib/schedule.ts` adapts the checked-in file to a provider-neutral snapshot (`matches`, `streamUrl`,
and health metadata). The rest of the application does not import a third-party schedule shape.
The provider is always marked `managed`, its timestamps remain UTC ISO 8601, and manual overrides
continue to win after schedule merge.

Failure behavior is deliberately conservative: a missing, malformed, or regressing candidate is
rejected before it can replace the last-known-good snapshot. The file remains editable without
code changes and can represent known times with unknown opponents.

## Options reviewed

### Valve / Steam Web API

- **Ownership:** Valve/Steam.
- **Authentication and terms:** Valve's current Web API page says all use requires a Steam Web API
  key and acceptance of the Steam API Terms of Use.
- **Endpoint:** historical community documentation names
  `IDOTA2Match_570/GetScheduledLeagueGames/v1`, but current official Steam documentation does not
  list or support that Dota-specific method. Community wrappers mark it deprecated.
- **Rate limits/freshness/fields:** no current authoritative contract was found for the method.
- **Decision:** not sufficiently supported or stable for a live production dependency. An API key
  would also introduce a new secret and operational surface.

Sources: [Steam Web API documentation](https://steamcommunity.com/dev),
[Steamworks Web API overview](https://partner.steamgames.com/doc/webapi_overview).

### PandaScore fixtures API

- **Ownership:** PandaScore, a commercial esports data provider.
- **Endpoint:** `GET https://api.pandascore.co/dota2/matches/upcoming`; upcoming Dota 2 matches are
  available on all plans, including the free fixtures plan.
- **Authentication:** every REST request requires a private token. PandaScore explicitly warns not
  to expose it client-side; a server-side Vercel secret would be required.
- **Rate limit:** the schedules/results plan allows 1,000 REST requests per hour and reports
  remaining quota in `X-Rate-Limit-Remaining`.
- **Candidate mapping:** `scheduled_at` → `startUtc`; match format/number of games → `bestOf`;
  opponents → OpenDota team IDs through an explicit reviewed crosswalk; tournament/stage →
  `section`, `round`, and `roundLabel`; provider match ID → `scheduleId`; official stream URL →
  `streamUrl`.
- **Freshness:** PandaScore documents `scheduled_at` as the organizer-announced time, exposes
  reschedules, and provides a change/incidents feed. Fixtures updates track public live streams.
- **Failure behavior if later adopted:** timeout/rate-limit/schema/coverage failure must retain the
  checked-in schedule and mark schedule health degraded; it must never delete a checked-in row.
- **Manual dominance if later adopted:** provider rows would merge below `overrides.json`; manual
  time, matchup, status, or visibility corrections remain final.
- **Decision:** technically viable but not integrated now. The repository has no approved token,
  verified TI15 tournament identifier, or reviewed PandaScore↔OpenDota team-ID crosswalk. Adding
  it during a live tournament without those prerequisites risks duplicate or wrong matches.

Sources: [upcoming Dota 2 endpoint](https://developers.pandascore.co/reference/get_dota2_matches_upcoming),
[authentication](https://developers.pandascore.co/docs/authentication),
[rate limits](https://developers.pandascore.co/docs/rate-and-connections-limits),
[match lifecycle and rescheduling](https://developers.pandascore.co/docs/matches-lifecycle),
[plan reference](https://developers.pandascore.co/docs/plan-reference).

### OpenDota

OpenDota remains the approved source for completed league games and live detection. Its published
API exposes the league matches and global live feeds used here, but no supported future-schedule
resource suitable for TI15. It therefore cannot replace the managed schedule.

Source: [OpenDota API documentation](https://docs.opendota.com/).

## Reconsideration checklist

A remote schedule provider can be enabled only after all of the following are reviewed:

1. credentials and terms are approved;
2. the TI15 tournament/stage identifier is verified;
3. all 16 provider team IDs are mapped to OpenDota team IDs;
4. simultaneous matches, TBD opponents, reschedules, and best-of fields pass fixtures;
5. provider failure demonstrably preserves checked-in rows;
6. overrides remain dominant;
7. request caching and rate limits are documented and monitored.
