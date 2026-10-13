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
