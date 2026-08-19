# Task 9 report — diocese map with calibrated pins

## What was built

- `src/components/DioceseMap.tsx` — new component. Ports the hand-drawn
  illustration from `D:\SanctiWalk-Saved\app\src\components\DioceseMap.jsx`
  (Manila Bay, three land areas labelled NAVOTAS/MALABON/CALOOCAN, the
  Tullahan river, three orientation roads), adapted to SanctDemo's data
  model (`ROUTES`/`Route` instead of `getChurches()`) and to plain
  callback-prop selection instead of `react-router`'s `<Link>` (SanctDemo
  has no router).
- `src/index.css` — added a `--color-brand-success` token and a `.dmap*`
  rule block (land/water/river/road/area-label/pin/you-are-here styling +
  the `dmap-pulse` keyframe), all built from the existing
  `--color-brand-*` variables via `color-mix()`. No new component CSS file
  — folded into the existing stylesheet per the plan's instruction.
- `src/App.tsx` — imports `DioceseMap` and renders it inside the existing
  "no church selected" view (`selectedChurchId === null` branch), in a new
  white card placed between the instructions paragraph and the existing
  church-selector card list. Tapping a live pin calls the same
  `handleOpenTourFromPresence` handler `PresenceSheet`'s "Open Tour" button
  already uses (`setSelectedChurchId(id); setActiveTab("navigator")`).

## Where it went, and why

The church-selector screen (`selectedChurchId === null` in `App.tsx`,
around line 529) is exactly "the diocese-level view before choosing a
church" the plan describes — it's the screen a pilgrim lands on before any
church is picked, and it already lists both parishes as cards. The map was
added there, above the existing cards, as a second way to reach the same
selection: no navigation structure, tab set, or state shape changed.
`MapTab` (the inside-one-church station walk) and its state were left
untouched.

## Verification (at 375x812, dev server on :5173)

Used `javascript_tool` (`.click()` / `dispatchEvent(new MouseEvent(...))`
and `getBBox()`/`getComputedStyle()` reads) for all measurements —
`computer` clicks were not used, per the flagged unreliability.

1. **Pin positions** — read via `getBBox()`/`transform` on the live-pin
   `<g>` elements:
   - Mary Help of Christians: `translate(184.400..., 308.888...)`
   - San Roque Cathedral: `translate(174.399..., 217.777...)`
   Matches the known-good reference exactly. San Roque's `y` (217.8) is
   smaller than Mary Help's (308.9), i.e. San Roque renders north of Mary
   Help — correct.

2. **Label overlap / clipping** — pairwise `getBBox()` comparison across
   both pin labels and all three area labels (5 text nodes, 10 pairs
   checked): **0 overlaps, 0 clipped** (all boxes within `x:[0,300]`,
   `y:[0,400]`).
   - First pass (before adjustment) found one real overlap: Mary Help's
     label (anchored below its pin, low in the frame) collided with the
     NAVOTAS area label. Fixed by nudging `NAVOTAS`'s `y` from 316 to 298
     — a ~19px shift, well within the "suggestive, not surveyed" land
     shape. Re-measured clean afterward.

3. **Rendered font size** — rendered SVG width was 247px against the
   300-unit viewBox, i.e. scale ≈ 0.8233. Declared `font-size: 21px` →
   **rendered ≈ 17.29px**, clearing the 14px floor. This is the smallest
   font size in the map (both pin labels and area labels share it).

4. **Color literals** — `grep -n "#\|rgb(\|hsl("` on `DioceseMap.tsx`: no
   matches. Same grep restricted to the new `.dmap*` block in `index.css`:
   no matches (the only hex in that file is the pre-existing token
   definitions in `:root`, including the new `--color-brand-success: #1F7A54`
   *definition*, which is the token source itself, not a literal used on
   an element).

5. **"You are here" dot** — set the simulator to "At San Roque Cathedral"
   via its radio input, then navigated back to the diocese map ("Switch
   Parish Church"). `.dmap__you` rendered at `cx=174.399..., cy=217.777...`
   — exactly San Roque's projected position — with `.dmap__you-ring`
   present and `animation-name: dmap-pulse` confirmed via
   `getComputedStyle`.

6. **Tap-to-open** — dispatched a `click` on the San Roque `<g role="button">`
   pin; the app navigated into San Roque Cathedral Parish Tour's station
   view ("SANCTI TRAIL VISUALIZER", "Cathedral Central Sanctuary" station
   content rendered), confirming the tap opens that parish's tour.

7. **Build/test health** — `npm test` → 44 passing (unchanged).
   `./node_modules/.bin/tsc --noEmit` → exits 0. Browser console: no
   errors logged during any of the above.

## Notes / concerns

- Only two parishes exist today, so the `coming_soon` (dimmed,
  non-tappable, `<title>`-only) rendering path exists in code but has no
  current data to exercise it — this matches the plan's expectation.
- The label-collision fix (nudging `NAVOTAS`) was found by measurement,
  not by eyeballing — consistent with the plan's warning that this exact
  kind of collision is what sank the original 8-pin version.
