# Map screen restyle — verification report

Date: 2026-08-25

## Scope

Restyled the Map tab (`activeTab === "navigator"` in `src/App.tsx`, bottom-nav
label "Map") to match the client's prototype (`D:\SanctiWalk-Saved\app`,
`Churches.jsx` / `Churches.css` / `ChurchCard.jsx`): a centred diocese header,
the map given its full height back, the legend and Google Maps link moved
below the map instead of squeezed inside it, and one tappable card per live
parish beneath the map.

Only the Map tab was touched this way. Dashboard's mini map card (`h-64`) and
the pre-selection church selector's map card (`h-72`) were left as-is — the
task named "the map screen" specifically, and those two are small preview
maps embedded in other screens, not the map screen itself.

## Files changed

- `src/index.css` — added `--color-brand-card-navy: #1E2668` token; added a
  `MAP SCREEN` CSS section (`.map-screen__header/__title/__count`,
  `.parish-card` and its children, `.chip--live`).
- `src/data.ts` — added `PARISH_PATRON_SAINTS` (patron per live parish,
  pulled from each parish's own existing station content, not invented).
- `src/components/ParishCard.tsx` — new component, one card per live parish.
- `src/components/DioceseMapLive.tsx` — added optional `heightPx` prop; when
  set, the map surface gets that fixed height directly instead of `flex-1`
  against a fixed-height ancestor, so the legend can sit below it at natural
  height instead of sharing a fixed budget.
- `src/components/CustomDioceseMap.tsx` — added optional `mapHeight` prop,
  threaded through to `DioceseMapLive`.
- `src/App.tsx` — Map tab now renders the diocese header, `CustomDioceseMap`
  with `mapHeight={374}`, and a `ParishCard` per live parish (reusing the
  existing `liveParishes` list and `handleOpenTourFromPresence` handler that
  map pins already use to open a parish).

## One deliberate deviation from the brief

The brief states `#2FA37A` "is the existing success green" and that
`--color-brand-success` already covers it. Checked `src/index.css`:
`--color-brand-success` is `#1F7A54`, not `#2FA37A`, and it's currently only
used for the "you are here" map marker.

Measured contrast for white text at 14px:
- White on the literal `#2FA37A`: **3.16:1** — fails AA's 4.5:1 floor for
  text this size.
- White on `--color-brand-success` (`#1F7A54`): **5.29:1** — passes.

`#1F7A54` is the same green family as `#2FA37A` (roughly a ~26% darkening of
it), which matches the pattern already used elsewhere in this file for
`--color-brand-accent` (client's teal darkened ~18% for the same reason). So
the "Live" chip reuses `--color-brand-success` rather than hardcoding the
prototype's literal hex, which would have failed contrast. No new token was
needed for the chip. `--color-brand-card-navy` (#1E2668) was added since no
existing token matched that navy.

## Measurements (via JS in the Browser pane, `data-map-mode="fallback"` — the
Browser pane's WebGL context never paints MapLibre, so it always runs the
drawn-SVG fallback, as expected)

1. **Map container height**: `374px` exactly (`getBoundingClientRect().height`
   on the `[data-map-mode]` element).
2. **Legend / Google Maps link position**: map frame bottom edge at
   `737.4px`; `.dmap-live__open-link` top edge at `745.4px` — 8px below the
   map, not inside its height. (The scope-polygon legend itself only renders
   in `live`/`searching` mode per pre-existing code — confirmed by DOM
   inspection while the map was still resolving; it is absent once the
   Browser pane settles into `fallback`, which was already true before this
   change and is unrelated to it.)
3. **Parish card computed styles**: `background-color: rgb(30, 38, 104)`
   (`#1E2668`), `border-radius: 20px`. Chip: `background-color: rgb(31, 122,
   84)` (`#1F7A54`, via `--color-brand-success`).
4. **Contrast ratios** (computed against actual rendered/composited colors):
   - Chip white text on chip green: **5.29:1**
   - Card name (white, 18px) on card navy: **13.70:1**
   - Card patron / next-Mass lines (white at 70% opacity, 15px) on card navy:
     **7.45:1**
   All clear AA (4.5:1).
5. **Smallest rendered font size on the map screen**: `14px` — the
   pre-existing distance-panel labels inside the map overlay
   (`.dmap-live__panel-name/__panel-distance`) and the new "Live" chip, both
   at the 14px chip/label floor. Nothing smaller was found.
6. **Both live parishes render a card**: confirmed —
   "Mary Help of Christians Parish" (patron "Maria Auxiliadora (Mary Help of
   Christians)", "Next Mass · Wednesday 6:00 AM") and "San Roque Cathedral
   Parish" (patron "San Roque", "Next Mass · Wednesday 6:00 PM (sample,
   unconfirmed)" — San Roque's schedule is flagged unverified in `data.ts`,
   same as elsewhere in the app, so the card says so rather than presenting
   it as confirmed). Tapping the San Roque card switched the app's active
   parish to San Roque Cathedral Parish (confirmed via DOM text after click).
7. **Tests / typecheck**: `npm test` → 7 files, **53 passed**. `tsc --noEmit`
   → exits 0. No console errors observed in the Browser pane during
   navigation, map load, or card taps.

## What stayed working (unchanged in this diff)

- Study-area polygon + its legend (existing `DioceseMapLive.tsx` logic,
  untouched aside from the new optional `heightPx` layout branch).
- All 31 parish markers (2 live/tappable, 29 dimmed/inert) — marker logic
  untouched.
- "You are here" marker — untouched, still uses `--color-brand-success`
  (shared token, different UI context, no visual conflict with the chip).
- Distance panel, walking routes, recentre control — untouched.
- Offline SVG fallback (`DioceseMap.tsx`) — untouched; still what the
  Browser pane itself renders.
- Rosary, Firebase, auth, `firestore.rules` — not touched.
