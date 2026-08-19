# Task 3 report: port the presence state machine

## Files added

- `src/lib/presence.ts`
- `src/lib/presence.test.ts`

## Source read

- `D:\SanctiWalk-Saved\app\src\lib\presence.js` (75 lines)
- `D:\SanctiWalk-Saved\app\src\lib\presence.test.js` (14 tests)

Neither file under `D:\SanctiWalk-Saved` was modified.

## Porting notes

- `churchId` → `parishId` throughout `PresenceState`, matching the plan's interface.
- The original imported `nearestLiveChurch` from `./geo` (which read bundled JSON). Here the
  parish list is threaded through as a fourth parameter to `nextPresence`. Since `geo.ts` does not
  yet export a `nearestLiveParish` (that lands in Task 4), `presence.ts` defines its own small,
  unexported `nearestLiveParish` helper local to the module — same behaviour (filters to
  `status === 'live'`, returns the minimum-distance match, `null` for a `null` position or no live
  parishes), built on `haversineMeters` from `./geo`. This keeps `presence.ts` self-contained and
  avoids reaching into Task 4's not-yet-written code.
- `rawMode` ported verbatim in logic: thresholds keyed off `prev.mode`/`prev.parishId` for the
  target parish (`wasPresentHere`, `wasApproachingHere`), producing the asymmetric hysteresis
  (enter present ≤100m / leave >150m; enter approaching ≤500m / leave >600m).
- Both `FORCE_TRANSITION_AT` comments preserved verbatim (module-level constant comment, and the
  `changedAt: now === FORCE_TRANSITION_AT ? 1 : now` guard comment in `nextPresence`).
- `nextPresence` takes `now` as an explicit parameter only — no internal clock read.
- No `any` anywhere in the exported surface; `GeoParish`, `PresenceState`, `PresenceMode` are all
  explicitly typed exports as specified in the plan.

## Test fixture

Replaced `getChurchById('church_001')` with the local `MHCP: GeoParish` constant and `PARISHES =
[MHCP]` array specified in the plan/task brief (`id: 'route-mhcp'`, `coordinates: { lat: 14.6305,
lng: 120.9711 }`, `geofenceRadius: 100`, `status: 'live'`).

Offset positions recomputed relative to `MHCP.coordinates`, same deltas as prescribed:
- `approaching`: `lat + 0.0027` (~300m north)
- 120m edge-of-present: `lat + 0.00108`
- 200m outside-present: `lat + 0.0018`
- 550m edge-of-approach: `lat + 0.00495`
- `far`: `{ lat: 14.9000, lng: 121.2000 }` (well outside the diocese, same as source)

All 14 tests ported with intent preserved: initial state, far→diocese, enter approaching, enter
present, distance recording, null position → diocese, 120m present stickiness, >150m present exit,
550m approaching stickiness, dwell-suppressed change, dwell-elapsed change, first-transition
exemption, distance-updates-while-suppressed, and the `now === 0` sentinel regression test. Every
call site updated to pass `PARISHES` as the fourth argument.

## Commands and output

```
$ npm test
✓ src/lib/geo.test.ts (3 tests)
✓ src/lib/presence.test.ts (14 tests)
Test Files  2 passed (2)
     Tests  17 passed (17)
```

```
$ ./node_modules/.bin/tsc --noEmit
(exit 0, no output)
```

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
200
```

## Deviations from the brief

None. `parishId` naming, fourth-argument signature, constant names, and both required comments
all match the brief exactly.

## Self-review

- Confirmed `nextPresence` reads `now` only from its parameter, never `Date.now()` or similar.
- Confirmed the hysteresis asymmetry is keyed off `prev.mode`/`prev.parishId`, not a fixed
  threshold — verified via the two stickiness tests (120m present, 550m approaching) plus the two
  "does leave" counterparts (200m present exit; note approaching's ">600m leaves" wasn't a
  separate ported test in the source, matching the original 14-test suite exactly).
- Confirmed the `now === 0` guard: `nextPresence(INITIAL_PRESENCE, at, 0, PARISHES)` transitions to
  present with `changedAt: 1` (not `0`), so the immediately following call at `now = 1` is correctly
  gated by the dwell window and stays in `present` rather than skipping the debounce.
- Ran the full suite after the change (not just the new file) — 17/17 passing, no regressions in
  `geo.test.ts`.
- Grepped `src/` to confirm no existing component, screen, Firebase, auth, or `firestore.rules`
  file was touched — only the two new files under `src/lib/` were added.
