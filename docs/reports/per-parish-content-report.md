# Per-parish content fix, dashboard split, and three removals

## Bug 1: parish content now follows the active parish

Four components previously ignored the app's active parish and rendered
Mary Help of Christians' content (or a fixed internal tab) regardless of
which parish the pilgrim was actually at. All four now take an explicit
`parish: Route` prop, sourced from `App.tsx`'s existing `activeChurchRoute`
(`ROUTES.find(r => r.id === selectedChurchId) || ROUTES[0]`).

### Made per-parish

- **`src/components/MassSchedule.tsx`** — no longer hardcodes
  `MASS_SCHEDULES["route-mhcp"]`. Looks up `MASS_SCHEDULES[parish.id]`,
  renders that parish's photo, name, and (new) contact block from the new
  `PARISH_CONTACTS` map in `src/data.ts`. When a parish has no schedule at
  all, shows "Mass schedule not yet published for this parish." instead of
  a blank table or another parish's times.
- **`src/components/ChurchHistory.tsx`** — the internal
  `useState<"mhcp" | "src">` toggle is gone. The real history text for both
  parishes (already written, just wired wrong) now lives in a
  `PARISH_HISTORY` map keyed by route id, and the component renders
  whichever entry matches the `parish` prop. A parish with no entry gets an
  honest "History not yet documented for {parish}" card rather than
  silently falling back to Mary Help's text.
- **`src/components/MinistriesTab.tsx`** — now receives `parish` and shows
  it in the application-confirmation text ("sent to the {parish} parish
  office") instead of a hardcoded reference to Father Paul Woo. The
  `MINISTRIES` list itself is not parish-specific data anywhere in this
  codebase, so it stays shared — see below.
- **`src/components/SacramentsTab.tsx`** — same treatment: takes `parish`,
  booking confirmation now says "{parish} Parish Office" instead of a
  hardcoded "Maypajo Parish Office".

### Left shared, but now labelled as shared

- **Ministries** (`MINISTRIES` in `src/data.ts`) and **Sacraments**
  (`SACRAMENTS`) are genuinely diocese-wide: there is no per-parish
  ministry roster or per-parish sacrament-requirement data anywhere in this
  codebase, and canon law requirements for e.g. Baptism do not change
  parish to parish (the brief's own example). Rather than inventing
  per-parish variants, both tabs now show an explicit info banner —
  "These ministries are offered diocese-wide. Applying below will route
  your application to **{parish}**, your current parish." (and the
  equivalent wording for Sacraments) — so the UI is honest about what's
  shared vs. what's parish-specific, instead of silently implying the list
  belongs to whichever parish you're standing at.
- The **Sacrament of Reconciliation** callout inside `MassSchedule.tsx` is
  likewise a diocese-wide practice and is now labelled as such in its own
  copy.

### `App.tsx` wiring (~line 1128 onward)

```tsx
{activeTab === "mass" && <MassSchedule parish={activeChurchRoute} />}
{activeTab === "history" && <ChurchHistory parish={activeChurchRoute} />}
{activeTab === "ministries" && <MinistriesTab parish={activeChurchRoute} onAddApplication={handleAddApplication} />}
{activeTab === "sacraments" && <SacramentsTab parish={activeChurchRoute} onAddApplication={handleAddApplication} />}
```

## Client addition: mock San Roque Mass schedule, clearly flagged

`src/data.ts`'s `MASS_SCHEDULES` is now `Record<string, ParishMassSchedule>`
where `ParishMassSchedule = { scheduleVerified: boolean; schedule: {day,
time}[] }` — the same verified/unverified pattern already used for
`coordinatesVerified` elsewhere in this codebase.

- `route-mhcp`: `scheduleVerified: true` — unchanged real times, scraped
  from the diocese site (Mon/Tue 6:00 AM; Wed–Sat 6:00 AM & 6:00 PM; Sun six
  Masses 6:00 AM–6:00 PM).
- `route-src`: `scheduleVerified: false` — a **placeholder** schedule,
  deliberately different in shape from Mary Help's so the parish switch is
  unmistakable: Mon–Fri **evening only** (6:00 PM), Saturday 6:00 AM & 5:00
  PM, Sunday **four** Masses (6:30 AM, 8:00 AM, 10:00 AM, 5:00 PM) instead
  of six. A comment block directly above the entry in `data.ts` explains
  it's a stand-in and how to replace it (drop in real times, flip the flag
  to `true`, nothing else changes).

**UI badge**: `MassSchedule.tsx` renders an amber warning row — "Sample
schedule — not yet confirmed with the parish. Please call ahead before you
go." — positioned directly above the weekday/Sunday rows (not buried at the
bottom), 14px bold text, amber-50/amber-300/amber-900 tokens already used
elsewhere in this file for AA contrast. It only renders when
`scheduleVerified === false` and the schedule is non-empty. Verified in the
browser: **the badge appears for San Roque and does not appear for Mary
Help.**

`PresenceSheet.tsx`'s "Next Mass" quick-glance label also got the same
treatment (`nextMassLabel` now appends "(sample, unconfirmed)" when the
parish's schedule is unverified) — that sheet is exactly the "tells someone
to attend a Mass" surface Bug 1 was about, so it couldn't be left silently
stating mock times as fact either.

## Bug 2: dashboard split into "AT {parish}" and "EVERY DAY"

`App.tsx`'s Home tab now has two explicitly labelled sections:

1. **"AT {ACTIVE PARISH NAME}"** (e.g. "AT SAN ROQUE CATHEDRAL PARISH") —
   contains the diocese map card (see removal #1 below), the quick-nav grid
   (Mass Schedule, Church History, Volunteer Guilds, Sacraments Office, AR
   Tour, **The Walk** — added as a new grid button), and the parish's
   upcoming-events bulletin.
2. **"EVERY DAY"** — Daily Rosary and Verse of the Day, visually separated
   below a border.

Verified in the browser by switching the Location Simulator from Mary Help
to San Roque: the "AT ..." heading and everything under it changed; "EVERY
DAY" and its two cards did not.

## Three removals

1. **Pilgrimage Scanner card → diocese map.** The old "PILGRIMAGE SCANNER /
   Scan Book / Altar" card on the dashboard is gone. `DioceseMapLive` now
   renders in that slot, wired to `handleOpenTourFromPresence` (same handler
   the Walk tab's map already used). Verified: the dashboard now shows the
   live map with both parish pins immediately under the "AT ..." heading.
2. **Pilgrim Station Comments block removed from the Walk tab** (was ~line
   1064, "DYNAMIC STATION COMMENT FORUM"). Grepped the whole `src` tree for
   `commentsByStation`, `handlePostComment`, and `activeCommentInput`
   afterward — no other file references them, only their original
   declarations in `App.tsx` (state at lines ~111/125, handler at ~483).
   Per instructions I left that state and handler in place rather than
   deleting it, since removing unused-but-harmless code wasn't the ask; it
   is now dead code with no UI trigger, worth a follow-up cleanup if wanted.
3. **Bottom nav Rosary button removed.** Bottom nav is now exactly **Home |
   Walk** — Daily Rosary lives in the "EVERY DAY" dashboard section instead.

## Welcome screen removed

`HomeParishChooser.tsx` is deleted and its import removed from `App.tsx`.
`homeParishId`/`selectedChurchId` now initialize with
`loadHomeParishId(...) ?? firstLiveParishId()` (a new small helper that
picks `ROUTES.find(r => r.status !== "coming_soon")`), so a first run — or
`localStorage` cleared — goes straight to that parish's dashboard. No
gating `if (homeParishId === null) return <HomeParishChooser .../>` remains.
`saveHomeParishId`/`loadHomeParishId` and the sidebar's "Change Home Parish"
entry (`ChangeParishModal`) are untouched and still work — verified in the
sidebar listing after clearing storage.

Verified: `localStorage.clear(); location.reload()` in the running app goes
straight to the Mary Help of Christians dashboard (the first live route),
no welcome screen at any point.

## Verification

- **Mass Schedule, before/after** (see also the "client addition" section
  above for the exact text):
  - Mary Help of Christians: "Monday & Tuesday — 6:00 AM", "Wednesday -
    Saturday — 6:00 AM / 6:00 PM", Sunday six times ending 6:00 PM. No
    unverified badge.
  - San Roque Cathedral: "Sample schedule — not yet confirmed with the
    parish. Please call ahead before you go." badge, then "Monday - Friday —
    6:00 PM", "Saturday — 6:00 AM / 5:00 PM", Sunday four times (6:30 AM,
    8:00 AM, 10:00 AM, 5:00 PM). Confirmed different from Mary Help's.
- **History**: Mary Help shows the Maria Auxiliadora / 1952 text; San Roque
  shows the 1815 / Philippine Revolution / San Roque (Saint Roch) text. No
  toggle — content follows the active parish automatically.
- **Ministries / Sacraments**: same lists for both parishes (by design,
  diocese-wide), but the confirmation copy and the new info banner now name
  the active parish ("San Roque Cathedral Parish", "Mary Help of Christians
  Parish") instead of a hardcoded parish.
- **Dashboard headings**: "AT MARY HELP OF CHRISTIANS PARISH" /
  "AT SAN ROQUE CATHEDRAL PARISH" and "EVERY DAY" confirmed via
  `get_page_text` before and after switching the Location Simulator; only
  the first section's content changed.
- **Bottom nav**: exactly two buttons, "Home" and "Walk" — confirmed via
  `read_page`.
- **Scanner card**: gone; `DioceseMapLive` renders in its place on the
  dashboard — confirmed visually and via `get_page_text` (map region with
  Malabon/Navotas/Caloocan labels and both parish pins appears directly
  under the "AT ..." heading).
- **Station comments**: confirmed gone from the Walk tab's page text.
- **Fresh load**: confirmed dashboard-first with `localStorage` cleared, no
  welcome screen.
- **`npm test`**: 44 passed (6 files) — unchanged.
- **`./node_modules/.bin/tsc --noEmit`**: exits 0, no errors.
- **Console**: no errors observed during manual verification (checked via
  `read_console_messages` with `onlyErrors: true`).

Method note: verification used `javascript_tool`'s `.click()` on elements
located by `document.querySelectorAll` (button text match) and by
`read_page` ref for the Location Simulator's radio inputs (clicked via the
`computer` tool since native `<input type="radio">` needs a real click
event, not `.click()` racing React's controlled state) — not the `computer`
tool's coordinate clicks, which the brief flagged as unreliable here.
