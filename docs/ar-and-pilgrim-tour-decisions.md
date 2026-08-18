# AR and the Pilgrim Tour — Decisions

**Date:** 2026-08-18
**Context:** The diocesan pilgrim tour needs to be engaging. AR was proposed as the answer. This records what was decided and why.

---

## 1. No Unity. AR runs in the browser.

**Decision:** Build AR inside SanctDemo as web AR (image tracking in the phone browser). Do not build a Unity app.

**Why:** Unity was chosen on the belief that AR is only possible in Unity. That is no longer true — image-tracking AR runs in a phone browser. Since the belief was the only reason, the reason is gone.

The structural argument matters more anyway. SanctiWalk is a web PWA. A Unity build would make it **two apps** that do not share a login, do not share the applications and admin portal, and cannot hand off to each other. For a capstone judged as an integrated system, that split is a weakness that would have to be defended. Web AR keeps one app, one URL, one account, and works on iPhone without a Mac or an Apple developer account.

**Existing Vuforia work is not wasted.** The trained database (`SanctiWalk.dat` / `.xml`) is Vuforia-specific, but the *source target images* transfer directly:

- `EXTRACTED_MaryHelpofChristians_scaled.jpg`
- `EXTRACTED_CarloAcutis_scaled.jpg`

(extracted from `SanctiWalk (1).unitypackage` to `C:\Users\Adrich\Desktop\SanctiWalk Assets\`)

Both are printed target cards — a photograph with a caption panel — which is ideal: high contrast, feature-rich, prints on A5, and tracks reliably in variable lighting. Re-compiling them for web image tracking takes minutes.

---

## 2. What appears in AR

**Decision:** An information card — history, text, and a photo — anchored over the camera view.

Not a 3D model. A 3D model impresses for ten seconds and then has nothing to say; a readable card about the church a person is standing in is the thing that is actually useful. A 3D model may return later as a stretch goal.

---

## 3. Presence is the core rule

**Decision:** A station can only be collected when the pilgrim is physically there, with a fallback for when technology fails.

This is the change that turns the tour from a website into a pilgrimage. Today a pilgrim can sit at home, tap through every station, collect every badge, and never visit a church. Nothing rewards going. Under this rule, being there is what unlocks the station, its AR, and its badge.

It also makes the location-awareness work load-bearing rather than decorative — which is what makes it defensible as a thesis contribution rather than a feature.

---

## 4. How presence is confirmed

**Decision:** GPS for the parish, QR for the station.

| Layer | Confirms | Why this layer |
|---|---|---|
| **GPS geofence** (100m) | You reached the parish | Automatic, no user action, drives the app's "you are here" behaviour |
| **QR code at the station** | You reached that specific station inside the church | Works indoors with no signal; thick church walls block GPS |

`Station` already has a `qrCode` field (`MHCP-ALTAR`, `MHCP-PATRON`, `MHCP-BAPT`), so this was the original plan.

**The manual override is the QR scan itself.** This is the important design point. Rather than a bare "I'm here" button that anyone could tap from home, the fallback when GPS fails indoors is scanning a plaque that is physically mounted inside the church. That is *stronger* proof of presence than GPS, not weaker.

A bare "I'm here" button exists only as a last resort — for a damaged plaque or a broken camera — and any station collected that way is recorded as **unverified**, so the data stays honest.

**Why this survives a panel question.** "What stops someone cheating?" has a real answer: to collect a station you must either be inside the parish geofence or scan a code bolted to its wall. The only way past both is to physically go there. The unverified flag means the rare exception is visible rather than hidden.

---

## 5. The engagement loop

The pieces already exist in `data.ts` and `types.ts` — `ROUTES`, `Station.reflection`, `BADGES`, `UserProgress`, `PILGRIM_QUIZ`. What is missing is the reason to walk. In priority order:

1. **Presence gates the station.** Nothing else works without this.
2. **AR is the reward for arriving,** not the reason to arrive. If AR works from the couch it is a novelty; if it only works at the church it is an experience.
3. **The reflection is what they keep.** The pilgrim's own answer to each station's prompt, saved, becomes a small journal of their pilgrimage. Nothing else in the app is theirs in that way.
4. **Completion means something.** A finished route earns a badge carrying a date and a place — "Completed the Maypajo Marian Trail, 18 August 2026" — a memento rather than a video-game achievement.
5. **A reason to return.** Feast days, first Fridays, the patronal feast, a route that opens during Lent. Catholics already live by liturgical time; the app does not need to invent a rhythm.

**Stated plainly:** AR alone does not make a tour engaging. A panel asking "why AR?" needs a better answer than "it is engaging." The answer is: *information appears only where you are standing, so the app rewards being present* — which ties AR to the location-awareness claim instead of bolting it on.

---

## Open items

1. Re-compile the two target images for web image tracking.
2. Decide AR content per station — the `Station.history` text already exists and may be enough.
3. Print the target cards for defense. If the demo happens in a classroom, printed cards behave identically to the ones mounted in the church — this is the single most important demo affordance after the location simulator.
4. Photograph the remaining stations that need targets.
5. Decide where a pilgrim reads their saved reflections back.
