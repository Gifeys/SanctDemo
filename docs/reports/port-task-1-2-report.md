# Port Tasks 1 & 2 — Report

## Task 1: Add a test runner

### Commands and output

```
$ ./node_modules/.bin/tsc --noEmit
EXIT CODE: 0
```

Baseline typecheck recorded **before** any changes: exit 0, zero errors. This is the baseline
against which all later tasks must be compared.

```
$ npm install -D vitest@^3 jsdom @testing-library/react @testing-library/jest-dom
added 91 packages, and audited 378 packages in 2m
found 0 vulnerabilities
```

`bun.lock` was not touched; `package-lock.json` was updated by npm as expected.

Created `vitest.config.ts` and `src/lib/smoke.test.ts` exactly per the plan. Added to
`package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

```
$ npm test
✓ src/lib/smoke.test.ts (1 test)
Test Files  1 passed (1)
     Tests  1 passed (1)
```

```
$ ./node_modules/.bin/tsc --noEmit
EXIT: 0
```

No new type errors introduced.

**Commit:** `7e01c6cfef346a63aad4a39fe1c2bbc248ed8ccc` — "chore: add Vitest test runner"
(4 files changed: `package.json`, `package-lock.json`, `vitest.config.ts`,
`src/lib/smoke.test.ts`)

Note: used `./node_modules/.bin/tsc --noEmit` throughout, not `npx tsc --noEmit`, per the
task instructions (npx resolves to an unrelated `tsc` package in this environment).

## Task 2: Port the distance maths

### Source read

Read `D:\SanctiWalk-Saved\app\src\lib\geo.js` (33 lines, exports `haversineMeters` and
`nearestLiveChurch`) and `D:\SanctiWalk-Saved\app\src\lib\geo.test.js` (6 tests total: 3 for
`haversineMeters`, 3 for `nearestLiveChurch`).

Per the task instructions, **only `haversineMeters` was ported**. `nearestLiveChurch` depends
on `getLiveChurches()` from a `./churches` module that does not exist in this repo — the
equivalent (`nearestLiveParish`, parameterized over a passed-in parish list rather than an
imported module) is scheduled for Task 4 once `Route` carries coordinates. The corresponding
3 `nearestLiveChurch` tests were left unported, as instructed.

### Step-by-step

1. Created `src/lib/geo.test.ts` with the 3 `haversineMeters` tests (same-point exactly 0,
   0.001-degree latitude step between 105m and 117m, symmetry), converted to TypeScript with
   no logic changes.
2. Ran `npm test src/lib/geo.test.ts` — confirmed failure: `Failed to resolve import "./geo"`.
3. Created `src/lib/geo.ts` with `export interface Coordinates { lat: number; lng: number }`
   and `haversineMeters(a: Coordinates, b: Coordinates): number`, ported verbatim from the
   source with type annotations added, exactly per the plan's Step 4 code block.
4. Deleted `src/lib/smoke.test.ts` (superseded by real tests).
5. Ran `npm test`:

```
✓ src/lib/geo.test.ts (3 tests)
Test Files  1 passed (1)
     Tests  3 passed (3)
```

6. Ran `./node_modules/.bin/tsc --noEmit` — exit 0, no errors (baseline unchanged).
7. Sanity-checked the dev server was unaffected: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` returned `200`.

**Commit:** `24d6cbc037693673d16dd4ce374a50df41f58f3e` — "feat: port haversine distance
calculation" (3 files changed: added `src/lib/geo.ts`, `src/lib/geo.test.ts`; deleted
`src/lib/smoke.test.ts`)

## Deviations from the plan

None. Both tasks executed exactly as specified. No test was weakened; no implementation
needed adjustment — the ported `haversineMeters` code passed all three tests on the first run.

## Summary for next tasks

- `npm test` currently passes with **3 tests**.
- Typecheck baseline (Task 1, reconfirmed after Task 2): **exit 0, zero errors**. Any error
  appearing in later tasks is new.
- `Coordinates` is now defined in `src/lib/geo.ts` as
  `export interface Coordinates { lat: number; lng: number }`, ready to be imported by Task 3
  (`presence.ts`) and beyond.
- `nearestLiveChurch`/`nearestLiveParish` is intentionally not yet ported — that is Task 4's
  job, once `Route` in `src/types.ts` carries `coordinates`, `geofenceRadius`, and `status`.
