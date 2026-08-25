# Map fixes and walking directions

**Task:** fix four client-reported defects on the map screen ("View parish"
does nothing, search doesn't work, live location is wrong/missing, no get
directions), then add the one feature they asked for — walking directions
to a live parish from a map popup.

**Status:** done. `npm test` — **81 tests**, up from 70 (11 new). `tsc
--noEmit` exits 0, no output. No console errors observed on the map screen
across all the interactions exercised (see Verification).

---

## Defect 1 — "View parish is not clicking"

**Root cause confirmed as suspected.** `App.tsx`'s `handleOpenTourFromPresence`
set `activeTab` to `"navigator"` — the Map tab itself — and was reused,
unchanged, as the map popup's "View parish" click handler
(`DioceseMapLive.tsx:406`, via `CustomDioceseMap`). When that popup lives on
the map/`"navigator"` tab (`App.tsx`'s Map / Trail Station Navigator tab),
setting the active tab to the tab already active is a no-op: the handler
fires correctly, `setSelectedChurchId` runs, but nothing visibly changes.

**Fix.** Added a second handler, `handleSelectParish`
(`src/App.tsx`), that opens the parish's own profile — the `"home"` tab
(Dashboard, with Mass schedule/History/Ministries/Sacraments links) —
instead of the map tab. This exactly matches the pre-existing "Start
Sanctuary Walk" card button in the church-selector screen
(`src/App.tsx`, `selectedChurchId === null` branch), which already did
`setSelectedChurchId(route.id); setActiveTab("home")` for the identical
selection action, just via a different control.

The tab-selection decision was extracted into a small pure function,
`tabForParishSelection(source)` in `src/lib/parishSelection.ts`, so it can be
unit-tested without rendering the full `App` tree (which needs Firebase
auth/Firestore and a live MapLibre instance — neither is mocked in this
project's test setup). `source` is `'pin'` (map pin/popup, search result,
parish card) → `'home'`, or `'presence-open-tour'` (the presence sheet's own
"Open Tour" button) → `'navigator'`.

**The three other call sites, checked individually rather than blindly
repointed:**

| Call site | Old handler | New handler | Why |
|---|---|---|---|
| `App.tsx:640` (~621 before edits) — church-selector screen's own mini map, before any parish is selected | `handleOpenTourFromPresence` | `handleSelectParish` | Same screen's own "Start Sanctuary Walk" card button already goes to `"home"` for the identical action; the map pin now matches it instead of diverging from it. |
| `App.tsx` — Dashboard's embedded mini map (`onSelectParish` prop, passed down from `App.tsx`) | `handleOpenTourFromPresence` | `handleSelectParish` | Picking a different parish from Dashboard's own map should show that parish's profile, the same as Dashboard already is. |
| `App.tsx` — the Map tab's own `CustomDioceseMap` + the `ParishCard` list below it | `handleOpenTourFromPresence` | `handleSelectParish` | This is the literal site of the bug — the popup that lives on the tab `"navigator"` used to (no-op) target. |
| `PresenceSheet`'s "Open Tour" button (`App.tsx`, `<PresenceSheet onOpenTour={handleOpenTourFromPresence} .../>`) | `handleOpenTourFromPresence` | **unchanged** — still `handleOpenTourFromPresence` → `"navigator"` | This button is paired with the sheet's own "AR Tour" button (map icon vs. scan icon) and fires only while the pilgrim is already standing at the parish (`presence.mode === "present"`) — "show me the diocese map" is the one case where jumping to the map tab is genuinely the intended behaviour, not a bug. Left untouched, per the task's explicit warning not to blindly repoint the shared handler. |

**Test that would have caught this** — `src/lib/parishSelection.test.ts`:
asserts `tabForParishSelection('pin')` is `'home'` and explicitly asserts it
is **not** `'navigator'` (the exact old-code value that caused the no-op),
and that `tabForParishSelection('presence-open-tour')` stays `'navigator'`.

**Live-verified** on the running dev server (DOM/console, not screenshot —
see "What I could not verify"): navigated to the Map tab, confirmed
`.map-screen__title` reads "Diocese of Kalookan" (i.e. genuinely on the
`"navigator"` tab), clicked the San Roque Cathedral pin, clicked "View
parish" inside its popup, and confirmed `.map-screen__title` was gone and
the page now showed San Roque Cathedral Parish's Dashboard ("SAN ROQUE
CATHEDRAL PARISH", "TODAY", "NEXT MASS AT SAN ROQUE CATHEDRAL PARISH…").
Also verified the same flow from Dashboard's own embedded mini map.

---

## Defect 2 — "i cant search them"

**Investigated before changing anything**, per the task's instruction.

**The `mode === "fallback"` branch has no search bar at all** — confirmed
by reading `DioceseMapLive.tsx`; the fallback branch renders only
`<DioceseMap>` (the offline SVG) and the distance panel, no search UI. But
this is almost certainly not what the client hit: they also report a "View
parish" click that fires but goes nowhere (defect 1), and "View parish" only
exists inside a live-map popup — the fallback map has no popups either. So
the client is on the live map, not the fallback.

**The search bar itself works mechanically** — verified live on the dev
server: focused `.dmap-search__input`, dispatched real `input` events, and
got real filtered results back (`.dmap-search__input`'s z-index (6) sits
above the MapLibre canvas/controls without being clipped by `.dmap-live`'s
`overflow: hidden`, since it's a sibling of the canvas container inside the
same positioned ancestor, not a descendant of it). Typing and focus were not
the problem.

**The actual defect: search matched a parish's `vicariate`, not just its
`name`, and that mismatch practically broke search for real use.**
`SEARCHABLE_PARISHES` built `location: parish.vicariate` and
`mapSearch.ts`'s `searchParishes` matched a query against
`name + ' ' + location`. Two compounding problems:

1. **Vicariate is unverified data presented as fact.** Every one of the 31
   parishes in `diocese-parishes.json` carries `vicariateVerified: false` —
   vicariate assignments were inferred by nearest vicariate seat, not
   sourced from the diocese. Matching search against it meant a guess could
   silently surface a parish and make it look like matching data.
2. **Results are capped at `MAX_SEARCH_RESULTS` (6) and kept in input
   order, not ranked.** A real name match could be — and, tested live, was
   — crowded out of the visible 6 by earlier-indexed parishes that only
   matched by vicariate. E.g. searching "san" surfaced "Exaltation of the
   Holy Cross" and "Immaculate Conception" (both in "Vicariate of San Jose
   de Navotas") ahead of actual "San …"-named parishes purely because of
   array order — a pilgrim searching for a specific "San …" parish by name
   could easily see it pushed off the visible list by unrelated parishes
   that only shared a vicariate.

**Fix.** `searchParishes` (`src/lib/mapSearch.ts`) now matches the parish
**name only**. `DioceseMapLive.tsx` still shows the vicariate as a secondary
line (both in search results and in the popup card) — genuinely known data
isn't hidden — but now suffixed via a new `vicariateLabel()` helper as
`"{vicariate} (unconfirmed)"`, matching the codebase's existing
`scheduleVerified`/`coordinatesVerified` pattern ("(sample, unconfirmed)" in
`ParishCard.tsx`/`MassSchedule.tsx`/`PresenceSheet.tsx`) — unverified data is
shown, never asserted as fact.

**Tests** — `src/lib/mapSearch.test.ts`: rewrote the two tests that
depended on location-matching (`'matches a substring of the location'` →
`'does not match on location — vicariate is unverified data'`, asserting
`searchParishes('vicariate', …)` is `[]` even though every test fixture's
location contains "Vicariate"; `'preserves input order among matches'`
updated to a name-only query). All 8 tests in the file pass.

**Live-verified**: typed "sacred" into the running app's search box — got
exactly the two parishes whose *name* contains "sacred" ("Sacred Heart of
Jesus Parish (Morning Breeze)", "Sacred Heart of Jesus Parish Tugatog"),
each showing its vicariate suffixed "(unconfirmed)" — not the wider list of
unrelated parishes that merely share "Vicariate of Sacred Heart".

---

## Defect 3 — "i dont have live location exactly where i am"

**Investigated `PresenceContext.tsx` and `geo.ts`.** Three things checked,
one real gap found and fixed, two already correct:

1. **Simulator precedence — already correct, but not visibly labelled.**
   The simulator defaults to `'off'` (`useState<SimulationValue>('off')`),
   and the real-GPS effect only runs `if (simulation !== 'off') return` —
   real GPS is used automatically and cannot be silently overridden by a
   stale simulated position; the two effects are mutually exclusive on
   `simulation`. This part was already sound. **What was missing**: nothing
   on the map screen itself said a simulation was active — only opening the
   "Location Simulator" panel showed it. A demo position left on could be
   mistaken for a real "wrong" GPS fix with no visible explanation. **Fixed**
   by adding an always-visible "Simulated location" badge on the live map
   (`.dmap-live__position-badge--sim`) whenever `simulation !== 'off'`, and
   an explicit "Accuracy: Simulated — not a real fix" row in the simulator
   panel's own readout (previously the panel showed Mode/Parish/Distance/GPS
   Status/Position but never called out that a simulated position isn't a
   real fix).

2. **`watchPosition` options — already sound.** `enableHighAccuracy: true`,
   `maximumAge: 5000` (a cached fix is reused only if under 5 seconds old —
   nowhere near "an hour ago" stale), `timeout: 15000`. No change needed;
   added an explanatory comment in place so this isn't re-litigated later.

3. **Accuracy — the real, concrete bug.** `GeolocationCoordinates.accuracy`
   (the browser's own reported error radius) was read from `watchPosition`'s
   callback and then **discarded** — `position` only ever carried
   `{lat, lng}`. The you-are-here dot was drawn with no indication of how
   trustworthy it was. On desktop, wifi-based geolocation is routinely only
   accurate to within a few hundred metres — there's no code fix for that,
   only being honest about it instead of asserting a precise dot. **Fixed**:
   `PresenceContext` now tracks `accuracyMeters: number | null` alongside
   `position`, set from `p.coords.accuracy` on every real fix, and reset to
   `null` whenever the position isn't a real, current GPS fix (denied,
   unavailable, or a simulation engaged — a fabricated position must never
   carry a real accuracy figure). Surfaced in three places: the live map's
   new position/accuracy badge ("Accurate to ±N m" or "Simulated location"),
   the recentre button's tooltip, and the simulator panel's Live Readout.

4. **You-are-here marker projection — checked, not a bug.** The live map
   places both parish pins and the you-are-here marker via MapLibre's own
   `Marker.setLngLat([lng, lat])` — the same projection for both, so no
   mismatch is possible there. The offline SVG fallback (`DioceseMap.tsx`)
   places both via the same `projectToMap()` call (`src/lib/project.ts`) —
   also consistent. No change needed.

**Live-verified**: opened the Location Simulator, selected "Approaching Mary
Help of Christians", confirmed the readout showed "Accuracy: Simulated — not
a real fix"; closed the panel, navigated to the Map tab, confirmed a
"Simulated location" badge appeared over the map. (A real-GPS accuracy
reading could not be exercised live — this environment's headless browser
has no real GPS hardware to report an `accuracy` value from — so that path
is covered by the unit tests below instead; see "What I could not verify".)

**Tests** — `src/context/PresenceContext.accuracy.test.tsx` (4 new tests):
a real fix's `accuracy` reaches the context; `accuracyMeters` clears to
`null` on GPS denial; a simulated position never carries a stale real
accuracy figure, even right after a real fix; turning the simulator off
drops the simulated position (and its absent accuracy) until a real fix
arrives.

---

## Feature — "Get directions"

Wired `src/lib/routing.ts`'s existing `fetchWalkingRoute` (OSRM foot
profile, public server, distance-only trusted — `duration` is never used,
per the file's own documented reasoning) into the map popup.

**What changed:**

- `src/lib/mapMarkers.ts` — `buildPopupContent()` now returns
  `directionsAction` (a "Get directions" button) and `directionsStatus` (an
  initially-empty status paragraph the caller updates in place), alongside
  the existing "View parish" `action` — live parishes only; a coming-soon
  parish's popup is unchanged (no action buttons at all).
- `src/lib/routing.ts` — added a new pure function, `getWalkingDirections(
from, to, options)`, extracted the same way `mapSearch`/`mapMarkers` were:
  returns `{status: 'no-position'}` when `from` is `null`, or `{status: 'ok',
  route, label}` with the same distance/time label logic the existing
  distance panel already used (`"{distance} walk · {time}"` for a routed
  result, `"{distance} direct (straight-line — walking route unavailable)"`
  for OSRM failure — never a bare distance presented as if it were a walking
  route). `DioceseMapLive.tsx`'s click handler calls this and handles
  everything the pure function can't express: reading the pilgrim's
  *current* position at click time (not whatever it was when the popup was
  built), drawing/updating the route layer, fitting the camera to it, and
  request supersession.
- `src/components/DioceseMapLive.tsx` — `getDirectionsFor()`, wired to each
  live pin's "Get directions" button:
  - **No known position**: status line reads "Your position is unknown —
    enable GPS or the location simulator to get directions." — never a
    silent failure or a spinner that never resolves.
  - **OSRM unreachable/times out**: falls through `fetchWalkingRoute`'s
    existing straight-line fallback; status line reads "{distance} direct
    (straight-line — walking route unavailable)" — never presented as a
    walking route or a walking time.
  - **Success**: draws the route on the map (reusing the existing
    `upsertRouteLayer`, so the same line also feeds the always-on distance
    panel), fits the camera to the route's bounds, and shows
    "{distance} walk · {time}" using `WALK_SPEED_MPS`, never OSRM's own
    `duration`.
  - **Clearing a route when another is requested**: a dedicated
    `directionsRequestRef` counter (mirroring the existing `routeRequestRef`
    pattern used for the passive per-position auto-routing effect) is
    incremented on every "Get directions" click; a response is applied only
    if it's still the newest outstanding request, so an in-flight request
    for one parish is cleanly superseded by a newer request — for the same
    parish (re-click) or a different one — rather than racing it.

**Tests** — `src/lib/routing.test.ts` (3 new tests on `getWalkingDirections`):
`no-position` result with no network call attempted when `from` is `null`;
a successful routed result labelled with distance + `WALK_SPEED_MPS`-derived
time (asserted equal to `"1.9 km walk · 22 min walk"` for the same
MHCP→SRC fixture the existing `fetchWalkingRoute` tests use); an OSRM
failure (`fetchImpl` rejects) falls back to a direct result whose label
contains "direct" and "straight-line" and never contains "walk ·".
`src/lib/mapMarkers.test.ts` (1 new test, 1 updated): a live parish's popup
now also gets a real `<button>` "Get directions" action and an
initially-empty status paragraph; the coming-soon test now also asserts
`directionsAction`/`directionsStatus` are both `null`.

**Live-verified** on the running dev server: opened Mary Help of Christians'
popup with no position known — clicking "Get directions" showed the
no-position message, button never became stuck disabled. Set the location
simulator to "Approaching Mary Help of Christians", reopened the popup,
clicked "Get directions" — status immediately read "Finding a route…" (and
the button was disabled during the fetch), then resolved to "325 m walk · 4
min walk" from the real OSRM demo server. No console errors at any point in
this flow.

Not separately exercised live: the exact request-supersession race
(clicking directions for parish B before parish A's in-flight fetch
resolves) — real network round-trips were too fast in this environment to
reliably force that race by hand; it's covered by code review (the counter
pattern is identical to the codebase's own pre-existing
`routeRequestRef`) rather than a dedicated test, since faking the race
would need injecting a fake `fetchImpl` into `DioceseMapLive.tsx` itself,
which doesn't currently accept one (only `getWalkingDirections`/
`fetchWalkingRoute` do, and those are covered directly).

---

## Verification

**`npm test`**
```
Test Files  11 passed (11)
     Tests  81 passed (81)
```
Up from 70 by 11: 3 in `parishSelection.test.ts` (new), 4 in
`PresenceContext.accuracy.test.tsx` (new), 3 in `routing.test.ts`
(`getWalkingDirections`), 1 in `mapMarkers.test.ts` (`directionsAction`/
`directionsStatus`); `mapSearch.test.ts` stayed at 8 (two rewritten, not
added).

**`./node_modules/.bin/tsc --noEmit`** — exits 0, no output.

**Console** — checked after every interaction exercised above (page load,
tab switches, search, popup opens, "View parish", "Get directions",
simulator panel) via `read_console_messages({onlyErrors: true})`: no errors
at any point.

**Type floor** — `grep -oE "font-size:\s*[0-9.]+px" src/index.css | sort -u`
→ `14px, 15px, 16px, 18px, 21px, 22px` only; also grepped touched files for
`text-[Npx]` Tailwind arbitrary sizes under 14px — none found. All new UI
text (the position/accuracy badge, the directions status line, the
"(unconfirmed)" vicariate suffix) uses existing 14px/15px/16px classes.

**Colour literals outside `index.css`** — grepped every touched file
(`App.tsx`, `PresenceContext.tsx`, `DioceseMapLive.tsx`,
`SimulatorPanel.tsx`, `mapSearch.ts`, `mapMarkers.ts`, `routing.ts`,
`parishSelection.ts`) for hex literals. Every hit outside `index.css` is
pre-existing: `App.tsx`'s and `SimulatorPanel.tsx`'s Tailwind arbitrary-value
classes (`bg-[#5A5A40]`, `text-[#5FC7DE]`, etc. — bridged to brand tokens
via `index.css`'s "DYNAMIC COLOR BRIDGING OVERRIDES" section, unchanged by
this task, documented in the prior map-prototype-design-swap report) and
`DioceseMapLive.tsx:147`'s `resolveColor()` JS fallback (`"#151B53"`,
pre-existing, a failure-path default never itself drawn — the CSS variable
it stands in for already resolves to the same navy). No new hex literals
were introduced by this task's changes.

### What I could not verify

Per this environment's known limitation (documented in
`docs/reports/map-prototype-design-swap.md`): **the Browser pane's WebGL
context initializes but never paints** — the map canvas cannot be verified
by screenshot. Everything above that needed the actual rendered map was
instead checked through the DOM, console, and accessibility tree of the
*real* running MapLibre instance (not a mock), or through unit tests against
extracted pure functions. Specifically not verified visually, worth checking
by hand on a real device:

- The "View parish" / "Get directions" buttons' and the new position/
  accuracy badge's actual on-screen layout, spacing, and readability against
  the live basemap.
- The drawn walking-route line's on-screen appearance when "Get directions"
  is used, and whether the `fitBounds` camera move reads well in practice.
- A **real GPS accuracy reading** end to end — this headless environment has
  no real GPS hardware, so `p.coords.accuracy` was only exercised via a
  mocked `watchPosition` callback in `PresenceContext.accuracy.test.tsx`,
  not from an actual device fix. The simulated-position path (badge reads
  "Simulated location", panel reads "Simulated — not a real fix") *was*
  verified live, since it doesn't depend on real hardware.
- OSRM's failure path in the live app specifically for "Get directions" (as
  opposed to `getWalkingDirections`'s own unit tests, which mock the
  network directly) — reaching a live OSRM outage on demand isn't
  reproducible in this environment; the fallback logic itself is identical
  code to the already-existing, already-verified `fetchWalkingRoute`
  fallback the distance panel has relied on since the prior map task.
- The request-supersession race for "Get directions" under real network
  timing (see the note above).
- Touch-target comfort and visual balance of the new secondary "Get
  directions" button and status line inside the existing 220px-max-width
  popup card on an actual phone screen.

## Files touched

- `src/App.tsx` — `handleSelectParish` (new), `tabForParishSelection` wiring
  for both handlers, three call sites repointed (church-selector mini map,
  Dashboard's mini map, the Map tab's own map + parish card list), presence
  sheet's handler left unchanged
- `src/lib/parishSelection.ts` (new), `src/lib/parishSelection.test.ts` (new)
- `src/lib/mapSearch.ts` — name-only matching
- `src/lib/mapSearch.test.ts` — two tests rewritten for name-only matching
- `src/lib/mapMarkers.ts` — `directionsAction`/`directionsStatus` added to
  `buildPopupContent()`
- `src/lib/mapMarkers.test.ts` — one test added, one updated
- `src/lib/routing.ts` — `getWalkingDirections()` (new, pure)
- `src/lib/routing.test.ts` — three new tests
- `src/components/DioceseMapLive.tsx` — `vicariateLabel()`, "Get directions"
  wiring, position/accuracy badge, recentre tooltip update
- `src/context/PresenceContext.tsx` — `accuracyMeters` tracked and exposed,
  cleared on denial/unavailable/simulation, documented GPS options
- `src/context/PresenceContext.accuracy.test.tsx` (new)
- `src/components/SimulatorPanel.tsx` — accuracy row in the Live Readout
- `src/index.css` — `.dmap-live__position-badge`(`--sim`),
  `.dmap-card__action--secondary`, `.dmap-card__directions-status`
- `PROJECT-STATE.md`
- `docs/reports/map-fixes-and-directions.md` (this file)

Not touched: rosary, Firebase, auth, `firestore.rules`, `DioceseMap.tsx`
(offline fallback — unchanged, no search/directions there by design, per the
task), `mapMarkers.ts`'s pin-building function, the scope polygon/legend,
zoom control, recentre-on-me's core behaviour (only its tooltip text
changed).
