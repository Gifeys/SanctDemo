# SanctiWalk — system documentation figures

Regenerate everything:

```
python tools/diagrams_flow.py
python tools/diagrams_dfd.py
python tools/diagrams_model.py
python tools/diagrams_wire.py
python tools/render-diagrams.py
```

Each figure is written as an `.svg` and a 2× `.png`. Word takes either;
the PNG is the safer one for a printed appendix, because it cannot be
re-laid-out by a different renderer or a missing font.

| # | File | Figure |
|---|------|--------|
| 1 | `01-system-flowchart` | System flowchart — the pilgrim's path through the app |
| 2 | `02-admin-flowchart` | Admin flowchart — the parish office's path |
| 3 | `03-dfd-level0` | Context diagram (Level 0 DFD) |
| 4 | `04-dfd-level1` | Level 1 DFD — six processes against six stores |
| 5 | `05-erd-firestore` | Data model — the Cloud Firestore collections |
| 6 | `06-hipo-user` | User HIPO chart |
| 7 | `07-hipo-admin` | Admin HIPO chart |
| 8 | `08-use-case` | Use case diagram |
| 9 | `09-wireframes-app` | Wireframes — all fifteen pilgrim screens |
| 10 | `10-wireframes-admin` | Wireframes — the four admin sections |
| 11 | `11-wireframes-ar` | Wireframes — the Unity AR application |

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
