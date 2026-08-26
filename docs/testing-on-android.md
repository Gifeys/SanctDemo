# Testing GPS, compass and search on an Android phone

SanctiWalk is a web app, not a Unity build. There is no `AndroidManifest.xml`
and no Player Settings to change — permissions are browser prompts, and the
only build-level setting that matters is that the page is served over HTTPS.

Everything below has to be checked **on the phone**. A laptop has no
magnetometer and its position comes from wifi lookup, so the two features
this document is about are precisely the two that cannot be tested on the
development machine.

---

## Getting the app onto the phone

```bash
npm run dev:https --prefix D:/SanctDemo
```

This serves over HTTPS on the machine's LAN address. The phone must be on the
same wifi network. Open the `https://…` address the server prints.

The certificate is self-signed, so Chrome shows **"Your connection is not
private"** the first time. Tap **Advanced → Proceed**. That warning is
expected and appears once per device.

**Plain `npm run dev` will not work for this testing.** On `http://<LAN-IP>`
the browser silently withholds both geolocation and the orientation sensors —
no prompt, no error, no events. The app looks broken in a way that gives no
clue why, which is the single most common wasted afternoon here.

---

## 1. GPS and live location

| Check | How | Expected |
|---|---|---|
| Permission prompt | Open the Map tab | Chrome asks to allow location; allow it |
| Position appears | Wait a few seconds outdoors | A dot appears with "Accurate to ±N m" beneath the compass |
| Accuracy is honest | Compare indoors vs outdoors | Indoors ±30–100 m, outdoors ±5–15 m. A large number is the sensor being truthful, not a bug |
| The marker moves | Walk 20–30 m | The dot glides to the new position rather than jumping |
| No stale position | Leave the app, walk, return | Position updates within a second or two, never showing where you were |
| GPS disabled | Turn off Location in Android quick settings | The app stops asserting a position rather than freezing on the last one |
| Permission denied | Deny the prompt, or revoke in ⋮ → Site settings → Location | The app says so instead of silently showing nothing |

**Test outdoors.** Indoors, Android falls back to wifi triangulation, which is
routinely 50–100 m out. That is not something the app can correct.

Re-granting a denied permission: Chrome ⋮ → **Site settings** → **Location** →
allow, then reload. Chrome does not re-prompt on its own once denied.

---

## 2. Compass and heading

| Check | How | Expected |
|---|---|---|
| Sensor present | Open the Map tab | The compass dial appears with "Facing …" beneath it |
| Heading is real | Face a known direction | The named direction matches; check against another compass app |
| Turning updates it | Rotate slowly through a full turn | The reading passes N → NE → E → SE → S → SW → W → NW and back |
| It does not shake | Hold the phone still | The dial holds steady. Small tremor is the deadband working; visible juddering is not |
| Landscape is correct | Turn the phone sideways | The heading stays correct — it is offset by the screen rotation |

**If the compass reads wrong by a constant amount**, the magnetometer needs
calibrating: move the phone in a figure-8 a few times. This is a phone-level
quirk, not app state.

**Metal and magnets throw it off.** Car dashboards, magnetic phone mounts and
speakers will all bend the reading. Test away from them.

**The reading is magnetic north, not true north.** In Metro Manila the
difference is well under a degree — far below the sensor's own error — so no
correction is applied. Anyone porting this well outside the Philippines will
need to add declination.

### iPhone differs

iOS requires an explicit gesture before the sensor turns on, so the compass
shows an **"Enable compass"** button instead of a dial. Tap it, then accept
the prompt. Android has no such step. If you only ever test on Android, that
button will never appear and its path will go unverified.

---

## 3. Map rotation (heading-up mode)

| Check | How | Expected |
|---|---|---|
| Default | Open the map | North-up. The map does not turn on its own |
| Switching | Tap the compass | The dial gets an accent ring and the map turns to match your heading |
| Smoothness | Turn slowly | The map sweeps; it does not step or jitter |
| Crossing north | Turn through north repeatedly | The map takes the short way round — it must never spin nearly a full turn |
| Labels | Face south in heading-up | Place names stay readable, not upside-down |
| Returning | Tap the compass again | The map eases back to north-up |

Crossing north is the specific case worth being deliberate about: it is where
a naive implementation sweeps 340° instead of 20°, and it only shows up if you
actually walk a circle.

---

## 4. Search

Test on the phone keyboard, not the laptop — autocorrect and swipe typing are
where real queries come from.

| Type | Expect |
|---|---|
| `Mary Help` | Mary Help of Christians Parish, first |
| `MHCP` | Same parish |
| `Christians Parish` | Same parish |
| `Mary Help Caloocan` | Same parish |
| `Chirstians` (misspelt) | Same parish |
| `San` | **San Roque**, above Santo Niño |
| `churches near me` | Every parish, nearest first, each with a distance |
| `santo nino` (no tilde) | Santo Niño Parish |

"Near me" needs a position — without one it returns nothing rather than an
arbitrary order.

---

## 5. Directions

| Check | Expected |
|---|---|
| Tap a live parish pin → **Get directions** | A route line, distance and walking time |
| **Clear directions** | The line disappears |
| Location off | An explanation, not silence |
| Airplane mode, then Get directions | Straight-line distance, explicitly labelled — never presented as a walking route |

Turning location on must show **your position only, no line**. A route appears
only when you ask for one.

---

## What is not built

Two things named in the original brief do not exist and are not covered above:
**turn-by-turn navigation** and **off-route re-routing**. There is no code for
either. Directions today draw a route and give you distance and time; they do
not issue step-by-step instructions or notice you leaving the path.
