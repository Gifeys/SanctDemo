# RESULTS AND DISCUSSION

## Testing

In this part, the proponents discuss and test the software development
standards applied to SanctiWalk. Testing was carried out on three levels.

Automated unit tests cover the system's pure logic — the Mass schedule
rules, the liturgical calendar, the grounding and refusal behaviour of Ask
Sancti, the subscription store, the deep-link handoff to the AR tour, and
the selection of a speech engine. The suite stands at 1,023 tests across 72
files, all passing.

Integration behaviour was exercised against the live production backend
rather than against mocks, confirming that the server responds, that the
image recogniser returns a named subject, and that the parish assistant
answers from the parish's own Firestore record instead of from the language
model's memory.

Field testing was performed on physical Android devices, because the two
things the system depends on most — the phone camera and ARCore's world
tracking — cannot be simulated honestly on a desktop computer.

The proponents distinguish throughout between what was verified by test and
what still requires on-site validation. Augmented reality that localizes
correctly in a laboratory does not thereby localize correctly inside a
concrete church, and this document says so wherever that is the case.

## Description of Prototype

This part includes the system requirements, the preliminary design, and how
the system is being evaluated and tested.

### Preliminary Design

SanctiWalk is delivered as three cooperating parts rather than as one
program, because the three have genuinely different needs.

**The pilgrim application** is a cross-platform web application built with
React and TypeScript and packaged for Android with Capacitor. It is the part
a parishioner installs. It carries the parish bulletin, the Mass schedule,
the church history with audio narration, the guided Rosary, the diocesan map
with walking directions, the camera scanner, and Ask Sancti. Because it is a
web application inside a native shell, one codebase serves both the browser
and the phone.

**The AR heritage tour** is a separate Unity application using Google
ARCore. It is separate by necessity rather than by preference: ARCore's
world tracking keeps a station anchored to a place after the trigger image
has left the camera's view, and no web API offers that today. SanctiWalk
launches it through a custom URL scheme, passing the parish identifier so
that the correct church's content loads. A single AR installation serves
both implemented parishes — Mary Help of Christians Parish and San Roque
Cathedral Parish — each with its own printed trigger image, its own spatial
map, and its own set of stations.

**The parish administration console** is a web application served from a
non-obvious path, through which parish staff maintain Mass times,
announcements, the availability of ministries and sacraments, and the
applications received. It is browser-based and requires no installation.

Behind all three sit a Node.js backend for the artificial-intelligence
endpoints and Google Firebase for authentication, the database, and file
storage.

### Minimum System Requirements

These are the specifications at which the system is expected to run
correctly. They are derived from the build configuration of the released
packages rather than estimated.

**For the pilgrim using SanctiWalk, without the AR tour:**

- Operating System: Android 7.0 (Nougat) or later. The application is
  compiled with a minimum SDK level of 24.
- CPU: any quad-core ARM processor
- RAM: 2 GB
- Storage: 150 MB free. The application itself occupies 66.3 MB.
- Camera: any rear-facing camera. Required only for the scanner.
- Network: an internet connection is needed for the scanner, Ask Sancti,
  the map, and live parish updates. Mass times, church history and the
  Rosary continue to work with no signal.

**For the pilgrim taking the AR heritage tour:**

The AR tour raises the floor considerably, and these are the figures that
actually govern whether a visitor can take the tour at all.

- Operating System: Android 10 or later. The AR package is compiled with a
  minimum SDK level of 29.
- CPU: a 64-bit ARM processor. The package ships arm64-v8a libraries only,
  so a 32-bit device cannot install it.
- Google Play Services for AR (ARCore), with the handset appearing on
  Google's list of ARCore-certified devices. This is the binding
  requirement: a phone that satisfies every other specification here but is
  not ARCore-certified cannot run the tour.
- RAM: 4 GB
- Storage: 500 MB free. The application itself occupies 160.3 MB.
- Camera: a rear camera meeting ARCore's own requirements
- Network: required, for visual positioning against the parish's spatial map
- A printed A4 trigger sheet for that parish, mounted at the position
  recorded during the survey

**For the parish administrator:**

- Any desktop, laptop, tablet or phone with a current web browser — Chrome,
  Edge, Firefox or Safari, updated within the last two years
- RAM: 4 GB
- Network: an internet connection is required. The console does not operate
  offline.
- A SanctiWalk administrator account holding the appropriate parish role

### Recommended System Requirements

These are the specifications at which the proponents expect the full system,
the AR tour included, to feel smooth rather than merely functional.

- Operating System: Android 13 or later. From Android 13 the system also
  prompts for notification permission, on which the Mass reminders and the
  "notify me" subscriptions depend.
- CPU: Snapdragon 695 octa-core or equivalent
- RAM: 6 GB
- Storage: 2 GB free
- Camera: 12 MP or better, with autofocus and ARCore support
- Network: a stable mobile data or Wi-Fi connection

### Optimal System Requirements

Beyond these figures the proponents observed no further benefit. The system
is not demanding at the upper end, and a more powerful handset mainly
shortens the initial visual-positioning step.

- Operating System: Android 14 or later
- CPU: Snapdragon 8 Gen 2 or equivalent
- RAM: 8 GB
- Storage: 4 GB free
- Camera: 50 MP or better, with ARCore depth support

### Server-Side Requirements

- A Node.js runtime, hosted on a service providing HTTPS
- A Google Firebase project providing Authentication, Cloud Firestore and
  Cloud Storage
- An API key for the generative model used by the scanner and by the parish
  assistant
- Credentials for the visual positioning service used by the AR tour

### How the System Is Evaluated and Tested

Evaluation proceeds in four stages, each answering a different question.

**Unit testing** answers whether the rules are right. Every piece of logic
that can be separated from the screen is tested in isolation, which at the
time of writing is 1,023 tests. This is also where the system's refusals are
verified as carefully as its answers: Ask Sancti is tested to say that the
parish has not stated something when the parish has not stated it, because a
confident wrong answer about a Mass time sends somebody to a locked church.

**Integration testing** answers whether the parts agree with one another.
The application was exercised against the live production backend,
confirming that the server is reachable, that the scanner returns a named
subject with a confidence score, and that the parish assistant quotes the
parish's own record rather than inventing one.

**Device testing** answers whether it works in the hand. The packaged
Android application was installed on physical handsets and operated as a
visitor would operate it. Several defects were found at this stage that no
automated test could have found, because they existed only in the packaged
application — most notably that the guided Rosary was silent on the phone,
the Android system WebView having accepted each spoken line without error
and produced no sound.

**Field testing** answers whether it works in the church, and it is the only
stage that can answer it. Image tracking and visual positioning are claims
about a real building: that a printed sheet is recognised under that
church's lighting, and that the stations land on the objects they describe.
These are validated on site, at each parish. The proponents treat a
successful build as evidence of nothing in this regard.
