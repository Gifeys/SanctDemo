# Task 7 Report — Mass schedule data + next-Mass calculation

## Status: DONE

## Transcribed schedule (from `MassSchedule.tsx` as it existed before this change)

Read verbatim off the previous JSX, day by day. Please check this against the parish
bulletin — this is the deliverable that matters most in this task.

| Day(s) shown in old UI | Time(s) shown in old UI |
|---|---|
| Monday & Tuesday | 6:00 AM |
| Wednesday - Saturday | 6:00 AM / 6:00 PM |
| Sunday | 6:00 AM, 7:30 AM, 9:00 AM, 10:30 AM, 4:30 PM, 6:00 PM |

Expanded into `MASS_SCHEDULES["route-mhcp"]` in `src/data.ts` as one entry per calendar
day (Monday through Sunday), since `nextMass` keys by individual day name:

- Monday: 6:00 AM
- Tuesday: 6:00 AM
- Wednesday: 6:00 AM, 6:00 PM
- Thursday: 6:00 AM, 6:00 PM
- Friday: 6:00 AM, 6:00 PM
- Saturday: 6:00 AM, 6:00 PM
- Sunday: 6:00 AM, 7:30 AM, 9:00 AM, 10:30 AM, 4:30 PM, 6:00 PM

No time was invented, tidied, or normalised. `MASS_SCHEDULES["route-src"]` (San Roque
Cathedral) is an empty array — the old UI never showed a schedule for San Roque, so
none was invented for it. `nextMass([], now)` returns `null` for that route, and the
UI already guards on `sundayTimes.length > 0` / an empty `weekdayRows` array, so an
empty schedule renders nothing rather than crashing.

## Files changed

- `src/lib/schedule.ts` (new) — ported `parseTimes`, `toMinutes`, `nextMass` from
  `D:\SanctiWalk-Saved\app\src\lib\schedule.js`, typed, with `nextMass(schedule, now)`
  taking the schedule array directly (no `church` wrapper). Both post-review behaviours
  preserved: same-day times are sorted by clock minutes before selection, and the
  day-offset loop runs `offset < 8` (not `< 7`) so a single-weekly-Mass schedule still
  resolves after that day's Mass has passed.
- `src/lib/schedule.test.ts` (new) — all 12 ported tests. Two tests were adapted to
  use the real MHCP schedule values (6:00 AM / 6:00 PM Wed–Sat, not the source repo's
  fictional 4:30 PM Saturday) so the suite exercises the parish's actual data; the
  *intent* of each assertion (same-day rollover, next-day rollover, future date,
  null-on-empty, 7-day wraparound, cross-day time ordering) is unchanged.
- `src/data.ts` — added `MASS_SCHEDULES: Record<string, { day: string; time: string }[]>`
  as described above.
- `src/components/MassSchedule.tsx` — replaced the hardcoded day/time rows and the
  Sunday grid with a render over `MASS_SCHEDULES["route-mhcp"]`. Consecutive weekdays
  sharing an identical time string are grouped into one row (mirroring the original
  "Monday & Tuesday" / "Wednesday - Saturday" groupings) via a small `groupWeekdayRows`
  helper; Sunday's times are parsed with `parseTimes` and mapped into the existing
  6-cell grid. All Tailwind classes, layout, header, confessions block, and contact
  card are untouched.

## Markup diff check

Loaded the running dev server, navigated Home -> Mary Help of Christians -> Mass
Schedule tab, and extracted the rendered text before/after. Output is character-for-
character identical to the previous hardcoded version:

```
Holy Mass Schedule
Monday & Tuesday
6:00 AM
Wednesday - Saturday
6:00 AM / 6:00 PM
Sunday Masses
LORD'S DAY
6:00 AM
7:30 AM
9:00 AM
10:30 AM
4:30 PM
6:00 PM
Sacrament of Reconciliation
Confessions are available every first Friday of the month, or you can inquire at the
Parish office to request an advanced schedule with our priest.
```

No difference found; nothing to report as unavoidable drift.

## `nextMass` sanity check

Run against `MASS_SCHEDULES["route-mhcp"]` with `now = new Date()` at the time of
verification: **Wednesday 2026-08-19, 19:29 local (Asia/Manila, UTC+8)**.

Result:

```json
{ "day": "Thursday", "time": "6:00 AM", "date": "2026-08-20T06:00:00+08:00" }
```

This is correct: at 7:29 PM Wednesday, both Wednesday Masses (6:00 AM and 6:00 PM)
have already passed, so the next Mass is Thursday's 6:00 AM.

## Verification

- `npm test` → **44 passing** (32 baseline + 12 new).
- `./node_modules/.bin/tsc --noEmit` → exit 0.
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` → `200`.
- Visual check in the running dev server (browser pane) confirms the Mass Schedule
  screen for Mary Help of Christians renders identically to before.

## Concerns

- None blocking. One judgment call: the original test suite's fixture schedule (from
  `schedule.test.js`) used a fictional church with Saturday 4:30 PM, which doesn't
  match this parish's real Wed–Sat 6:00 AM/6:00 PM data. I adapted the two affected
  test cases' expected times to the real MHCP schedule (still Saturday, still same-day
  vs. rollover intent) rather than importing a fictional schedule alongside the real
  one — flagging this so it can be reviewed if a byte-for-byte port of the original
  fixtures was expected instead.
