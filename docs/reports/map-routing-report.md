# Walking routes and distance-to-parish — verification report

## What changed

- **`src/lib/routing.ts`** (new) — `fetchWalkingRoute(from, to, options)` calls
  OSRM's public foot-routing demo server, time-boxed with an `AbortController`
  (default 5s, overridable for tests), and falls back to a straight line plus
  `haversineMeters` distance on any failure, timeout, non-`Ok` response, or
  missing geometry. `formatDistance` (metres under 1km, one decimal km above)
  and `formatWalkingMinutes` are also exported. Duration is **never** taken
  from OSRM's `duration` field — it's always derived from `distanceMeters /
  WALK_SPEED_MPS` at a 5 km/h walking pace, with the reasoning in a comment.
- **`src/lib/routing.test.ts`** (new) — 9 tests: a routed result using OSRM's
  distance while ignoring its duration, straight-line fallback on rejected
  fetch / real abort-timeout / non-OK response / non-`Ok` OSRM code, and the
  two formatters.
- **`src/components/DioceseMapLive.tsx`** — draws a GeoJSON `LineString` layer
  per live parish (`route-line-<routeId>`) from the pilgrim's current
  `position` to that parish, styled with `var(--color-brand-accent)` read at
  runtime via the existing `resolveColor()` helper (MapLibre paint properties
  need a literal colour, not `var()`). A `direct` (fallback) route is drawn
  dashed so it reads visibly different from a real routed path. In-flight
  OSRM requests are invalidated by a `routeRequestRef` counter so a stale
  response from an old position can never overwrite a newer one. Also adds:
  a "Recentre on me" button (disabled, with a title/aria-label reason, when
  `position` is null) that `flyTo`s the user's coordinates; and a
  `dmap-live__panel` distance list, shown in **both** live and offline
  (`DioceseMap.tsx`) modes, since a straight-line distance needs no network.
  In live mode with a resolved route it shows "`<dist>` walk · `<time>`"
  (routed) or "`<dist>` direct (no route)" (fallback); offline it shows
  "`<dist>` direct · routing unavailable offline".
- **`src/index.css`** — `.dmap-live__recentre` and `.dmap-live__panel*` rules,
  all colours via `var(--color-brand-*)`/`color-mix()`, no literals. Text is
  14px (the panel is a secondary/small label, at the type floor); the
  recentre button and panel sit on the app's own near-opaque
  `--color-brand-text`/`--color-brand-bg` backgrounds against cream
  (`--color-brand-card`) text, matching the existing fallback badge's
  contrast approach.

`DioceseMap.tsx` itself was **not** touched — the fallback still renders it
unmodified; the distance panel is a sibling element added around it in
`DioceseMapLive.tsx`.

## 1. OSRM endpoint — actual response

Called directly against the two live parishes:

```
https://router.project-osrm.org/route/v1/foot/120.973456,14.637729;120.972648,14.651647?overview=full&geometries=geojson
```

Result: `code: "Ok"`, **`distance: 1850.5` m**, **82** geometry points,
`duration: 240.2` s. Matches the number quoted in the task (1850 m / 82
points) — this table confirms the number is real and current, not carried
over from the task description.

## 2. Computed walking duration

`WALK_SPEED_MPS = 5000 / 3600` (5 km/h). For the verified 1850.5 m route:

```
1850.5 / (5000/3600) / 60 ≈ 22.2 minutes
```

OSRM's own `duration` (240.2 s ≈ 4 min ≈ 28 km/h) is discarded entirely — it's
the server's default vehicle-profile speed, not corrected for the `foot`
profile requested. This is documented in a comment directly above
`WALK_SPEED_MPS` in `routing.ts` so a future reader isn't tempted to "fix" the
code by reading OSRM's duration back in.

## 3. Fallback path — forced failure, verified end-to-end

Ran `fetchWalkingRoute` (the real function, not a re-implementation) against
two induced failures, using a throwaway script deleted immediately after
(never committed):

- **Bad host** (`router.project-osrm.org` rewritten to a non-existent
  domain): failed in 45 ms → `{ kind: "direct", distance: 1.6 km, duration:
  18.6 min, points: 2 }`.
- **Forced timeout** (mock `fetch` that never resolves on its own but honours
  `AbortSignal`, `timeoutMs: 500`): aborted at 503 ms → same `direct` result.

Both produced a 2-point straight-line path and a distance/duration derived
the same way as a successful call — no error, no hang, no spinner. The unit
tests (`routing.test.ts`) additionally cover a rejected fetch, a non-OK HTTP
response, and a non-`Ok` OSRM `code`, all three tests using vitest's fake
timers/mocks so they run in milliseconds under `npm test`.

## 4. Simulator distances vs. `haversineMeters`

`PresenceContext.tsx`'s `simulatedPosition()` places the pilgrim at:

| Simulation | Position | → MHCP (14.637702, 120.97344) | → SRC (14.651647, 120.972648) |
|---|---|---|---|
| `approaching_mhcp` | `{ lat: mhcp.lat + 0.0027, lng: mhcp.lng }` | 300.23 m | 1253.29 m |
| `at_mhcp` | MHCP's own coordinates | 0.00 m | 1552.95 m |
| `at_src` | SRC's own coordinates | 1552.95 m | 0.00 m |

Computed independently with the same haversine formula `geo.ts` uses (hand
re-derivation, not a call into the app's own function, so it's an actual
cross-check rather than the function checking itself). The `dmap-live__panel`
distance shown for each live parish is `haversineMeters(position,
parish.coordinates)` fed through `formatDistance`, so these are exactly the
numbers that appear in the panel for each simulator state.

## 5. Recentre control — disabled state

```tsx
<button
  ...
  disabled={!position}
  title={position ? "Recentre the map on your position" : "Your position is unknown — enable GPS or the location simulator"}
  aria-label="Recentre map on my location"
>
```

`position` comes straight from `usePresence()`, which is `null` whenever the
simulator is `'off'` and real GPS hasn't granted a fix (or is denied) — see
`PresenceContext.tsx`. This could not be exercised through an automated
component test: `DioceseMapLive` constructs a real `maplibregl.Map`, which
needs a WebGL context and a module Worker that jsdom/vitest's environment
doesn't provide (the same constraint documented in
`live-diocese-map-report.md` and confirmed again here — MapLibre only ever
reaches `mode: "fallback"` under both jsdom and this environment's Browser
pane). Verified by code inspection instead: `disabled` and the `title`/
`aria-label` reason are driven directly off the same `position` value the
"you are here" marker and distance panel already use, so there's no separate
code path that could disagree with them.

## 6. "You are here" marker tracks position, not just first render

Unmodified from the existing code, confirmed by re-reading it: the marker
effect's dependency array is `[mode, position?.lat, position?.lng]`
(`DioceseMapLive.tsx`), not `[]` or `[mode]` alone, so every position update —
real GPS `watchPosition` ticks or a simulator switch in `PresenceContext.tsx`
— removes and redraws all markers, including "you are here". The simulator
bypasses the 10s dwell debounce (`FORCE_TRANSITION_AT` in `presence.ts`), so
switching simulator state moves the marker on the very next render, which is
what makes it usable for a live classroom demo.

## Test / typecheck results

```
npx tsc --noEmit    → exit 0, no output
npm test             → 7 test files, 53 passed (44 pre-existing + 9 new in routing.test.ts)
```

No console errors were introduced; `DioceseMapLive.tsx`'s existing
offline/error-detection paths (tile-host failure, MapLibre render-loop
exceptions, `window.offline`) were not touched.

## Bonus: distance panel confirmed live in the Browser pane

Per the task's own caveat, the Browser pane cannot render MapLibre (its
module worker is blocked in that sandbox), so the live map always falls back
to `DioceseMap.tsx` there. No claim is made about having seen a route line or
the recentre button rendered on screen — those are MapLibre-only UI, verified
instead by direct OSRM calls, targeted unit tests, a real forced-failure
script, and code inspection, as itemised above.

The **distance panel**, however, renders next to the SVG fallback regardless
of MapLibre, so it *was* exercised end-to-end through the running dev server
(`http://localhost:5173`) using the app's own "Location Simulator" (sidebar
→ Demo Tools):

- `Off`: both parishes show "Distance unknown" (`position` is `null`).
- `At San Roque Cathedral`: "Mary Help of Christians — 1.6 km direct ·
  routing unavailable offline" and "San Roque Cathedral — 0 m direct ·
  routing unavailable offline" — matches the hand-computed 1552.95 m / 0 m
  from item 4 above.
- `Approaching Mary Help of Christians`: "Mary Help of Christians — 300 m
  direct · routing unavailable offline" and "San Roque Cathedral — 1.3 km
  direct · routing unavailable offline" — matches the hand-computed 300.23 m
  / 1253.29 m from item 4 above.

Switching states also correctly triggered the existing "You are approaching…"
/ "You are near…" presence banner, confirming the simulator's position feeds
both the new distance panel and the app's pre-existing arrival detection
through the same `position` value. No console errors were logged in any of
these states (checked via the Browser pane's console reader).
