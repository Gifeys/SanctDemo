# Rosary Mount Report

## What was copied

Source: `D:\SanctiWalk-Saved\rosary-web-app\` (untouched, not modified).

Destination: `D:\SanctDemo\public\rosary\`

Commands run:

```
mkdir -p "/d/SanctDemo/public/rosary/20 Mysteries"
cp -r "/d/SanctiWalk-Saved/rosary-web-app/20 Mysteries/Joyful" \
      "/d/SanctiWalk-Saved/rosary-web-app/20 Mysteries/Glorious" \
      "/d/SanctiWalk-Saved/rosary-web-app/20 Mysteries/Luminous" \
      "/d/SanctDemo/public/rosary/20 Mysteries/"
cp -r "/d/SanctiWalk-Saved/rosary-web-app/20 Mysteries/Sowwroful" \
      "/d/SanctDemo/public/rosary/20 Mysteries/Sorrowful"
cp "/d/SanctiWalk-Saved/rosary-web-app/index.html" "/d/SanctDemo/public/rosary/index.html"
```

Result: `du -sh /d/SanctDemo/public/rosary/` → `12M`. Folder listing under
`20 Mysteries/` in the copy: `Glorious`, `Joyful`, `Luminous`, `Sorrowful`
(renamed from `Sowwroful`).

The misspelling was fixed only in the copy. The original at
`D:\SanctiWalk-Saved\rosary-web-app\` still has the `Sowwroful` folder name,
untouched.

### Reference fix inside the copied index.html

```
grep -c "Sowwroful" "/d/SanctDemo/public/rosary/index.html"   # 6 before
sed -i 's/Sowwroful/Sorrowful/g' "/d/SanctDemo/public/rosary/index.html"
grep -c "Sowwroful" "/d/SanctDemo/public/rosary/index.html"   # 0 after
```

All 6 occurrences (the `SETS.sorrowful` image array and the `SET_IMAGE.sorrowful`
thumbnail) now point at `20 Mysteries/Sorrowful/...`.

## Component change

`src/components/DailyRosary.tsx` was rewritten to render an iframe pointing at
`/rosary/index.html`:

```tsx
export default function DailyRosary() {
  return (
    <div className="flex-1 flex flex-col h-full min-h-[600px] w-full">
      <iframe
        src="/rosary/index.html"
        title="Holy Rosary"
        style={{ border: 0 }}
        className="flex-1 w-full h-full"
      />
    </div>
  );
}
```

`App.tsx` calls `<DailyRosary />` with no props (`src/App.tsx:1008`), so no
props needed to be accepted for compatibility — the export signature is
unchanged (default export, zero required props).

### Layout / height strategy

`PhoneContainer.tsx` renders the app's tab content inside a fixed-height
shell:

- Smartphone mode: a `w-[385px] h-[780px]` mock phone frame; the scrollable
  "Virtual App Screen Canvas" div (`flex-1 bg-[#F5F5F0] flex flex-col
  overflow-y-auto`) is what actually receives `children`, i.e. `App.tsx`'s
  content, one level up from `DailyRosary`.
- Desktop/responsive mode: a `w-[460px] h-[750px]` frame with the same
  `flex-1 ... overflow-y-auto` content div.

In both cases the ancestor that bounds `DailyRosary` already has a concrete
pixel height (780px/750px minus header/status-bar/nav chrome) and is a flex
column with `overflow-y-auto`. A `100vh` value on the rosary wrapper would
measure the *browser viewport*, not this frame, and overflow it on desktop
where the frame is much shorter than the viewport.

Instead, `DailyRosary` uses `flex-1 h-full` on both the wrapper div and the
iframe: it stretches to fill whatever height its flex-column ancestor gives
it, exactly like the other tab panels in `App.tsx` do (e.g. the Home tab's
`<div className="flex-1 flex flex-col ...">`). `min-h-[600px]` is a floor so
the rosary isn't crushed to near-zero height in odd flex situations, without
imposing a viewport-relative height that could overflow the phone frame.

Measured iframe bounding box at 900x1000 viewport, smartphone-frame mode
(see Verification #7 below): iframe `bottom` = 829px, phone container
`bottom` = 905px — no overflow.

## `ROSARY_MYSTERIES` in `src/data.ts`

```
grep -rn "ROSARY_MYSTERIES" /d/SanctDemo/src/
```

Only reference outside `data.ts` itself was the old `DailyRosary.tsx` (now
rewritten and no longer importing it). No other component reads
`ROSARY_MYSTERIES`. Per instructions it was **left in `src/data.ts`
untouched** (not deleted) since the task said not to delete it regardless.

## Verification (dev server at http://localhost:5173)

Used the Browser pane (`mcp__Claude_Browser__*`) for navigation/screenshots,
and `javascript_tool` (DOM inspection + `.click()`) for reliable interaction,
since the `computer` click tool has been flagged unreliable on this project.
Flow: loaded the app, clicked "Start Sanctuary Walk" (church selection),
then clicked the "Rosary" tab button in the app's bottom nav via
`Array.from(document.querySelectorAll('button')).find(...)`.

1. **Rosary renders, not blank/404.** Screenshot after selecting the Rosary
   tab shows "The Holy Rosary" screen with mystery picker, language toggle,
   and BEGIN button. `iframe.contentDocument.title` → `"Holy Rosary"`.
   Confirmed via JS: `title` = `"Holy Rosary"`.

2. **Mystery image loads.** Iframe defaulted to the "Glorious" set (today's
   badge). Checked both `<img>` elements inside the iframe:
   - `#bg-img` (idle/unused): `naturalWidth: 0` (not the active image).
   - `#bg-img-next.on` (the active background): `src` attribute
     `"20 Mysteries/Glorious/The Resurrection.jpg"`, `currentSrc`
     `"http://localhost:5173/rosary/20%20Mysteries/Glorious/The%20Resurrection.jpg"`,
     `complete: true`, `naturalWidth: 1024`.
   The space in `20 Mysteries/` is correctly URL-encoded (`%20`) by the
   browser and Vite's static file server resolved it without any HTML edits
   — confirmed with an explicit check rather than assumed.

3. **All four mystery sets shown, TODAY badge present.** Screenshot shows
   Joyful, Sorrowful, Glorious, Luminous buttons; "Glorious" carries a
   "TODAY" sub-label (matches 2026-08-19, a Wednesday — Wednesdays are
   traditionally Glorious Mysteries in some devotional schemes; this is the
   client's own logic, not something added here).

4. **Language control present.** "English" / "Filipino" toggle buttons
   visible directly under the mystery picker in the screenshot.

5. **App nav still visible/functional.** Screenshot with the Rosary tab
   open shows the app's own bottom nav bar (Home / Walk / Rosary) rendered
   below the rosary iframe, unobstructed. Clicked the bottom nav's "Home"
   button via JS (`bottomNav.querySelectorAll('button')` scoped to the
   `nav.absolute.bottom-0` element, to avoid matching the closed sidebar's
   duplicate "Home" link) and confirmed the app navigated back to the Home
   tab (parish dashboard) in a follow-up screenshot.

6. **Console errors / external resources.** `read_console_messages` on the
   top-level page showed only Vite HMR debug lines and a React DevTools
   info line — no errors. Read `performance.getEntriesByType('resource')`
   from inside the iframe's own `contentWindow` (the top-level network
   inspector does not capture iframe sub-resource loads) and found:
   - `https://fonts.googleapis.com/css2?family=Montserrat...&family=Poppins...` (Google Fonts CSS)
   - `https://fonts.gstatic.com/s/montserrat/v31/....woff2` (an actual Montserrat font file, fetched as a result of the CSS above)
   - `http://localhost:5173/rosary/20%20Mysteries/Glorious/The%20Resurrection.jpg` (local, works)
   - `http://localhost:5173/rosary/music/ambient.mp3` (see below)

   There is also a `DESIGN_IMAGE` constant in the HTML
   (`https://lh3.googleusercontent.com/aida-public/...`) used only as a
   fallback candidate if a local mystery image fails to load
   (`candidates.push(SET_IMAGE[setKey], DESIGN_IMAGE)` at line ~1694); it
   was not requested in this run because the local image loaded fine.

   **Offline-readiness finding:** both Google Fonts requests
   (`fonts.googleapis.com` and `fonts.gstatic.com`) are genuinely external
   and would fail with no network — the app would fall back to its CSS
   `font-family` stack's next entry, a cosmetic-only degradation. The
   `DESIGN_IMAGE` Google-hosted fallback image would also fail offline, but
   only matters if a local mystery image fails to load first.

   **Separate, pre-existing gap (not something this task introduced):** the
   HTML references `music/ambient.mp3` (`const MUSIC_FILE =
   "music/ambient.mp3"`, with a stray Windows-path comment
   `D:\music\ambient.mp3` nearby) but no `music/` folder or `.mp3` file
   exists anywhere under the client's source
   `D:\SanctiWalk-Saved\rosary-web-app\` — only `index.html` and
   `20 Mysteries/` were delivered. The request
   `GET /rosary/music/ambient.mp3` returned HTTP 200, but that 200 is
   Vite dev server's SPA-fallback `index.html` (`Content-Type: text/html`,
   942 bytes — confirmed with `curl -D -`), not an actual audio file, so
   ambient/voice-guidance audio will silently fail to play both now and
   once deployed, network or no network. This is a missing asset in the
   client's own delivered files, not a mounting bug; flagging it since it
   affects the "voice guidance" feature called out as a reason for this
   swap.

7. **Iframe bounding box vs. phone container.** At a 900x1000 browser
   viewport in smartphone-frame mode:
   - iframe: `x:266.7, y:213, width:361, height:616, bottom:829`
   - `#phone-container` (PhoneContainer's outer wrapper): `bottom:905`
   Iframe bottom (829) is above the phone container's bottom (905) — no
   overflow. Screenshot at this viewport size shows the whole phone mockup,
   including its rounded frame, status bar, and bottom nav bar, with the
   rosary content properly contained inside the screen area and not
   spilling past the frame edges.

## Anything that broke

Nothing broke in the SanctDemo app itself. `npx tsc --noEmit` passes with no
errors. The only issue found is the pre-existing missing `music/ambient.mp3`
asset described above, which is a gap in the client's delivered files, not
something this mount introduced or could fix without altering their app.
