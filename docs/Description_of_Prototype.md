# Description of Prototype

This part includes the system requirements, the preliminary design, and how
the system is being evaluated and tested.

Every figure marked **(measured)** is read from the released build itself —
the compiled SDK level, the packaged architecture, the file size of the
installer. Figures marked **(engineering judgement)** are the proponents'
estimate from what the system actually loads; they have not been benchmarked
on a handset at that exact specification, and are stated as estimates rather
than findings.

---

## 1. What SanctiWalk Is Made Of

SanctiWalk is delivered as **two Android applications and one web
application**, because they have genuinely different needs.

**The pilgrim application** is a React and TypeScript web application
packaged for Android with Capacitor. One codebase serves both the browser and
the phone. It carries the parish bulletin, the Mass schedule, church history
with audio narration, the guided Rosary, the diocesan map with walking
directions, the camera scanner and Ask Sancti.

**The AR heritage tour** is a separate Unity application using Google ARCore.
It is separate by necessity: ARCore's world tracking keeps a station anchored
to a place after the printed trigger image has left the camera's view, and no
web API offers that. SanctiWalk launches it through the custom URL scheme
`sanctiwalkar://`, passing the parish identifier so the correct church's
content loads. One AR installation serves both parishes.

**The parish administration console** is a web application, served from a
non-obvious path, through which parish staff maintain Mass times,
announcements, ministry and sacrament availability, and applications.

Behind all three sit a Node.js backend for the artificial-intelligence
endpoints and Google Firebase for authentication, the database and storage.

---

## 2. Minimum System Requirements

### 2.1 For the pilgrim, SanctiWalk without the AR tour

| Requirement | Specification | Basis |
|---|---|---|
| Operating System | Android 7.0 (Nougat) or later | **measured** — compiled with minimum SDK 24 |
| CPU | Quad-core ARM | engineering judgement |
| RAM | 2 GB | engineering judgement |
| Storage | 150 MB free | **measured** — the installer is 63.3 MB |
| Camera | Any rear-facing camera, for the scanner only | |
| Network | Required for the scanner, Ask Sancti, the map and live parish updates | |

Mass times, church history and the Rosary continue to work with no signal.

### 2.2 For the pilgrim taking the AR heritage tour

The AR tour raises the floor considerably. **These are the figures that
actually decide whether a visitor can take the tour.**

| Requirement | Specification | Basis |
|---|---|---|
| Operating System | Android 10 or later | **measured** — compiled with minimum SDK 29 |
| CPU architecture | **64-bit ARM (arm64-v8a) only** | **measured** — the package ships no 32-bit libraries, so a 32-bit device cannot install it |
| Google Play Services for AR | Installed, and the handset on Google's ARCore-certified device list | **binding requirement** |
| RAM | 4 GB | engineering judgement — see §2.3 |
| Storage | 600 MB free | **measured** — the installer is 232.6 MB |
| Camera | A rear camera meeting ARCore's own requirements | |
| Network | Required, for visual positioning against the parish's spatial map | |
| Physical | A printed A4 trigger sheet for that parish, mounted where it was surveyed | |

**ARCore certification is the requirement that cannot be worked around.** A
handset that satisfies every other line here but does not appear on Google's
certified list cannot run the tour at all.

### 2.3 Why the AR tour needs the memory it does

The tour renders photogrammetry models of the parishes' statues and of the
old San Roque church. Their actual sizes, read from the project:

| Model | Vertices |
|---|---|
| San Roque | 1,614,065 |
| Santo Niño de Pajotan | 1,551,117 |
| Old San Roque Church | 1,094,026 |
| Mary Help of Christians | 1,055,770 |

Each carries a 4096 × 4096 colour texture. A model of this size occupies
roughly 50 MB of vertex data before its texture, and a station may have one
loaded while another is still in memory. That is the reason for the 4 GB
floor and for recommending more; it is an estimate from the asset sizes, not
a benchmark.

### 2.4 For the parish administrator

| Requirement | Specification |
|---|---|
| Device | Any desktop, laptop, tablet or phone |
| Browser | Chrome, Edge, Firefox or Safari, updated within the last two years |
| RAM | 4 GB |
| Network | Required. The console does not operate offline. |
| Account | A SanctiWalk administrator account holding the `church_admin` role for that parish |

No installation is needed.

---

## 3. Recommended System Requirements

The specifications at which the proponents expect the full system, AR
included, to feel smooth rather than merely functional.

| Requirement | Specification |
|---|---|
| Operating System | Android 13 or later |
| CPU | Snapdragon 695 octa-core or equivalent |
| RAM | 6 GB |
| Storage | 2 GB free |
| Camera | 12 MP or better, with autofocus and ARCore support |
| Network | A stable mobile data or Wi-Fi connection |

Android 13 matters for a reason beyond speed: from that release the system
prompts for notification permission, which the Mass reminders and the
"notify me" subscriptions depend on.

---

## 4. Optimal System Requirements

Beyond these figures the proponents observed no further benefit. The system
is not demanding at the upper end; a more powerful handset mainly shortens
the initial visual-positioning step.

| Requirement | Specification |
|---|---|
| Operating System | Android 14 or later |
| CPU | Snapdragon 8 Gen 2 or equivalent |
| RAM | 8 GB |
| Storage | 4 GB free |
| Camera | 50 MP or better, with ARCore depth support |

---

## 5. What Must Also Be True for the System to Work Fully

Hardware is only part of it. The following are requirements in practice, and
each one has a visible consequence when it is absent.

### 5.1 Permissions the pilgrim must grant

All are declared in the application manifest **(measured)** and requested at
the moment they are needed, not on first launch.

| Permission | Needed for | If refused |
|---|---|---|
| `CAMERA` | The AI scanner and the AR tour | Neither can run |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | Detecting which parish the pilgrim is at, walking directions | Distances and parish detection are unavailable; the map still works |
| `RECORD_AUDIO` | The Rosary following the pilgrim's voice | The Rosary falls back to tapping |
| `MODIFY_AUDIO_SETTINGS` | Requested alongside `RECORD_AUDIO` by the same audio path | As above |
| `POST_NOTIFICATIONS` | Mass reminders and the "notify me" bells | Subscriptions are still saved, but nothing reaches the lock screen |
| `INTERNET` | The scanner, Ask Sancti, the map, live parish updates, AR positioning | Only the offline content works |

### 5.2 Services that must be present on the device

| Service | Needed for | If absent |
|---|---|---|
| Google Play Services for AR (ARCore) | The entire AR tour | The tour cannot start |
| Google Play Services | Google Sign-In, Firebase | Sign-in by Google is unavailable |
| A text-to-speech engine | Narration of church history, the scanner result, the guided Rosary | The speaker buttons are silent |
| **Filipino (`fil-PH`) voice data** | Narration *in Tagalog* | The text appears in Tagalog but is **read aloud in an English voice** |
| A speech-recognition service | The Rosary following along as the pilgrim prays | The Rosary reports it cannot listen and falls back to tapping |

The Filipino voice item is worth stating plainly because it is invisible
until it happens: the application correctly requests a `fil-PH` voice, but if
the handset has not downloaded Filipino voice data the engine substitutes its
default voice and reads Tagalog text with English pronunciation. It is
installed from the device's own text-to-speech settings, not from SanctiWalk.

### 5.3 Conditions at the church

| Condition | Why |
|---|---|
| The parish's printed A4 trigger sheet is mounted at the surveyed position | The AR tour computes every station's position relative to that sheet. A sheet on a different wall produces a confident, wrong tour. |
| The sheet is printed at 100% scale, not "fit to page" | The application is told the sheet measures 210 × 297 mm and derives distance from that. A sheet printed at 96% puts every station proportionally wrong. |
| Adequate lighting | ARCore cannot recognise the image or track the room in the dark. |
| A mobile data or Wi-Fi signal inside the building | Visual positioning is a network call. |

### 5.4 Server-side requirements

| Component | Purpose |
|---|---|
| Node.js runtime on an HTTPS host | The scanner and Ask Sancti endpoints |
| Google Firebase project | Authentication, Cloud Firestore, Cloud Storage |
| Generative model API key | The AI scanner and the parish assistant |
| Visual positioning service credentials | AR localisation inside each church |
| Static web host | The pilgrim application, the download page and the administration console |

---

## 6. Summary: the Four Requirements That Actually Decide It

Of everything above, four determine whether a given person can use SanctiWalk
completely:

1. **Android 10 or later on a 64-bit handset** — below this the AR tour
   cannot be installed at all.
2. **An ARCore-certified device** — this is Google's list, not a
   specification, and no amount of RAM substitutes for it.
3. **An internet connection** — for the scanner, Ask Sancti and AR
   positioning. Mass times, history and the Rosary survive without it.
4. **The printed trigger sheet, correctly placed and correctly scaled** —
   the only requirement that is not about the phone at all.
