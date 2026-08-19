# Task 5 report: port the map projection

## Commands and output

```
$ npm test
✓ src/lib/geo.test.ts (7 tests)
✓ src/lib/presence.test.ts (14 tests)
✓ src/lib/project.test.ts (6 tests)
Test Files  3 passed (3)
     Tests  27 passed (27)

$ ./node_modules/.bin/tsc --noEmit
(exit 0, no output)

$ curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
200
```

## Files added

- `src/lib/project.ts` — `DIOCESE_BOUNDS`, `MapBounds`, `MapPoint`, `projectToMap(coords, bounds, width, height)`.
  Ported unchanged from `D:\SanctiWalk-Saved\app\src\lib\project.js`, converted to TypeScript. `coords` is typed
  `Coordinates | null | undefined` using the existing `Coordinates` type from `src/lib/geo.ts`; return type is
  `MapPoint | null`. No `any`.
- `src/lib/project.test.ts` — ported unchanged from `project.test.js`, 6 tests, except the final test's fixture.

## Fixture change

The source test's final case ("places both live parishes inside the frame") used the old SanctiWalk app's
coordinates (`{ lat: 14.6497, lng: 120.9722 }` for MHC and `{ lat: 14.6510, lng: 120.9686 }` for SRC). Per the
task, these were replaced with the Task-4 coordinates from `src/data.ts`:

- `route-mhcp` (Mary Help of Christians): `{ lat: 14.6305, lng: 120.9711 }`
- `route-src` (San Roque Cathedral): `{ lat: 14.6510, lng: 120.9686 }`

Both project inside the 300x400 frame (see below), so the test remains meaningful and was not weakened.

## Projected coordinates at 300x400

Using `DIOCESE_BOUNDS = { latMin: 14.610, latMax: 14.700, lngMin: 120.925, lngMax: 121.000 }`:

| Parish | lat, lng | x | y |
|---|---|---|---|
| route-mhcp (Mary Help of Christians) | 14.6305, 120.9711 | 184.4 | 308.9 |
| route-src (San Roque Cathedral) | 14.6510, 120.9686 | 174.4 | 217.8 |

Both fall strictly inside `0 < x < 300` and `0 < y < 400` — no widening of bounds was needed.

## Notes / deviations

- The projection is linear equirectangular, ported unchanged, as instructed — not upgraded to a real
  projection. At this ~10km scale the distortion is far below the width of a map pin.
- No existing component, screen, Firebase, auth, or `firestore.rules` file was touched.
- Did not stage or commit the rosary-related files present in `git status` (`public/rosary/index.html`,
  `src/components/RosarySettingsModal.tsx`, `src/lib/rosarySettings.ts`, `public/rosary/music/`) — these belong
  to a concurrent agent's work and were left untouched.

## Commit

`fe119bc` — "feat: port geographic map projection" — 2 files changed, 91 insertions(+):
`src/lib/project.ts`, `src/lib/project.test.ts`.
