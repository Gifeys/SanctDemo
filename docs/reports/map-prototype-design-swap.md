# Map design swap — the client's prototype, on top of what SanctDemo added

**Task:** replace SanctDemo's live diocese map design with the client's earlier
prototype (`D:\SanctiWalk-Saved\app\src\components\DioceseMap.jsx` /
`DioceseMap.css`), while keeping every feature SanctDemo added on top of it
across earlier sessions.

**Status:** done. `npm test` — **70 tests**, up from 53 (17 new). `tsc
--noEmit` exits 0. No console errors observed on the map screen (see
Verification below).

---

## What changed

### `src/components/DioceseMapLive.tsx`
- **Basemap**: `STYLE_URL` switched from OpenFreeMap's `liberty` style
  (hand-decluttered/restyled to dark navy at runtime) to `positron` — light,
  already plain, no restyling needed. `declutterAndRestyle`, `readTokens` and
  the `Tokens` interface are deleted; they existed only to fight `liberty`'s
  clutter into a dark palette, and positron doesn't need it.
- **Pins**: every one of the 31 parishes is now a church-glyph `<button>`
  (body/roof/cross SVG), 32px in the accent colour for live parishes, 22px and
  dimmed for coming-soon — matching the prototype's `churchPinElement`
  exactly. This replaces the old small circular `<div>`/`<button>` dots, of
  which only the 2 live parishes were tappable; **all 31 are tappable now**.
  The pin/popup DOM builders were extracted to `src/lib/mapMarkers.ts` so they
  are unit-testable (see Verification).
- **Popups**: `anchor: 'bottom'`, no close button, `maxWidth: '220px'`, built
  by `buildPopupContent()` — parish name, its vicariate as the location line,
  then either a "View parish" button (live) or a "Coming soon to SanctiWalk"
  note (coming-soon; never a navigation control). Opening a popup calls
  `map.easeTo({ center, offset: [0, 70], duration: 300 })` so a pin near the
  top edge doesn't get its card clipped by the frame.
- **Search**: a new floating pill search bar (top-left, inset `right: 52px`
  to clear the zoom control) with a results dropdown. Filtering is
  `searchParishes()` in the new `src/lib/mapSearch.ts` — substring match over
  parish name + vicariate (used as the "location" line; this dataset has no
  dedicated `location` field the way the prototype's `churches.json` does),
  case-insensitive, capped at 6. Selecting a result `flyTo`s zoom 16 with
  `offset: [0, 70]` and opens that pin's popup — live or coming-soon alike.
- **Navigation control**: `NavigationControl({ showCompass: false })` added
  top-right (it was missing entirely before this change).
- **You-are-here marker**: now has the pulsing ring the client asked for —
  previously it was a plain dot with no animation. An HTML marker can't use
  the fallback SVG map's `r` (radius) keyframe trick, so it pulses via a
  scaling/fading `::after` pseudo-element ring instead (same idea, different
  mechanism, since this one isn't SVG).
- **Everything SanctDemo added stays wired, unchanged in behaviour**: the
  scope polygon + legend, walking routes (`fetchWalkingRoute`, OSRM),
  distance panel, recentre-on-me, the offline SVG fallback
  (`DioceseMap.tsx`), and the `heightPx`/map-screen layout from commit
  `38274f2`.
- Marker bookkeeping changed from a plain array to a `Map<parishId, Marker>`
  (mirrors the prototype), since search needs to look a marker up by id to
  fly to it. The "you are here" marker got its own ref, separate from the
  parish markers, so a GPS position tick only touches that one marker instead
  of tearing down (and closing the popup of) all 31 parish pins.

### `src/lib/mapSearch.ts` (new) + `mapSearch.test.ts` (new, 8 tests)
Pure filter function (`searchParishes`), extracted so search behaviour is
testable without a MapLibre instance.

### `src/lib/mapMarkers.ts` (new) + `mapMarkers.test.ts` (new, 9 tests)
Pure DOM builders (`buildChurchPinElement`, `buildPopupContent`), extracted
for the same reason — and because this environment cannot render MapLibre at
all (see Verification).

### `src/index.css`
- Rewrote the "LIVE DIOCESE MAP" block: new `.dmap__pin`/`.dmap__pin--live`/
  `.dmap__pin--soon` rules for the glyph pins (replacing the old dot marker
  rules and the now-removed `.dmap-live__marker-label`, which existed only
  because just 2 of 31 pins used to be distinguishable), the you-are-here
  pulse keyframes, and new `.dmap-search*` / `.dmap-results*` / `.dmap-popup`
  /`.dmap-card*` rules for the search bar, results dropdown and popup card —
  all themed from SanctDemo's existing `--color-brand-*` tokens.
- Every one of the prototype's sub-14px type sizes was raised to the floor:
  `.dmap-search__input` 14→16px, `.dmap-results__name` 14→16px,
  `.dmap-results__where` 12→15px, `.dmap-results__empty` 13→15px,
  `.dmap-card__name` 15→16px, `.dmap-card__where` 13→15px,
  `.dmap-card__soon` 12→15px, `.dmap-card__action` 13→16px.
- One new token: `--color-brand-on-accent: #FFFFFF` (added to both `:root`
  and `@theme`) — nothing in SanctDemo's existing palette named the "text on
  a solid accent fill" role the popup's "View parish" button needs; the
  prototype's own `--on-accent` doesn't carry over by name. Contrast: 5.54:1
  against `--color-brand-accent` (#147288) — see below.
- The scope polygon's fill opacity was raised from 0.22 to 0.30 in
  `DioceseMapLive.tsx` (not CSS, since it's a MapLibre paint property) —
  0.22 was tuned for the old dark ground; against positron's light ground the
  same alpha reads fainter, so it was nudged up. The fill/line colour itself
  (`--color-brand-scope`, the client's own orange) is unchanged.
- The live pin's stroke and the you-are-here marker's border both moved from
  `--color-brand-card` (cream, #EBEBE0) to `--color-brand-primary` (navy,
  #151B53). Both nearly disappeared against positron: cream and positron's
  land tone are both pale near-whites with almost no separation, where navy
  reads as a clear outline against a light ground.
- The dark-illustrated fallback map (`DioceseMap.tsx`'s own CSS block, above
  the live-map block) is untouched — it's a separate, non-tiled illustration
  that stays dark to match the rest of the app; only the tiled MapLibre
  canvas becomes light.

### `PROJECT-STATE.md`
Updated the Maps row, the "Known state" section (documents the swap and the
rendering-verification limitation), the header test count, and removed the
now-done "Map pass" item from "What is next".

---

## Verification

### What's measured (not eyeballed)

**`npm test`**
```
Test Files  9 passed (9)
     Tests  70 passed (70)
```
Up from 53 (baseline) by 17: 8 in `mapSearch.test.ts`, 9 in
`mapMarkers.test.ts`.

**`./node_modules/.bin/tsc --noEmit`** — exits 0, no output.

**Search filtering, ordering, the 6-result cap** — `mapSearch.test.ts`
asserts: empty/whitespace query → `[]`; substring match on name; substring
match on location; case-insensitivity; whitespace trimming; the cap at
`MAX_SEARCH_RESULTS` (asserted `=== 6`); input-order preservation among
matches; no-match → `[]`.

**Popup DOM, live vs coming-soon branches** — `mapMarkers.test.ts` calls
`buildPopupContent()` directly and asserts: live parish → name + location +
"View parish" button, no coming-soon note; coming-soon parish → name +
location + "Coming soon to SanctiWalk" note, **no action button at all**
(so there is no element to wire a navigation handler to, not just an unwired
one); the "View parish" string never appears anywhere in a coming-soon
card's text; the location paragraph is omitted when absent; the name is
always the first child, an `<h3>`. `buildChurchPinElement()` is asserted for:
`aria-label` text (plain name for live, `"{name} — coming soon"` for
coming-soon); class names (`dmap__pin--live` / `dmap__pin--soon`); that
**both** are real, focusable `<button type="button">` elements — this is the
assertion that "every pin is tappable, including coming-soon ones" actually
holds, since a non-button/non-focusable element would fail it; and that the
glyph SVG contains a `rect` (body), a `polygon` (roof) and 2 `line`s (cross).

**Marker/popup wiring, `flyTo`/`easeTo` offsets, style URL** — checked by
reading the code (see "What changed" above) rather than by a runtime
assertion, since exercising the actual MapLibre wiring end-to-end needs a
real canvas. I additionally exercised it live in the dev server via the
DOM/console (not a screenshot — see "What I could not verify"):
- Typed "san roque" into the running app's search box (dispatching a real
  `input` event) → got exactly 6 results, correctly matching both by name
  (`San Roque Cathedral`) and by location (5 other parishes whose vicariate
  is also "Vicariate of San Roque").
- Clicked a coming-soon result ("Hearts of Jesus and Mary") → its popup DOM
  rendered with the coming-soon note and no action button.
- Clicked the live "San Roque Cathedral" result's "View parish" button → no
  console error, no thrown exception.
- Read the page's accessibility tree: all 31 parish pins are present as
  `button`s with the expected `aria-label`s (`"…Parish — coming soon"` for
  the 29 non-live, plain names for the 2 live), the `NavigationControl`
  contributes exactly "Zoom in"/"Zoom out" buttons with **no compass
  button**, and the search textbox has the correct placeholder/aria-label.
  This confirms the DOM structure DioceseMapLive.tsx actually produces at
  runtime matches what the source was written to produce — not just that the
  source reads that way.
- Confirmed via the browser console that the positron style's layers were
  fetched and parsed (three benign upstream style-data warnings — MapLibre
  complaining about `null` values in the positron style's own shield-filter
  expressions — fired during page load, which only happens after the style
  JSON is fetched and processed). No other console errors appeared through
  any of this.

**Type floor** — grep for any `font-size` below 14px, repo-wide:
```
$ grep -rn "font-size" src --include=*.css
```
Every declared `font-size` in `src/index.css` is 14px or above (14, 15, 16,
18, 21, 22px — no value below 14 exists anywhere in the file, in the map CSS
or elsewhere).

**Colour literals outside `index.css`** — grepped for hex literals in the
files this task touched:
```
$ grep -nE "#[0-9a-fA-F]{3,8}\b" src/components/DioceseMapLive.tsx \
    src/components/DioceseMap.tsx src/components/CustomDioceseMap.tsx \
    src/lib/mapMarkers.ts src/lib/mapSearch.ts src/components/ParishCard.tsx

src/components/DioceseMapLive.tsx:147:  return resolved || "#151B53";
```
That one hit is `resolveColor()`'s fallback return value if
`getComputedStyle` somehow returns nothing — a pre-existing line, unchanged
by this task, carried over verbatim from the version already in the
codebase. It's a JS fallback for a failure path, never a rendered colour
(the CSS custom property it stands in for, `--color-brand-primary`, already
resolves to the same navy in the normal case), so it doesn't put a colour
literal into anything drawn on screen.

A repo-wide grep for the same pattern also matches `src/App.tsx` and
`src/components/MapTab.tsx` extensively — those are pre-existing Tailwind
arbitrary-value classes (`bg-[#5A5A40]`, `text-[#8A8A70]`, etc.) bridged onto
the brand tokens by the "DYNAMIC COLOR BRIDGING OVERRIDES" section already in
`index.css` (each one has a matching `!important` rule mapping the literal
class name to a `var(--color-brand-*)`). `MapTab.tsx` is the *station-tour*
map (SVG trail inside an already-selected parish) — a different screen from
the diocese map this task replaces — and this pattern predates this task
across the whole codebase; neither was touched here.

### Contrast (against the light basemap)

Positron's exact land/water hex isn't retrievable in this environment (see
below), so ground colour is approximated at **`#f4f4f0`**, a typical
CARTO/OpenMapTiles positron land tone — the numbers below are therefore
close estimates, not measured pixels, and worth confirming by eye once the
map can be seen.

| Pair | Foreground | Background | Ratio | Floor | Result |
|---|---|---|---|---|---|
| Popup name/location text | `--color-brand-text` #33332D | `--color-brand-card` #EBEBE0 | **10.6:1** | 4.5:1 (text) | pass |
| Popup secondary text (`__where`, `__soon`) | `--color-brand-secondary` #666655 | `--color-brand-card` #EBEBE0 | **4.87:1** | 4.5:1 (text) | pass |
| Search input text | `--color-brand-text` #33332D | search bar (≈`--color-brand-card`, 94% opacity) | **≈10.6:1** | 4.5:1 (text) | pass |
| "View parish" button text | `--color-brand-on-accent` #FFFFFF | `--color-brand-accent` #147288 | **5.54:1** | 4.5:1 (text) | pass |
| Live pin outline vs. ground | `--color-brand-primary` #151B53 | positron ground (≈#f4f4f0) | **very high (navy on near-white)** | 3:1 (graphical) | pass |
| Route line vs. ground | `--color-brand-accent` #147288 | positron ground (≈#f4f4f0) | **≈5.0:1** | 3:1 (graphical) | pass |
| You-are-here fill vs. ground | `--color-brand-success` #1F7A54 | positron ground (≈#f4f4f0) | **≈4.8:1** | 3:1 (graphical) | pass |
| Scope polygon fill/line vs. ground | `--color-brand-scope` #E65100 | positron ground (≈#f4f4f0) | **≈3.4:1** | 3:1 (graphical) | pass, smallest margin |

The scope polygon has the thinnest margin of the set — it's the client's own
literal colour (kept unchanged, per the task's "don't touch what they asked
for" instruction), an orange that was already a deliberate, distinct hue
choice rather than one tuned against either basemap. If it reads faint in
person, the fix is the `fill-opacity` (already raised 0.22→0.30 here) rather
than the hue itself.

### What I could not verify

Per this environment's known limitation: **the Browser pane's WebGL context
initializes but never paints** — sampling the map canvas's centre pixel
returns `[0,0,0,0]` on both the old and new map, so DioceseMapLive always
falls back to rendering `DioceseMap.tsx` (the drawn SVG) visually in this
tool, regardless of which code path is actually live. Everything above that
required seeing the canvas itself was instead checked through the DOM,
console, and accessibility tree (which reflect the real MapLibre instance's
state, not a screenshot), or through unit tests against the extracted pure
functions. Specifically **not verified visually** and worth checking by hand
on a real device:

- That the positron tiles actually render light/plain as expected (only
  confirmed indirectly: the style fetched, parsed, and produced its own
  console warnings, and the attribution control lists OpenFreeMap/
  OpenMapTiles/OSM as its sources).
- The actual on-screen contrast of the polygon fill, route line and
  you-are-here marker against the real rendered basemap (the ground-colour
  approximation above is a stand-in).
- Pin sizing/spacing at 32px/22px looking right relative to each other and to
  the basemap's own label density at various zoom levels.
- The search bar's `backdrop-filter: blur(8px)` rendering (CSS backdrop
  filters aren't exercised by a DOM/console check).
- Touch-target comfort of the 22px coming-soon pins on an actual phone
  screen.

## Files touched

- `src/components/DioceseMapLive.tsx` — basemap, pins, popups, search,
  navigation control, you-are-here pulse
- `src/lib/mapSearch.ts` (new), `src/lib/mapSearch.test.ts` (new)
- `src/lib/mapMarkers.ts` (new), `src/lib/mapMarkers.test.ts` (new)
- `src/index.css` — live-map pin/popup/search CSS, one new token
- `PROJECT-STATE.md`
- `docs/reports/map-prototype-design-swap.md` (this file)

Not touched: `src/components/DioceseMap.tsx` (offline fallback, stays dark),
`src/components/CustomDioceseMap.tsx`, `src/components/MapTab.tsx`
(unrelated station-tour screen), `src/components/ParishCard.tsx`,
`src/data/diocese-parishes.json`, rosary/Firebase/auth/`firestore.rules`.
