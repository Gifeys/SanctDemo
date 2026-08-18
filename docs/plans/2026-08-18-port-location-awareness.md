# Porting Location Awareness into SanctDemo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give SanctDemo the ability to detect which parish the user is standing at and reshape itself accordingly — the thesis's central claim — without disturbing any existing screen.

**Architecture:** Four pure logic modules are ported from a separate React app (`D:\SanctiWalk-Saved\app\src\lib`) into TypeScript, keeping their tests. A React context wraps them and feeds either the real Geolocation API or a visible classroom simulator. The existing UI consumes presence through one hook; no current component is rewritten.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind 4, Firebase. Vitest is added by Task 1 — this repo currently has no test runner.

## Source of the port

The modules being ported already exist and are covered by 40 passing tests:

| Source file | Lines | Tests | Ported to |
|---|---|---|---|
| `D:\SanctiWalk-Saved\app\src\lib\geo.js` | 33 | 6 | `src/lib/geo.ts` |
| `D:\SanctiWalk-Saved\app\src\lib\presence.js` | 75 | 14 | `src/lib/presence.ts` |
| `D:\SanctiWalk-Saved\app\src\lib\project.js` | 24 | 6 | `src/lib/project.ts` |
| `D:\SanctiWalk-Saved\app\src\lib\schedule.js` | 50 | 12 | `src/lib/schedule.ts` |
| `D:\SanctiWalk-Saved\app\src\context\LocationContext.jsx` | — | 3 | `src/context/PresenceContext.tsx` |

Read each source file directly. Do not reinvent the logic — it has been reviewed and its edge cases are already covered by the tests you are porting alongside it.

## Global Constraints

- **The existing app must keep working.** Do not restyle, restructure, or rename any current component, tab, or route. This plan is additive.
- **TypeScript, strict about the domain types.** No `any` on ported functions; every exported function carries an explicit signature.
- **Colours come from the existing CSS variables** in `src/index.css` (`--color-brand-primary`, `--color-brand-accent`, `--color-brand-card`, `--color-brand-text`, `--color-brand-bg`, `--color-brand-border`). Never hardcode a hex in new code.
- **Tailwind for layout**, matching how the rest of the app is written. Do not introduce a competing CSS system.
- **Geofence constants are fixed:** enter Present at <= `geofenceRadius` (100m), leave at > `geofenceRadius x 1.5`. Enter Approaching at <= 500m, leave at > 600m. Minimum dwell between mode changes 10000ms. `FORCE_TRANSITION_AT = 0` is documented contract: a `changedAt` of exactly 0 always clears the dwell gate, which is how the simulator responds instantly.
- **`nextPresence` never reads the clock.** `now` is always an explicit parameter. This is what makes the debounce testable.
- **No new Firestore reads or writes.** Presence is entirely client-side.
- **Do not weaken a ported test to make an implementation pass.** The tests encode reviewed behaviour. If a test fails, fix the implementation, or report BLOCKED with the failing output.

---

### Task 1: Add a test runner

This repo has no tests. Everything after this task depends on being able to run them.

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.ts`
- Create: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs Vitest against `src/**/*.test.ts`

- [ ] **Step 1: Install the runner**

```bash
npm install -D vitest@^3 jsdom @testing-library/react @testing-library/jest-dom
```

If `node_modules` is absent, run `npm install` first. The repo has a `bun.lock`; npm is still fine, but do not delete `bun.lock`.

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write a smoke test**

Create `src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('test runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 5: Confirm the app still typechecks**

Run: `npx tsc --noEmit`
Expected: no new errors. If the repo already has pre-existing type errors, record them in your report as a baseline so later tasks can tell new breakage from old.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: add Vitest test runner"
```

---

### Task 2: Port the distance maths

**Files:**
- Create: `src/lib/geo.ts`, `src/lib/geo.test.ts`
- Delete: `src/lib/smoke.test.ts` (replaced by real tests)

**Interfaces:**
- Produces:
  - `export interface Coordinates { lat: number; lng: number }`
  - `haversineMeters(a: Coordinates, b: Coordinates): number`
  - `nearestLiveParish` arrives in Task 4, once parishes carry coordinates. Export only `haversineMeters` here.

- [ ] **Step 1: Read the source**

Read `D:\SanctiWalk-Saved\app\src\lib\geo.js` and `D:\SanctiWalk-Saved\app\src\lib\geo.test.js`.

- [ ] **Step 2: Port the tests first**

Create `src/lib/geo.test.ts` containing only the three `haversineMeters` tests from the source test file: same-point is exactly 0, a 0.001 degree latitude step measures between 105m and 117m, and the function is symmetric. Convert to TypeScript. Leave out the `nearestLiveChurch` tests — that function arrives in Task 4.

- [ ] **Step 3: Run to verify failure**

Run: `npm test src/lib/geo.test.ts`
Expected: FAIL — cannot resolve `./geo`.

- [ ] **Step 4: Port the implementation**

Create `src/lib/geo.ts` from the source, adding types:

```ts
export interface Coordinates {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6371000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}
```

- [ ] **Step 5: Verify and clean up**

Run: `npm test` — expect 3 passing. Delete `src/lib/smoke.test.ts` and run again to confirm 3 passing.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: port haversine distance calculation"
```

---

### Task 3: Port the presence state machine

The load-bearing module. It converts a position into one of three modes, with sticky boundaries so the UI cannot flicker.

**Files:**
- Create: `src/lib/presence.ts`, `src/lib/presence.test.ts`

**Interfaces:**
- Consumes: `Coordinates` (Task 2)
- Produces:
  - `export type PresenceMode = 'diocese' | 'approaching' | 'present'`
  - `export interface GeoParish { id: string; coordinates: Coordinates; geofenceRadius: number; status: 'live' | 'coming_soon' }`
  - `export interface PresenceState { mode: PresenceMode; parishId: string | null; distance: number | null; changedAt: number }`
  - `INITIAL_PRESENCE`, `nextPresence`, and the constants `APPROACH_ENTER_M`, `APPROACH_LEAVE_M`, `PRESENT_LEAVE_FACTOR`, `MIN_DWELL_MS`, `FORCE_TRANSITION_AT`

**Important difference from the source.** In the original, `nextPresence` called `nearestLiveChurch()` internally, which read a bundled JSON module. Here the parish list is passed in as a fourth parameter so the function stays pure and testable without importing app data:

```ts
export function nextPresence(
  prev: PresenceState,
  pos: Coordinates | null,
  now: number,
  parishes: GeoParish[],
): PresenceState
```

- [ ] **Step 1: Read the source**

Read `D:\SanctiWalk-Saved\app\src\lib\presence.js` and its 14 tests in `presence.test.js`. Note especially the `rawMode` helper, which decides thresholds using the *previous* mode — that asymmetry is the hysteresis and must be preserved exactly.

- [ ] **Step 2: Port the tests**

Port all 14 tests to `src/lib/presence.test.ts`. Replace the source's `getChurchById('church_001')` fixture with a local constant so the tests do not depend on app data:

```ts
const MHCP: GeoParish = {
  id: 'route-mhcp',
  coordinates: { lat: 14.6305, lng: 120.9711 },
  geofenceRadius: 100,
  status: 'live',
}
const PARISHES = [MHCP]
```

Recompute the offset positions relative to these coordinates, keeping the same intent: approaching about 300m north (`lat + 0.0027`), edge-of-present about 120m north (`lat + 0.00108`), outside-present about 200m north (`lat + 0.0018`), edge-of-approach about 550m north (`lat + 0.00495`), and a far position well outside the diocese.

Keep every assertion's intent identical: mode transitions, the 120m and 550m stickiness cases, dwell-debounce suppression, the first-transition exemption, distance continuing to update while a mode change is suppressed, and the `now === 0` regression test.

- [ ] **Step 3: Run to verify failure**

Run: `npm test src/lib/presence.test.ts`
Expected: FAIL — cannot resolve `./presence`.

- [ ] **Step 4: Port the implementation**

Port `presence.js` verbatim in behaviour, with types added and the parish list threaded through instead of imported. Keep the two comments explaining `FORCE_TRANSITION_AT` and the `now === 0` guard — they document contract a later reader will otherwise remove.

- [ ] **Step 5: Verify**

Run: `npm test` — expect 17 passing (3 + 14).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: port presence state machine with hysteresis and dwell debounce"
```

---

### Task 4: Give parishes real geography

SanctDemo's `Route` is a parish, but carries only a `location` string. Presence needs coordinates.

**Files:**
- Modify: `src/types.ts` (extend `Route`)
- Modify: `src/data.ts` (add the new fields to both routes)
- Modify: `src/lib/geo.ts` (add `nearestLiveParish`)
- Modify: `src/lib/geo.test.ts` (add its tests)

**Interfaces:**
- Produces: `nearestLiveParish(pos: Coordinates | null, parishes: GeoParish[]): { parish: GeoParish; distance: number } | null`

- [ ] **Step 1: Extend the Route type**

In `src/types.ts`, add to `Route`:

```ts
  coordinates: { lat: number; lng: number };
  coordinatesVerified: boolean;
  geofenceRadius: number;
  status: "live" | "coming_soon";
```

- [ ] **Step 2: Populate both parishes in `src/data.ts`**

For `route-mhcp` (Mary Help of Christians, Maypajo):

```ts
    coordinates: { lat: 14.6305, lng: 120.9711 },
    coordinatesVerified: false,
    geofenceRadius: 100,
    status: "live",
```

For `route-src` (San Roque Cathedral, A. Mabini St):

```ts
    coordinates: { lat: 14.6510, lng: 120.9686 },
    coordinatesVerified: false,
    geofenceRadius: 100,
    status: "live",
```

> **These coordinates are not surveyed.** MHCP's is taken from its own first station; San Roque's is approximate. `coordinatesVerified: false` records that honestly. Replacing them with GPS-accurate values is a job for the human partner, not this task — do not attempt to look them up.

- [ ] **Step 3: Write the failing tests**

Add to `src/lib/geo.test.ts` a `nearestLiveParish` block asserting: a null position returns null; a position at MHCP's coordinates returns MHCP with distance under 1m; a far position still returns the nearest with distance over 1000m; and a `coming_soon` parish is never returned even when it is closer than a live one.

- [ ] **Step 4: Run to verify failure, then implement**

Run `npm test src/lib/geo.test.ts`, confirm failure, then add `nearestLiveParish` to `geo.ts`, filtering to `status === 'live'` before choosing the minimum distance.

- [ ] **Step 5: Verify**

Run: `npm test` — expect 21 passing.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add parish-level geography to routes"
```

---

### Task 5: Port the map projection

**Files:**
- Create: `src/lib/project.ts`, `src/lib/project.test.ts`

**Interfaces:**
- Produces: `DIOCESE_BOUNDS`, `projectToMap(coords, bounds, width, height): { x: number; y: number } | null`

- [ ] **Step 1: Port source and tests**

Read `D:\SanctiWalk-Saved\app\src\lib\project.js` and `project.test.js`. Port both to TypeScript unchanged — the bounds (`latMin 14.610, latMax 14.700, lngMin 120.925, lngMax 121.000`) cover the diocese's territory and both parishes fall inside them.

The final source test asserts both live parishes project inside the frame. Update its fixture coordinates to the values added in Task 4 and confirm both still land inside.

- [ ] **Step 2: Verify failure, implement, verify pass**

Run `npm test src/lib/project.test.ts` before and after. Expect 6 new tests, 27 total.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: port geographic map projection"
```

---

### Task 6: Presence context and the classroom simulator

**Files:**
- Create: `src/context/PresenceContext.tsx`, `src/context/PresenceContext.test.tsx`
- Modify: `src/App.tsx` (wrap the tree in the provider — one import, one wrapper, nothing else)

**Interfaces:**
- Consumes: `nextPresence`, `INITIAL_PRESENCE`, `FORCE_TRANSITION_AT` (Task 3); `ROUTES` (Task 4)
- Produces:
  - `<PresenceProvider>`
  - `usePresence(): { presence: PresenceState; parish: Route | null; position: Coordinates | null; gpsStatus: GpsStatus; simulation: SimulationValue; setSimulation(v: SimulationValue): void }`
  - `SIMULATIONS: { value: SimulationValue; label: string }[]`

**Why a simulator.** The app's core feature is demonstrated in a classroom where real GPS is nowhere near either parish. Without this control the feature cannot be shown. It is deliberately visible, not hidden behind a debug flag.

**Naming caution.** `MapTab.tsx` already has its own `simLat`/`simLng` state for walking between stations inside one church. That is a different feature at a different scale. Do not merge them, do not rename its state, and do not import one into the other. Name yours distinctly (`simulation`, `SIMULATIONS`) and note the distinction in your report.

- [ ] **Step 1: Read the source**

Read `D:\SanctiWalk-Saved\app\src\context\LocationContext.jsx` and its test. Three behaviours were the subject of a bug fix and must be preserved:

1. Switching the simulator ON applies the simulated position with `changedAt: FORCE_TRANSITION_AT` so it takes effect instantly rather than after the 10s dwell.
2. Switching the simulator OFF applies a **null** position instantly, so presence resets to `diocese` rather than freezing at the last simulated parish.
3. The geolocation **error** callback and the "geolocation missing" branch also apply a null position. Without this, a denied permission leaves the app asserting the user is at a parish they are not at — the exact bug caught in review previously.

- [ ] **Step 2: Port the tests**

Port the three tests to `src/context/PresenceContext.test.tsx`: initial state is `diocese` with no parish; switching the simulator to a parish gives `present` with that parish's name; switching back to `off` returns to `diocese` with no parish.

- [ ] **Step 3: Verify failure, then implement**

Simulation values: `'off' | 'approaching_mhcp' | 'at_mhcp' | 'at_src'`, with labels "Off — use real GPS", "Approaching Mary Help of Christians", "At Mary Help of Christians", "At San Roque Cathedral".

`gpsStatus` is `'idle' | 'granted' | 'denied' | 'unavailable'`, and reports `'granted'` whenever the simulator is on so a simulated demo never shows a location error.

- [ ] **Step 4: Wrap the app**

In `src/App.tsx`, wrap the existing returned tree in `<PresenceProvider>`. Change nothing else in that file in this task.

- [ ] **Step 5: Verify**

Run `npm test` — expect 30 passing. Run `npx tsc --noEmit` and confirm no new errors against Task 1's baseline.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add presence context with GPS watch and classroom simulator"
```

---

### Task 7: Make the Mass schedule data

`src/components/MassSchedule.tsx` renders times as literal text in JSX. Nothing can compute "next Mass" from markup.

**Files:**
- Modify: `src/data.ts` (add `MASS_SCHEDULES`)
- Modify: `src/components/MassSchedule.tsx` (render from the data)
- Create: `src/lib/schedule.ts`, `src/lib/schedule.test.ts`

**Interfaces:**
- Produces:
  - `MASS_SCHEDULES: Record<string, { day: string; time: string }[]>` keyed by route id
  - `parseTimes(value: string): string[]`, `toMinutes(time: string): number`, `nextMass(schedule, now)`

- [ ] **Step 1: Extract the existing schedule into data**

Read the current `MassSchedule.tsx` and transcribe **exactly** the times it displays into `MASS_SCHEDULES` in `src/data.ts`, keyed by `"route-mhcp"`. Do not invent or tidy any time — what is on screen today is the parish's real schedule. Record in your report the exact mapping you transcribed, so a human can check it against the parish bulletin.

If San Roque has no schedule in the current UI, give it an empty array rather than copying MHCP's. `nextMass` returns null for an empty schedule, and the UI must handle that.

- [ ] **Step 2: Port the schedule module and its 12 tests**

Read `D:\SanctiWalk-Saved\app\src\lib\schedule.js` and `schedule.test.js`. Port both. The source's `nextMass(church, now)` took a church object and read `church.massSchedules`; here it takes the schedule array directly:

```ts
export function nextMass(
  schedule: { day: string; time: string }[],
  now: Date,
): { day: string; time: string; date: Date } | null
```

Preserve both behaviours added after review: times within a day are **sorted by clock time** before selection (parish data is hand-entered and may be out of order), and the day-offset loop runs 0..7 so a parish with a single weekly Mass still resolves after that day has passed.

- [ ] **Step 3: Verify failure, implement, verify pass**

Expect 12 new tests, 42 total.

- [ ] **Step 4: Render `MassSchedule.tsx` from the data**

Replace the hardcoded rows with a render over `MASS_SCHEDULES`. **Keep the existing visual design exactly** — same Tailwind classes, same layout, same "Confessions are available..." footer. This is a data-source change, not a redesign. Compare the rendered markup against the pre-change version and confirm it is unchanged.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: make the Mass schedule data-driven and port next-Mass calculation"
```

---

### Task 8: Presence UI — banner, sheet, and the simulator control

**Files:**
- Create: `src/components/PresenceBanner.tsx`, `src/components/PresenceSheet.tsx`, `src/components/SimulatorPanel.tsx`
- Modify: `src/App.tsx` (render the three; add a way to reach the simulator)

**Design intent — three rules:**

1. **Nothing is taken away.** The sheet rises over the current screen; it never navigates away. Whatever tab the user is on stays visible above it.
2. **Nothing is forced.** It collapses to a single tappable line and comes back. Arriving at a church is an invitation, not an interruption.
3. **Peaceful, not commercial.** 300–400ms ease, no bounce, no spring, and **no dimming backdrop** — a scrim is the commercial-app idiom this design avoids.

- [ ] **Step 1: The approaching banner**

`diocese` renders nothing. `approaching` renders a slim fixed banner reading "You are approaching **{parish name}**". `present` renders nothing here — the sheet takes over.

Position it so it does **not** cover the heading of the screen beneath. This exact bug was found in the source app: a fixed banner overlapped the page heading on every screen. Measure the top offset against the app's existing header, and report the measurement.

- [ ] **Step 2: The presence sheet**

Rendered only in `present`. Contains an eyebrow "You are near", the parish name, the next Mass line from Task 7, and two actions — one opening that parish's tour, one opening the AR experience. Plus a "Hide" control collapsing it to a single tappable line that re-opens it.

Reset the collapsed state whenever `presence.parishId` or `presence.mode` changes, so arriving at a different parish re-opens the sheet.

The app renders inside `PhoneContainer`; position the sheet relative to that container, not the browser viewport, or it will float outside the phone frame on desktop. Check how `PhoneContainer` establishes its bounds before choosing `fixed` or `absolute`.

- [ ] **Step 3: The simulator panel**

A small panel listing `SIMULATIONS` as radio inputs plus a readout of the current mode, parish, distance and GPS status. Reach it from an existing settings or profile area; if there is none, add a discreet control that does not disturb the current navigation. Say in your report where you put it and why.

- [ ] **Step 4: Verify by measurement, not by eye**

At 375x812 and 360x740, with the simulator driving each mode, report:

1. Banner bounding box, and whether it overlaps the heading beneath it.
2. Sheet bounding box, and whether it covers the app's bottom navigation — it must not.
3. Smallest rendered font size in either component; body and interactive labels 16px minimum, secondary 15px, eyebrows 14px, nothing below 14px.
4. That switching the simulator between the two parishes re-opens the sheet with the new parish.
5. That switching to "off" returns to `diocese` and both banner and sheet disappear.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add presence banner, sheet and simulator panel"
```

---

### Task 9: Diocese map with calibrated pins

SanctDemo's `MapTab` is a walking tour *inside* one church. This adds a diocese-level view *between* churches.

**Files:**
- Create: `src/components/DioceseMap.tsx`
- Modify: wherever parish selection currently happens, to offer this view

**Interfaces:**
- Consumes: `projectToMap`, `DIOCESE_BOUNDS` (Task 5); `ROUTES` (Task 4); `usePresence` (Task 6)

- [ ] **Step 1: Port the illustration**

Read `D:\SanctiWalk-Saved\app\src\components\DioceseMap.jsx` and its CSS. Port the drawing — Manila Bay to the west, three land areas labelled NAVOTAS, MALABON and CALOOCAN, the Tullahan river, a few roads — converting its CSS classes to Tailwind or to `src/index.css` classes using the existing brand variables.

- [ ] **Step 2: Plot parishes from real coordinates**

Every parish is positioned by `projectToMap(parish.coordinates, DIOCESE_BOUNDS, 300, 400)`. Parishes projecting to `null` are **skipped, never clamped to the edge** — a pin pinned to the border is a lie about where the parish is.

Live parishes get a labelled, tappable glyph. Any `coming_soon` parish gets a dimmed, non-tappable glyph **with no text label**, carrying its name in a `<title>` for screen readers. That labelling rule was established after measurement: with eight pins, labelling them all produced 15 overlapping pairs and 3 labels clipped outside the frame.

- [ ] **Step 3: Show the user**

When `position` is inside the bounds, draw a "you are here" dot with a 2s pulse ring — the one deliberate exception to the no-bounce motion rule.

- [ ] **Step 4: Watch the text-scaling trap**

SVG text scales with the drawing. If the map is rendered smaller than its 300x400 viewBox, a label declared at `14px` renders **smaller than 14px** while looking compliant in the source. Compute the rendered size as `declaredSize x (renderedWidth / 300)` and confirm it is at least 14px. Report the measured value.

- [ ] **Step 5: Verify**

`npm test` (42 passing, unchanged — this task adds no logic), `npx tsc --noEmit` clean against baseline, and at 375px: zero overlapping labels, zero labels outside the frame, smallest rendered label at least 14px, and the "you are here" dot appearing at the right parish when the simulator is set.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add geo-calibrated diocese map"
```

---

## Exit criteria

1. `npm test` passes with **42 tests**.
2. `npx tsc --noEmit` shows no errors beyond Task 1's recorded baseline.
3. Every pre-existing screen — Explore, Map, Rosary, Mass, Ministries, Sacraments, History, AR, Quiz, Admin — works exactly as it did before.
4. With the simulator off, the app behaves as it always has.
5. Setting the simulator to "At Mary Help of Christians" raises the presence sheet with a real next-Mass time; switching to San Roque moves it; switching off clears it.
6. The diocese map plots both parishes at their projected positions and shows the user's dot.

## Blocked on the human partner

1. **Deploy the Firestore rules** (`npx firebase deploy --only firestore:rules`) and create the first `admins/{uid}` document. Until then the database is unprotected. Unrelated to this plan, but higher priority than any of it.
2. **Surveyed coordinates** for both parishes. Task 4 ships approximations flagged `coordinatesVerified: false`; the geofence cannot be trusted on site until these are real.
3. **Confirm the Mass schedule** transcribed in Task 7 against the parish bulletin.

## Explicitly out of scope

- Redesigning any existing screen.
- Merging `MapTab`'s station simulator with the presence simulator — different features, different scales.
- Rewriting the rosary, AR, quiz, ministries, sacraments or admin portal.
- Firestore schema changes.
