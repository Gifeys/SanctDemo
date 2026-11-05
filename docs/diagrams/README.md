# SanctiWalk — system documentation figures

## USE THESE (2026 revision)

The panel returned every diagram with one note: **not readable, and not
detailed enough to build a design from.** The `fig-*` sheets below are
the answer to that and are the ones to put in the paper.

Regenerate:

```
python scripts/build-diagrams.py     # the SVG sheets
python scripts/render-figs.py        # 2520px PNGs, one uniform width
python scripts/build-diagram-pdf.py  # the combined PDF
```

| Page | Figure | File | What it shows |
|---|---|---|---|
| 1 | 1 | `fig-1-use-case` | Use Case Diagram |
| 2 | 2 | `fig-2-flow-user` | Flow Chart (User Side) |
| 3 | 3 | `fig-3-flow-admin` | Flow Chart (Admin Side) |
| 4 | 4 | `fig-4-dfd-level0` | Data Flow Diagram (Level 0) |
| 5 | 5 | `fig-5-dfd-level1` | Data Flow Diagram (Level 1) |
| 6 | 6 | `fig-6-erd` | Entity-Relationship Diagram |
| 7 | 7 | `fig-7-hipo-user` | HIPO Chart (User Side) |
| 8 | 8 | `fig-8-hipo-admin` | HIPO Chart (Admin Side) |

These are the paper's OWN eight figures, with the paper's own numbering
and module breakdown. An earlier pass replaced them with a different
decomposition, which was wrong: the panel asked for these diagrams
made readable, not for a different set of diagrams.

All eight are collected in **`SanctiWalk-System-Diagrams.pdf`**, one
figure per page, every page A4 wide.

Each is written as an `.svg` and a 2× `.png`. Word takes either; the PNG
is safer for a printed appendix because it cannot be re-laid-out by a
different renderer or a missing font.

### Why the old ones were unreadable, and what changed

It was measurable. The old ERD put **79 labels at 9px on a 1460px
canvas** — about 4pt once the sheet is fitted to a landscape A4, half
the size of a footnote. Every figure had the same fault; the use case
diagram went down to 8.5px.

Enlarging the drawings would have changed nothing. The page is still
250mm wide, so a figure drawn twice as large prints at half the scale
and the type lands back where it started. **What matters is how much is
on one sheet.** So:

* no sheet is wider than 1320px, which maps to the usable width of a
  landscape A4
* no text is smaller than 15px — enforced inside `text()`, which
  raises an error rather than letting a caller shrink type to fit
* no sheet is taller than A4's proportions, so a printer never scales
  a page down — which would undo all of the above
* where a figure still carries a lot of text, the SHEET is drawn
  narrower (the ERD is 1120px, not 1320), which makes every label
  physically larger once the page is printed at a fixed width

At 1320px and 15px, the smallest text prints at roughly 8pt.

The generator also measures its own output and warns when content
reaches past the bottom of the sheet — a figure that is too tall is
silently cropped by the renderer, which is how the first ministry
flowchart lost everything below the decision diamond.

### The drawing style

Plain black line work on white with one accent, the way a
systems-analysis textbook prints a figure: square corners, hairline
rules, no shadows. Rounded boxes mean a process; squares mean an
external entity; the accent fill marks anything holding data. The
earlier set gave every shape its own pastel colour, which carried no
meaning a reader could use and had to survive a monochrome
photocopier anyway.

### Still current from the earlier set

| # | File | Figure |
|---|------|--------|
| 9 | `09-wireframes-app` | Wireframes — the pilgrim screens |
| 10 | `10-wireframes-admin` | Wireframes — the admin sections |
| 11 | `11-wireframes-ar` | Wireframes — the Unity AR application |

### Superseded

`01`–`08` are the returned figures. They are kept only so the revision
can be shown side by side; do not put them in the paper.

---

## What changed from the first set, and why

The original figures described a system that was never built. They are
superseded on these points:

**There is no SQL database.** The old ERD showed `MASS_SCHEDULE`,
`MYSTERY`, `ROSARY`, `AR_MARKER` and `MINISTRY_INTEREST` tables with
`INT` primary keys. SanctiWalk stores everything in Cloud Firestore,
which is a document database with string ids and no joins. Figure 5 is
the real model: nine collections, their actual fields, and the
references they hold.

**There is no authentication in the old diagrams at all.** Sign-in with
Google, the guest path, and the admin check now appear in figures 1, 2
and 8, because who you are decides what the app will let you do.

**The AR tour is a separate application.** The old Level 1 DFD had a
process "RUN AR EXPERIENCE" reading an `AR ASSETS DATA` store, as
though the web app rendered the tour. It does not: SanctiWalk hands
over by deep link to a Unity/ARCore application, and that application
carries its own station table, 3D models and narration compiled in, so
it works with no signal inside a church. Figures 3, 4, 8 and 11 show
the hand-off as what it is.

**Four features were missing entirely** — the AI scanner, the church
history quiz, in-app notifications, and parish analytics. All four are
built and all four now appear.

**The admin side was one box.** It is a four-section portal, scoped by
security rules to a single parish. Figures 2, 7 and 10 cover it.

**"Ministry interest" is now an application with a decision.** The old
model stored a name and a message. The real one is reviewed, approved
or rejected with a note, keeps an audit trail, and notifies the
applicant — which is the parish's actual daily work and the reason the
dashboard leads with it.

## Screenshots of the actual UI

The hand-drawn wireframes (figures 9–11) say what each screen is *for*.
These say what each screen *is*. Both are useful in a paper, and only
one of them can go out of date without anybody noticing, which is why
these are captured rather than drawn.

| # | File | Figure |
|---|------|--------|
| 12 | `12-ui-app.png` | Pilgrim screens, captured from the running app |
| 13 | `13-ui-phone.png` | Screens only the handset can show (camera, signed-in) |
| 14 | `14-ui-admin.png` | The admin portal, captured from the handset |

Regenerate:

```
node tools/capture-ui.mjs          # needs the dev server on :3000
bash tools/capture-phone.sh        # needs the handset on USB
python tools/make-ui-sheets.py     # composes docs/ui/*.png into sheets
```

Individual screenshots live in `docs/ui/`, so a single screen can be
dropped into the paper on its own.

### Why three sources and not one

`capture-ui.mjs` drives the real application in Edge at 390×844. It
covers most of the app, but it cannot cover all of it honestly:

- **No camera.** The Scan tab in a desktop browser only ever renders its
  failure state. A screenshot of that, captioned "the scanner", would be
  a lie.
- **Nobody signed in.** My Applications and Notifications do not exist
  until somebody has signed in and applied.
- **No administrator.** The admin portal appears only for a parish
  administrator, and shows nothing worth printing without real parish
  data behind it.

Those come off the Infinix, which has the camera, the account and the
parish's own records.

## The whole set as one document

```
python tools/build-docs.py
```

writes both of these to `docs/`, one figure per landscape page with its
number and caption:

- `SanctiWalk-System-Diagrams.pdf` — for printing or emailing
- `SanctiWalk-System-Diagrams.docx` — for pasting into the paper

It picks up whatever is in `docs/diagrams`, so regenerating a figure and
re-running is the whole update. A figure that has not been built yet is
skipped and named, rather than leaving a gap nobody notices.

## The screens as a reviewable PDF

```
node tools/capture-ui.mjs      # needs the dev server on :3000
bash tools/capture-phone.sh    # needs the handset on USB
python tools/blur-pii.py       # ALWAYS run after a handset capture
python tools/build-wireframe-pdf.py
```

`docs/SanctiWalk-App-Screens.pdf` — every screen, two to a page, in the
order the app is walked. Small enough to send.

`blur-pii.py` is not optional. The Me screen is captured from a real
signed-in account and carries a real name and email; the capture
overwrites the file each time, so the blur has to be re-applied after
every recapture or the next PDF leaks it again.

## The wireframes as a reviewable PDF

```
python tools/diagrams_wire.py          # rebuild the sheets
python tools/build-wireframes-pdf.py   # cut them into pages
```

`docs/SanctiWalk-Wireframes.pdf` — all 24 wireframes, two to a page:
15 user screens, the 4 admin sections, and the 5 AR screens.

It cuts the grid sheets back into their cells rather than re-rendering,
so the geometry here has to match `sheet()` in `diagrams_wire.py`. If
they drift apart the script refuses to crop rather than quietly
producing pictures of the wrong rectangles.
