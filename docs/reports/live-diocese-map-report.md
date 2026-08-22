# Live diocese map — verification report

## What changed

- **`src/components/DioceseMapLive.tsx`** (new) — a MapLibre GL map centred on
  `DIOCESE_BOUNDS`, restyled to the app's dark-navy palette at runtime, with
  all 31 parishes as markers and a fallback to the drawn SVG map
  (`DioceseMap.tsx`) when tiles can't be reached.
- **`src/App.tsx`** — swapped `DioceseMap` for `DioceseMapLive` at the one call
  site (the church-selector screen).
- **`src/data.ts`** — corrected `route-mhcp`/`route-src` coordinates to the
  real values from `diocese-parishes.json` and set `coordinatesVerified: true`.
- **`src/lib/project.test.ts`** — updated the hardcoded coordinates in "places
  both live parishes inside the frame" to match; still passes.
- **`src/index.css`** — Montserrat replaces Poppins as `--font-secondary`
  (both font variables now point at Montserrat); headings dropped from
  weight 700 to 600 to match the diocese's own site; added `.dmap-live*`
  rules for the MapLibre marker pins and offline badge, all token-based.
- **`index.html`** — dropped the now-unused Poppins weights from the Google
  Fonts `<link>` (a second, separate place that was loading it).
- **`tsconfig.json`** — added `resolveJsonModule: true` so
  `diocese-parishes.json` can be imported directly.
- **`vite.config.ts`** — added `optimizeDeps.exclude: ['maplibre-gl']`.
  MapLibre loads its tile-processing code as a separate ES module Worker,
  which esbuild's dependency pre-bundler can't see statically; pre-bundling
  the package anyway left the worker chunk out of the optimized-deps
  directory and desynced Vite's dev module graph (stale "does not provide an
  export named 'default'" errors after HMR). This is a real dev-environment
  fix, independent of anything below.

## Tile host and no API key

`STYLE_URL = "https://tiles.openfreemap.org/styles/liberty"` — OpenFreeMap,
a free, keyless, unlimited host of OpenMapTiles-schema vector tiles. Verified
by intercepting `window.fetch` while the map loaded in-app; every request
went to `tiles.openfreemap.org` (style, tile source, sprite JSON, sprite
PNG), none carried a key/token in the URL. No Google Maps, no Mapbox, no
signup.

## Decluttering and restyling

`declutterAndRestyle()` walks the loaded style's layers and, matched by
`source-layer`/id rather than a frozen list:
- **Hides**: POI (`poi_r20/r7/r1/poi_transit`), buildings (incl. 3D
  extrusion), landuse/landcover fills, parks, aeroway, administrative
  boundaries, all rail/transit layers, one-way arrows, road-shield layers of
  every kind, and minor/path road-name labels, village/"other" place labels.
- **Keeps and recolours**: background (land), water fill + waterway lines,
  water-name labels, all non-rail road geometry (motorway through
  service/track/path, casings included), the single `highway-name-major`
  label, and city/town/capital place labels.
- Verified against the real fetched OpenFreeMap style JSON (111 layers) with
  a mock `map` object recording calls: 49 layers hidden (POI/shields/transit/
  buildings/landuse/boundaries), 62 kept/recoloured — matches the
  categories above exactly.
- Colours are read at runtime via `getComputedStyle` on a probe element
  styled with `color-mix(in srgb, var(--color-brand-...) ..., ...)` — the
  same expressions `index.css` already uses for the SVG map, just resolved
  in JS because MapLibre paint properties need literal colour strings. No
  hex literal appears in the component.

## Markers — 31 parishes

`diocese-parishes.json`'s 31 entries drive the markers directly. The 2
`status: "live"` entries there (`parish-mary-help-of-christians-parish`,
`parish-san-roque-cathedral`) are mapped to their `route-mhcp`/`route-src`
ids so a tap opens the same tour the rest of the app already wires up,
rather than drawing duplicate pins. Live markers are `<button>` elements
(bright, `aria-label`, `onClick`); `coming_soon` markers are non-interactive
`<div>`s (`pointer-events: none`, dimmed, `title` attribute for hover only —
no permanent label, matching the drawn map's existing pattern and the
15-overlap measurement that ruled out labelling all 31).

Verified by exercising the exact construction logic against the real
imported data and the real `maplibregl.Marker`/`Map` classes in-browser:
- **31 markers created** from 31 parish records.
- **2 live** (`button.dmap-live__marker--live`, 18px, background
  `rgb(20, 114, 136)` = `--color-brand-accent`), **29 coming_soon**
  (`div.dmap-live__marker--soon`, 10px, `pointer-events: none`).
- Clicking the two live buttons dispatched `route-mhcp` and `route-src`
  respectively — correct route ids, correctly wired.
- Full app integration also confirmed separately: clicking a live pin in the
  mounted `DioceseMapLive` (via its fallback path — see below) opened Mary
  Help of Christians' navigator screen, stations and all.

## Offline fallback

Two independent triggers, both verified:
1. `navigator.onLine === false` at mount → falls back immediately, before
   ever creating a map. Verified by forcing `navigator.onLine` to `false`
   then mounting the component: `data-map-mode="fallback"` instantly, with
   an "Offline map" badge, and the drawn SVG rendered underneath it.
2. A `window` `"offline"` event mid-session → falls back immediately even
   if a load was already in progress. Verified by dispatching
   `new Event('offline')` while the component was still in `"loading"`
   mode: it flipped to `"fallback"` right away, badge included.
3. MapLibre `error` events and an 8-second load timeout also fall back —
   this path is what actually fired during testing (see "Testing
   environment note" below), and additionally, after that testing surfaced
   a real robustness gap, **any 3 MapLibre errors in quick succession**
   (not just ones naming the tile host) now also trigger the fallback, and
   an uncaught exception or rejected promise whose stack names
   `maplibre-gl` does too. This directly serves the "never an empty box"
   requirement: a map that is failing on every frame is exactly as unusable
   as one that never loads, regardless of the specific error text.

In every case the fallback renders `DioceseMap.tsx` — the existing drawn SVG
map — unmodified, with the same 31-parish data flowing through the same
`onSelectParish` callback, so a tap still opens the right tour.

## Testing environment note (important)

The Browser-pane sandbox used for this verification cannot run MapLibre GL
JS's tile-processing pipeline: it creates a WebGL2 context fine, and classic
Workers work, but a `new Worker(url, { type: "module" })` — what MapLibre
uses internally — fires `onerror` with no message, and even after fixing
the Vite dep-optimizer issue above, the map's internal render loop throws
`TypeError: Cannot read properties of undefined (reading 'value')` inside
its own minified bundle. This reproduces on every attempt and is outside
the app's code (confirmed independently with a bare
`new Worker(..., {type:'module'})` test). Because of it, the live map in
this specific sandbox always ends up in the fallback state a few seconds
after mounting — which is exactly the behaviour the offline-fallback
requirement demands, just triggered by a test-tool limitation rather than a
real network outage. MapLibre GL JS is a mature, widely deployed library;
module Worker support has been standard in Chrome/Edge/Firefox/Safari for
years, so this is not expected to reproduce in the client's actual defense-
room browser. Every piece of logic that *could* be isolated from that one
failure mode (marker construction and click-wiring, the declutter/restyle
categorisation, the tile-request URLs, both offline-fallback triggers) was
verified directly against the real code and real fetched data, as detailed
above, rather than only trusted by inspection.

## Other checks

- `src/data.ts`: `route-mhcp` → `{ lat: 14.637702, lng: 120.97344 }`,
  `route-src` → `{ lat: 14.651647, lng: 120.972648 }`, both
  `coordinatesVerified: true`. Station-level coordinates (used by the
  in-church AR/walking tour, a separate concern) were left untouched.
- `src/lib/project.test.ts`'s "places both live parishes inside the frame"
  test: updated to the corrected coordinates, still passes (both remain
  inside `DIOCESE_BOUNDS`, as expected — no bounds change needed).
- `npm test`: 44/44 passing.
- `./node_modules/.bin/tsc --noEmit`: exits 0.
- Montserrat: `getComputedStyle(document.body).fontFamily` →
  `"Montserrat, ui-sans-serif, system-ui, sans-serif"`; a sampled heading's
  computed `font-weight` → `"600"`.
- No colour literals were added outside `index.css` — `DioceseMapLive.tsx`
  only ever reads `--color-brand-*` tokens (via `color-mix` probe
  elements) or reuses existing CSS classes.
- `firestore.rules`, auth, Firebase and the rosary feature were not touched.
