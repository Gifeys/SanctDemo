# Task 4 Report — Give parishes real geography

## Status: DONE

## Files touched

- `src/types.ts` — extended `Route` with `coordinates`, `coordinatesVerified`, `geofenceRadius`, `status` (see deviation note below).
- `src/data.ts` — populated the four new fields on both `route-mhcp` and `route-src`. No existing fields reordered or reformatted; the new fields were inserted as a contiguous block right before each route's `stations` array.
- `src/lib/geo.ts` — added exported `nearestLiveParish(pos, parishes)`, importing `type { GeoParish } from './presence'` (type-only import, erased at compile time, so the geo↔presence circular reference never exists at runtime).
- `src/lib/geo.test.ts` — added a `nearestLiveParish` describe block with the four required assertions.

## Data added (exact values, per plan)

`route-mhcp` (Mary Help of Christians, Maypajo):
```ts
coordinates: { lat: 14.6305, lng: 120.9711 },
coordinatesVerified: false,
geofenceRadius: 100,
status: "live",
```
Verified this matches the route's own first station (`mhcp-altar`, line 264 of `src/data.ts` pre-edit) exactly, as the plan specifies.

`route-src` (San Roque Cathedral, A. Mabini St):
```ts
coordinates: { lat: 14.6510, lng: 120.9686 },
coordinatesVerified: false,
geofenceRadius: 100,
status: "live",
```
Both approximations left untouched — no lookup or "correction" attempted.

## TDD sequence (commands + output)

1. Added the four `nearestLiveParish` tests to `src/lib/geo.test.ts` (importing a not-yet-exported `nearestLiveParish` from `./geo`) before touching `geo.ts`.
2. `npm test -- src/lib/geo.test.ts` → **FAIL as expected**: `TypeError: (0 , nearestLiveParish) is not a function` on all 4 new tests; the 3 pre-existing `haversineMeters` tests still passed (3 passed / 4 failed, 7 total).
3. Implemented `nearestLiveParish` in `src/lib/geo.ts` (filter to `status === 'live'`, then minimum `haversineMeters` distance — same logic already used by `presence.ts`'s local helper).
4. `npm test` → **21 passing** (7 in `geo.test.ts` + 14 in `presence.test.ts`). Confirmed exact match to the exit criterion "17 + 4 new = 21".

## `presence.ts`'s local helper — decision

**Left it alone; did not change `presence.ts`.** `presence.ts` still has its own unexported `nearestLiveParish` function (identical logic — filter live, pick nearest). I deliberately did not import the newly-exported `geo.ts` version into `presence.ts` because:

- The task instructions explicitly say "Do not change `presence.ts` behaviour either way — its 14 tests must still pass unmodified," and the safest way to guarantee zero behavioural drift in a load-bearing state machine is to not touch the file at all.
- Task 4's stated file list is `types.ts`, `data.ts`, `geo.ts`, `geo.test.ts` — `presence.ts` is not listed.
- The two implementations are now byte-for-byte equivalent logic, so there is no correctness risk from the duplication, only a minor DRY nit. Consolidating them is a one-line, low-risk cleanup that belongs in a dedicated follow-up (or Task 6, when `presence.ts`'s tests are next touched) rather than inside a task whose diff is supposed to stay reviewable as "types, data and one lib file."

I verified `presence.test.ts`'s 14 tests still pass unmodified (see above), and `presence.ts`'s file content is untouched (confirmed via `git diff --stat`, see below).

## Deviation from the plan: `Route`'s new fields made optional, not required

The plan's Step 1 shows the four new `Route` fields without `?`. Adding them as **required** broke typecheck outside the four files Task 4 is scoped to touch:

```
src/components/CompanionTab.tsx(59,13): error TS2739: Type '{ id: string; name: any; ... }' is missing the following properties from type 'Route': coordinates, coordinatesVerified, geofenceRadius, status
```

`CompanionTab.tsx` builds an AI-generated "custom walk" `Route` object at runtime (an on-the-fly itinerary, not one of the two real parishes) and does not set these fields. The task's explicit constraint is "Touch no existing component ... This task changes types, data and one lib file," which rules out editing `CompanionTab.tsx` to satisfy a required field. Making the four new fields **optional** (`coordinates?`, `coordinatesVerified?`, `geofenceRadius?`, `status?`) resolves the conflict without touching any component: both real parishes in `data.ts` still populate all four fields concretely, `nearestLiveParish` and `GeoParish` are unaffected (they take `GeoParish`, a separate, fully-required interface from `presence.ts`, not `Route` itself), and the custom-walk object continues to compile as before.

This is a deliberate interpretation, not a silent workaround — flagging it per "if the plan looks internally inconsistent, report ... rather than adjusting expectations." I judged this the smaller inconsistency to resolve myself (a type-optionality choice, not a test-weakening), since the alternative was editing a component the task explicitly forbids touching. Happy to revisit if the human partner prefers required fields plus a `CompanionTab.tsx` fix instead.

## Verification

```
$ npm test
✓ src/lib/presence.test.ts (14 tests)
✓ src/lib/geo.test.ts (7 tests)
Test Files  2 passed (2)
     Tests  21 passed (21)
```

```
$ ./node_modules/.bin/tsc --noEmit
EXIT:0
```

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
200
```

App renders confirmed via Browser pane against the running dev server (no restart):
- Church-selection screen: both parish cards render (`Mary Help of Christians Parish Guide` / `Maypajo, Caloocan City`, `San Roque Cathedral Parish Tour` / `A. Mabini St, Caloocan City`).
- Opened MHCP → Home tab renders normally (Pilgrimage Scanner, Explore grid, bottom nav).
- Opened MHCP → Walk tab (`MapTab`, which spreads/iterates `Route`/`Station` fields) renders normally: GPS SIM readout, Sancti Trail Visualizer with 3 stops, "Current Station 1 of 3".
- `read_console_messages({ onlyErrors: true })` returned **no console errors** on either screen.

## Commit

```
git add -A && git commit -m "feat: add parish-level geography to routes"
```
SHA: see final report to caller.
