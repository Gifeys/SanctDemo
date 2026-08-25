# Merged map report

## What changed

- `src/components/DioceseMapLive.tsx` — the real MapLibre map, now also:
  - draws the client's 7-point study-area polygon (`SCOPE_POLYGON_RING`) as a
    `fill` + `line` MapLibre layer (`addScopePolygon`), added once in the
    `load` handler right after `declutterAndRestyle`, before any marker or
    route layer exists.
  - gives the two live parish markers a permanent, visible text label
    (`.dmap-live__marker-label`) in addition to the existing tooltip; the 29
    coming-soon markers stay label-free (title-tooltip only), matching the
    "8 pins → 15 overlaps" collision finding.
  - renders a caption (`.dmap-live__legend`) under the live map explaining
    the shaded polygon as the capstone's study/coverage area.
  - exports `OPEN_IN_GOOGLE_MAPS_URL` and `SCOPE_POLYGON_RING` for reuse.
- `src/components/CustomDioceseMap.tsx` — rewritten from a two-tab
  embed/live switcher into a thin wrapper: renders `DioceseMapLive` plus the
  "Open full map in Google Maps" link underneath. No iframe, no tab
  switcher, no `useState`. Kept the filename (App.tsx / Dashboard.tsx import
  it unchanged) rather than folding it into `DioceseMapLive` directly, so
  the diff stays small and the two responsibilities (the map itself vs. the
  card chrome + external link) stay separated.
- `src/index.css` — added `--color-brand-scope: #E65100` (client's original
  My Map orange, kept only for the polygon fill/outline since pins are now
  teal), plus CSS for the marker label, the legend caption, and the
  "open in Google Maps" link style. No other rule changed.

## Verification

1. **Polygon ring closed + coordinates match.** `SCOPE_POLYGON_RING` in
   `DioceseMapLive.tsx` (printed from the file):
   ```
   [120.972677, 14.651797]
   [120.971767, 14.643635]
   [120.971149, 14.637125]
   [120.976676, 14.638188]
   [120.976539, 14.639782]
   [120.975187, 14.652067]
   [120.972677, 14.651797]
   ```
   Matches the spec list exactly; first and last points are identical, so
   the ring is closed as GeoJSON requires.

2. **Layer order.** `addScopePolygon` is called once, inside `map.on("load")`,
   immediately after `declutterAndRestyle(map)` and before `fitBounds`/marker
   construction — so the fill+line layers are the first non-basemap layers
   added, and every route line added later stacks on top of them. Parish and
   "you are here" pins are MapLibre `Marker` HTML elements, which the browser
   always composites above the WebGL canvas regardless of MapLibre layer
   order, so they can never be hidden under the fill by construction.

3. **Marker counts.** The single loop over `PARISHES` (31 entries from
   `diocese-parishes.json`) creates one marker per parish: a `<button>`
   (`dmap-live__marker--live`, teal, tappable, click handler, permanent text
   label) when `status === "live"` and mapped to a route id (2 parishes:
   Mary Help of Christians, San Roque Cathedral), else a `<div>`
   (`dmap-live__marker--soon`, dimmed via `color-mix`, `pointer-events: none`
   in CSS so it's inert, no permanent label — 29 parishes). A 32nd, visually
   distinct green "you are here" marker (`dmap-live__marker--you`, uses
   `--color-brand-success`, not teal) is added separately only when
   `position` is known.

4. **Distance panel / recentre / offline fallback still render** — confirmed
   live in the Browser pane (MapLibre itself falls back to the SVG there
   since the pane's module-worker is blocked, so only the fallback path
   below was actually seen rendering):
   - Both full-page Map tab and the Dashboard's inline map card show the
     `DioceseMap.tsx` SVG fallback with "Mary Help of Christians" / "San
     Roque Cathedral" pins, the distance panel ("Distance unknown" — no
     simulated position was set), and the "Open full map in Google Maps"
     link.
   - No console errors on either view.
   - **Not directly observed**: the MapLibre canvas itself, the polygon
     fill rendering on screen, the live-pin text labels, and the recentre
     button (which only renders in the `mode === "live"` branch, never
     reached in this environment). These are verified by code inspection
     (points 1–3 above) and by `tsc`/tests, not by a screenshot.

5. **Colour literal grep** on the two changed component files:
   ```
   src/components/DioceseMapLive.tsx:130:  return resolved || "#151B53";
   ```
   That one hit is pre-existing code (the `resolveColor()` helper's safety
   fallback if `getComputedStyle` ever returns nothing), not something this
   change introduced — nothing added here uses a literal; every new colour
   goes through `--color-brand-scope` via `resolveColor()`, same pattern as
   the existing tokens. `CustomDioceseMap.tsx` has zero matches.

6. `npm test` → 7 files, **53 passed**. `./node_modules/.bin/tsc --noEmit`
   → exits 0, no output. No console errors observed in the Browser pane on
   either the Dashboard map card or the full Map tab.

7. **Polygon sanity check.** Bounding box: lng 120.971149–120.976676, lat
   14.637125–14.652067 (roughly 610m × 1660m). Shoelace-estimated area ≈
   0.70 km². Mary Help of Christians Parish (14.637702, 120.97344) and San
   Roque Cathedral (14.651647, 120.972648) both fall inside this bounding
   box — confirms the polygon covers the corridor between the two live
   parishes rather than some unrelated area.

## Concerns

- The Dashboard/App map cards have a fixed outer height (`h-72` / `h-64`,
  288px / 256px). Adding the legend caption + "open in Google Maps" link
  below the map (both now inside the fixed-height card, via `flex-1
  min-h-0` on the map itself) shrinks the map's own vertical space compared
  to before. Not testable visually here (MapLibre doesn't render in this
  Browser pane), so this is a layout risk worth a real-device/screenshot
  check before sign-off.
- The scope legend is only shown in live (MapLibre) mode, not in the SVG
  offline fallback, since the fallback never draws the polygon — intentional,
  but worth confirming that's the desired behavior for a defense where the
  venue Wi-Fi might be unreliable.
