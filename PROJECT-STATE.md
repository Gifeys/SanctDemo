# SanctiWalk — Project State

**Last updated:** 2026-08-25 · 34 commits · 44 tests passing · typecheck clean

Read this first. It exists so a new session, or a new person, can pick the project up without reading back through months of conversation.

---

## What this is

A Catholic parish companion PWA for the **Diocese of Kalookan** (southern Caloocan, Malabon, Navotas), built as an STI College capstone. Its central claim: **the app detects which parish you are standing at and reshapes itself around that place.**

**Stack:** React 19 · TypeScript 5.8 · Vite 6 · Tailwind 4 · Firebase (auth + Firestore) · Express server (`server.ts`) with a Gemini vision endpoint.

## Running it

```bash
npm run dev --prefix D:/SanctDemo          # http://localhost:5173
npm run dev:https --prefix D:/SanctDemo    # https://<LAN-IP>:5173 — needed for the camera on a phone
npm test --prefix D:/SanctDemo             # 44 tests
./node_modules/.bin/tsc --noEmit           # NOT `npx tsc` — that resolves to an unrelated package
```

**The camera only works over HTTPS or on localhost.** That is a browser rule, not a bug. On a phone use `npm run dev:https` and accept the self-signed certificate warning once.

---

## Where things are

| Area | Files |
|---|---|
| Location awareness | `src/lib/{geo,presence,project,schedule}.ts`, `src/context/PresenceContext.tsx` |
| Maps | `DioceseMapLive.tsx` (real, MapLibre) falling back to `DioceseMap.tsx` (drawn SVG) |
| Parish content | `MassSchedule` · `ChurchHistory` · `MinistriesTab` · `SacramentsTab` — all take a parish prop |
| Rosary | `public/rosary/index.html` — the client's own app, mounted in an iframe by `DailyRosary.tsx` |
| AR | `ArTour.tsx` + `src/lib/useCamera.ts` + `/api/identify` in `server.ts` |
| Data | `src/data.ts` (routes, schedules, ministries, sacraments) · `src/data/diocese-parishes.json` (all 31 parishes) |

**Navigation:** bottom bar is **Home · Map · Scan · Pray · Me**, with Scan raised in the centre. Everything else lives in the sidebar, with developer controls fenced off under a "Demo Tools" heading.

---

## The rules this codebase holds itself to

These were arrived at through real bugs. Breaking them reintroduces those bugs.

1. **Unverified data is labelled, never hidden.** The pattern is a `…Verified: false` flag plus a visible badge — see `coordinatesVerified`, `scheduleVerified`, `vicariateVerified`. A parish app that states a wrong Mass time sends someone to a locked church.
2. **Never substitute a default for missing geography.** A route without coordinates is skipped with a warning, never placed at `{lat: 0, lng: 0}` — that is in the Atlantic and would make a parish silently unreachable.
3. **Measure rendered output, do not eyeball it.** SVG text scales with its drawing, so a label declared `14px` can render at 10px while looking compliant in the source. Several real defects here passed code review and failed only when someone measured pixels.
4. **Type floor:** body and interactive labels 16px, secondary 15px, chips 14px, nothing below 14px. The audience includes older parishioners.
5. **No colour literals outside `src/index.css`.** Everything reads from brand tokens, which is why three palette changes cost one file each.
6. **`nextPresence` never reads the clock.** `now` is always passed in — that is what makes the 10-second dwell debounce testable.

---

## Known state — read before changing anything

- **San Roque Cathedral's Mass times are invented.** Placeholder data so the per-parish switch could be tested. Flagged `scheduleVerified: false` with a visible badge. **Replacing them is the highest-priority data task.**
- **Vicariate assignments are inferred**, not official — each parish assigned to its nearest vicariate seat, flagged `vicariateVerified: false`. The diocese's site bakes vicariate names into banner images, so they could not be scraped.
- **Firestore rules are written but may not be deployed.** Run `npx firebase deploy --only firestore:rules` and create an `admins/{uid}` document in the Firebase console. Until then the database is open.
- **Ministries and Sacraments are diocese-wide**, not per-parish — no per-parish data exists yet. Both screens say so rather than implying otherwise.
- **Station progress is not real yet.** The old simulated walk was removed. Real progress needs QR scanning at each station; see the AR decisions doc.
- Dead state remains in `App.tsx` (`commentsByStation`, `handlePostComment`, `activeCommentInput`) after the station comments block was removed.

---

## Key documents

| Document | What it settles |
|---|---|
| `docs/ar-and-pilgrim-tour-decisions.md` | Why browser AR and not Unity; how presence is confirmed; the visit-session quiz design |
| `docs/plans/2026-08-18-port-location-awareness.md` | The nine-task port, complete |
| `docs/data-collection/` | What the field team collects — Word guide, fillable form, CSV template |
| `docs/reports/` | Per-task verification records with measurements |

## Data facts worth not re-deriving

- **All 31 parishes** have real coordinates, taken from the diocese's own embedded maps — `src/data/diocese-parishes.json`.
- Mary Help of Christians: `14.637702, 120.97344` · San Roque Cathedral: `14.651647, 120.972648`
- Map bounds: `latMin 14.610, latMax 14.700, lngMin 120.925, lngMax 121.000`
- Geofence: enter Present ≤100m, leave >150m; enter Approaching ≤500m, leave >600m; 10s dwell
- Tiles: OpenFreeMap (`tiles.openfreemap.org`) — free, keyless, no billing
- Palette: navy `#151B53`, teal `#1886A0` (text variants `#147288` on cream, `#5FC7DE` on navy, for AA contrast), Montserrat

## What is next

1. Replace San Roque's Mass times with real ones
2. Deploy the Firestore rules
3. Real station progress via QR scanning
4. Load field data as it arrives
5. Map pass — fit all 31 parishes, tell pins apart
