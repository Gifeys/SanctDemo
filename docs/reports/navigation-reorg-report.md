# Navigation & Dashboard Reorganisation — Verification Report

Date: 2026-08-23
Branch: `main`

## Summary of changes

- `src/App.tsx`: bottom nav rebuilt to five tabs (Home, Map, Scan, Pray, Me);
  hamburger sidebar deduplicated, renamed, and split into real features +
  a separated "Demo Tools" section; home tab now delegates to a new
  `Dashboard` component; new `me` tab delegates to a new `MeTab` component;
  dead imports (`ExploreTab`, `MapTab`, `CompanionTab`) removed since they
  were unused and unreachable from any nav path; `PwaBanner` (previously
  imported but never rendered) is now wired up as the Demo Tools "PWA
  Workspace" entry, matching the `pwa-devkit` tab id that already existed
  in the `activeTab` union but was never used.
- `src/components/Dashboard.tsx` (new): the parish dashboard, extracted out
  of `App.tsx` because it grew a third section (TODAY) on top of the
  existing two (AT PARISH / EVERY DAY) and `App.tsx` was already large.
  Contains the Mass countdown, today's Rosary mystery, and today's parish
  event, ahead of the existing parish grid and diocese-wide section.
- `src/components/MeTab.tsx` (new): the fifth bottom-nav tab. Wraps the
  existing `LoginModal` unmodified and adds progress stats, the pilgrim's
  own applications, and quick links to Change Parish and Rosary Settings —
  all built from state `App.tsx` already tracked.
- Rosary internals (`public/rosary/`, `RosarySettingsModal.tsx`,
  `rosarySettings.ts`), Firebase, auth, and `firestore.rules` were not
  touched.

## 1. Bottom navigation — five tabs

Measured via `nav.querySelectorAll('button')` in the running app (DOM
inspection, not `computer` clicks):

```
["Home", "Map", "Scan", "Pray", "Me"]
```

Scan is the 3rd of 5 (dead centre), rendered as a raised, filled circular
button (`-translate-y-3`, filled `bg-[#5A5A40]` pill) with its own visible
text label underneath — no icon-only control.

## 2. Each tab opens its screen

Verified with `.click()` via `javascript_tool` (not `computer`), reading
DOM content after each click:

| Tab | Result | Evidence |
|---|---|---|
| Home | PASS | Dashboard renders: "TODAY / NEXT MASS AT MARY HELP OF CHRISTIANS PARISH / in 1 hour / Today, 6:00 PM / TODAY'S MYSTERY / The Glorious Mysteries / AT MARY HELP OF CHRISTIANS PARISH …" |
| Map | PASS | `.dmap-live` element present (MapLibre live diocese map mounts) |
| Scan | PASS | "AUGMENTED REALITY / AR Tour / Point your camera…" renders |
| Pray | PASS | `<iframe title="Holy Rosary" src=".../rosary/index.html">` present and loaded |
| Me | PASS | LoginModal renders ("Pilgrim Profile / Sign In / Connect your SanctiWalk profile…") plus progress stats card |

No console errors at any point (`read_console_messages` — empty).

## 3. Sidebar (hamburger) after reorganisation

Full list, read from the DOM (excludes the icon-only close button):

```
Change Parish
Mass
History
Ministries
Sacraments
Quiz
Rosary Settings
── (divider) ──
Demo Tools
  Location Simulator
  Smartphone Frame
  Full Responsive
  Online (Sim)
  PWA Workspace
```

("Admin Panel" appears in this list too, but only when `isAdmin || isLoggedIn`
— hidden while signed out, same conditional as before.)

- **No duplicate names**: "Mass" appears once as a nav label (also as a
  dashboard grid card with the same word — same feature, same name, two
  entry points, not a duplicate-name violation).
- **No two entries doing the same job**: "Switch Parish Church" (reset to
  church selector) and "Change Home Parish" (open the parish-picker modal)
  are merged into one "Change Parish" entry that opens the modal — the
  modal already updates both the home parish and the active parish and
  returns to Home, so the second entry's job was fully redundant.
- **Demo Tools grouped and separated**: divider + "DEMO TOOLS" heading at
  the bottom of the drawer, above the sidebar footer, containing exactly
  the four simulator/frame controls plus PWA Workspace — none require a
  gesture, all one tap from the hamburger.
- Home, Map (navigator), Scan (ar), Pray (rosary) and Me are intentionally
  **not** repeated in the sidebar — they're one tap away on the bottom bar,
  which is the point of the reorg.

Renames applied everywhere the label appears (nav, sidebar, dashboard
cards): Mass, History, Ministries, Sacraments, Rosary (bottom tab is
"Pray", screen content is the Rosary), Sign In, Quiz, Home, Map, Change
Parish. Screen *headings* were left in their fuller form per the spec
(e.g. `MassSchedule.tsx`'s own page title still reads "Mass & Sacraments",
`SacramentsTab.tsx`'s reads "Sacraments Office") — only navigation labels
were shortened.

**Other verbose/duplicated labels found, not in the original table:**
the outer workspace chrome (`App.tsx`'s "SanctiWalk Core Workspace" header,
"Return to Church Selection" button) and `PhoneContainer.tsx`'s capstone
copy were left as-is — these are the developer/demo workspace shell around
the phone, not the pilgrim's in-app navigation, so they're out of scope
for "navigation labels." Within the pilgrim's app, no further duplicates
were found beyond the ones listed in the spec's table.

## 4. Dashboard — TODAY first

Confirmed via DOM read after navigating Home: TODAY section renders above
"AT {PARISH}", which renders above "EVERY DAY".

**Countdown text rendered** (Mary Help of Christians Parish, Sunday 2026-08-23,
schedule has a 6:00 PM Sunday Mass, schedule marked verified):

```
in 1 hour
```
(with "Today, 6:00 PM" beneath it). Format logic (`formatCountdown` in
`Dashboard.tsx`): minutes when under an hour ("in 25 minutes"), rounded
hours under a day ("in 3 hours"), rounded days beyond that — matches the
spec's examples exactly.

Today's Mystery card shows "The Glorious Mysteries" (Sunday's mystery in
the standard weekday cycle) and links to Pray. No parish event was
scheduled for today in the seeded announcements, so the "Happening Today"
card correctly does not render (it's conditional on a same-day match).

## 5. Switching parish

Used the Location Simulator ("At San Roque Cathedral") via `.click()`,
then re-read the dashboard:

- AT-PARISH heading, map, grid, and bulletin all updated to "San Roque
  Cathedral Parish."
- TODAY's Mass line updated to that parish: **"in 26 minutes" / "Today,
  5:00 PM"**, and correctly showed San Roque's unverified-schedule warning
  ("Sample schedule — not yet confirmed with the parish…"), since that
  parish's `scheduleVerified` is `false` in `data.ts` (Mary Help of
  Christians' is `true`, and no warning showed for it).
- EVERY DAY section text was byte-identical before and after the switch
  (Daily Rosary button + the same Verse of the Day quote/citation) —
  confirmed by reading `innerText` from the "EVERY DAY" heading onward in
  both states.
- Simulation was reset to "Off — use real GPS" afterward.

## 6. Type floor & contrast

Smallest rendered font size measured via `getComputedStyle` across the
bottom bar + Home dashboard: **14px** (section labels like "TODAY", "AT
{PARISH}" headings, the date line) — at the floor, never below it.
Interactive bottom-nav labels measured **16px** (`text-base`), matching
the "interactive labels 16px minimum" rule; secondary text (times, captions)
measured 15px; nothing under 14px was found in the bottom bar, Dashboard,
Me tab, or the rewritten sidebar block.

Contrast (WCAG relative-luminance ratio, computed from actual rendered
`background-color`/`color`):

| Pair | Ratio | Pass (AA 4.5:1) |
|---|---|---|
| Scan pill icon (white on `#151B53`) | 15.99:1 | Yes |
| Active nav label (`#151B53` on `#EBEBE0` bar) | 13.32:1 | Yes |
| Inactive nav label (`#666655` on `#EBEBE0` bar) | 4.86:1 | Yes |

Zero contrast failures found among the elements measured. All colours used
in the new/changed UI reuse the app's existing bridged hex-bracket classes
(`#5A5A40`, `#4A4A35`, `#8A8A70`, `#EBEBE0`, `#D6D6C2`, `#33332D`, `#5FC7DE`,
etc.), which `src/index.css` maps to the `--color-brand-*` variables — no
new colour literal was introduced outside that established, index.css-owned
mapping.

## 7. 375×812 tab-label fit

The app's mobile mockup (`PhoneContainer.tsx`) renders at a fixed 385px
device width regardless of the outer browser viewport (a design-mockup
frame, not a fluid layout), so the browser was still resized to 375×812
per the instructions, and the bottom nav's actual rendered geometry inside
that frame was measured directly:

- Nav bar inner width: 319px, 5 buttons at 62px each.
- Per-label rects: all `getClientRects().length === 1` (no wrapping) for
  every one of the five labels.
- Slack (button width − label text width) per tab: Home 12px, Map 26px,
  Scan 22px, Pray 25px, Me 37px.
- **Tightest case: 12px of slack ("Home"), no wrapping or overflow.**

## 8. Automated checks

```
npm test        →  6 files, 44 tests passed
tsc --noEmit    →  exits 0, no errors
```

No console errors were observed at any point during manual verification
(`read_console_messages` and `preview_logs` both empty of errors).
