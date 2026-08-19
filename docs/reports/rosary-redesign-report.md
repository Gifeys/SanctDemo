# Rosary start-screen redesign — verification report

File changed: `public/rosary/index.html` (client's standalone rosary app, served in an
iframe on the Rosary tab). No other files touched. `D:\SanctiWalk-Saved\rosary-web-app\`
was not touched.

## 1. Liturgical day — the six required test dates

Computed by `Liturgical.describe(date)`, a self-contained IIFE added to the main
`<script>` block. Easter is derived per-year with the Anonymous Gregorian algorithm;
every other boundary (Advent, Christmas/Baptism, Ash Wednesday/Holy Thursday,
Pentecost, the two Ordinary Time blocks) is computed from that, never hardcoded.
Verified live in the browser via `Liturgical.describe(new Date(y,m-1,d))`:

| Date | Expected | Computed | Match |
|---|---|---|---|
| 2026-04-05 | Easter Sunday | Easter Sunday | yes |
| 2026-02-18 | Ash Wednesday | Ash Wednesday | yes |
| 2026-05-24 | Pentecost | Pentecost | yes |
| 2026-11-29 | First Sunday of Advent | First Sunday of Advent | yes |
| 2026-12-25 | Christmas | Christmas | yes |
| 2026-08-19 | a Wednesday in Ordinary Time | Wednesday of the 20th Week in Ordinary Time | yes |

One bug was found and fixed during verification: the shared `formatOT()` helper used
the wrong argument order for the "backward from Week 34" branch (post-Pentecost block),
which produced nonsense results like "48th Week" for 2026-08-19. Fixed by computing
the day-count in the correct direction for each of the two Ordinary Time blocks.
Re-verified against a wider spot-check across all season boundaries (Jan 1, the
Baptism of the Lord, the day before/after Ash Wednesday, Palm Sunday through Holy
Saturday, the day after Pentecost, Christ the King week, Christmas Eve) with no
further issues.

Easter 2026 computed as **April 5, 2026** — correct.

## 2. Contrast (WCAG AA) against the slideshow's brightest frame

This section has two passes: the first design (opaque `#start-card` at 0.90) and a
second pass after the client reviewed a screenshot and asked for the card to be
noticeably more transparent, so the paintings show through. Both are measured, not
eyeballed.

### First pass (superseded)

Card and language pill both `rgba(navy, 0.90)`. Worst-case math against a pure-white
pixel: white text 10.51:1, teal text `#5FC7DE` 5.36:1. Both cleared AA, but the client
felt the card hid too much of the artwork.

### Second pass — measured against the actual worst pixel behind the card, blurred

The client asked specifically for alpha in the 0.55–0.70 range and more backdrop
blur, and to hold AA against the single brightest real frame (not an assumed pure
white). Method used:

1. Rendered all 20 paintings into an off-screen canvas at the real slideshow
   viewport size (375×812, `object-fit: cover`, matching the CSS), then applied a
   canvas `blur()` filter to approximate `backdrop-filter`, then read every pixel
   inside the live `#start-card` bounding box to find the single brightest pixel
   post-blur, per image.
2. Compared blur radii of 16/24/32px: the result barely moved (0.9867 → 0.9822 →
   0.9816 relative luminance). The brightest region is a broad, near-uniform sky/
   highlight in one painting, not a small hot spot — blur smooths edges, it doesn't
   lower a wide flat plateau, so more blur past ~16–18px buys almost nothing.
3. **Worst image: `Luminous/The Proclamation of the Kingdom.jpg`**, worst pixel
   ≈ `rgb(255,253,247)` (essentially pure white) at every blur radius tested.
4. Composited the card's actual background color/alpha over that pixel, then
   composited each text color/opacity on top, and computed the resulting ratio.

Finding: **teal text (`#5FC7DE`) does not clear 4.5:1 against this worst pixel until
the card reaches ~0.86 alpha** (measured: 0.75→3.29:1, 0.80→3.86:1, 0.85→4.49:1,
0.86→4.69:1) — i.e., keeping teal-colored text on the card is incompatible with the
transparency the client asked for; 0.86 is barely different from the original 0.90
and defeats the point. **White text**, by contrast, clears 4.5:1 at a much lower
0.64 alpha (0.60→4.05:1, 0.64→4.57:1, 0.70→5.49:1) — comfortably inside the
requested 0.55–0.70 band.

**Resolution:** rather than pick one alpha and force a trade-off, every text color
on the card that was teal (`#liturgical-day`, `#start-alt-link`, `.choice small`
"Today" tag) or a low-opacity white (`#today-mystery-label` at .62, `.choice` body
text at .85, `#start-card .note` at .55) was changed to solid white at .90 opacity
— a uniform, generous margin — and the card itself was set to:

- `background: rgba(30,37,102,.70)` (down from .90 — squarely in the client's
  0.55–0.70 target)
- `backdrop-filter: blur(18px)` (up from 10px — the upper end of the suggested
  12–18px range)

Measured against the live DOM (`#start-card` actual bounding box) and the actual
worst pixel found above:

| Element | Color | Ratio vs. worst pixel (Proclamation of the Kingdom) | Needs | Pass |
|---|---|---|---|---|
| `#today-mystery-name`, `#begin` label | white, solid | **5.50:1** | 4.5:1 (or 3:1, large) | yes |
| `#liturgical-day`, `#today-mystery-label`, `#start-alt-link`, `.choice`, `.choice small`, `#start-card .note` | white @ .90 opacity | **4.82:1** | 4.5:1 | yes |

Teal (`#5FC7DE`) is no longer used as *text* anywhere on the translucent card. It's
still the palette's identity color: solid teal (`#1886A0`) fills on `#begin`, the
deeper `#106a7d` fill on selected pills, and the selected language toggle — all
opaque buttons unaffected by the card's transparency, unchanged from the first pass
(4.24:1 large-text pass on `#begin`, 6.21:1 on the smaller filled pills).

The `#start-overlay` atmospheric scrim (the full-bleed gradient behind everything,
separate from the card) was eased back to compensate — from `.35/.55/.72` alpha
stops down to `.25/.38/.55` — since the card no longer needs it as a compliance
backstop, and a lighter scrim lets more of the painting read through in the area
above/below the card too.

**Trade-off, reported as requested:** the transparency the client wants is fully
achievable (card at 0.70, comfortably inside their 0.55–0.70 range) *only* because
the small/secondary text was moved off teal onto white. If the client wants that
text to stay visibly teal-colored specifically, the measured floor is ~0.86 alpha —
which is not meaningfully more transparent than the original 0.90 and would not
satisfy "noticeably more transparent." No alpha in the requested range holds AA for
teal text against this particular painting. Recommended and implemented: white
secondary text at .70 card alpha, teal preserved everywhere it's used as a fill.

**Failures found across both passes: 2 in pass one (fixed), the teal-text/alpha
conflict caught by measurement before it shipped in pass two. Failures remaining: 0.**

## 3. Smallest rendered font size

14px, used in several places (the "Today's Mystery" label, the language-toggle
buttons, the mystery-choice "Today" tag, the voice-guidance note). Nothing on the
new screen renders below 14px; body/interactive text is 15–19px.

## 4. Primary action and the alternate-mystery reveal

- Default state: label "Today's Mystery", headline "The Glorious Mysteries" (today is
  Wednesday; the app's existing `DAY_SET` rotation — Sun/Wed=Glorious,
  Mon/Sat=Joyful, Tue/Fri=Sorrowful, Thu=Luminous — was reused, not reinvented),
  Begin button reads "Begin Today's Rosary".
- Clicking "Pray a different mystery" toggles `#start-alt-panel.open` (collapsed by
  default via `grid-template-rows: 0fr → 1fr`) and reveals four working choices
  (Joyful/Sorrowful/Glorious/Luminous), with "Today" marked on Glorious.
- Selecting a different set (tested: Joyful) updates the label to "You've Chosen",
  the headline to "The Joyful Mysteries", the Begin button to "Begin the Rosary",
  and — confirmed — actually starts that set's sequence (`S.set === "joyful"`,
  `S.seq[0].name === "The Sign of the Cross"` on the Joyful sequence).

## 5. Language toggle

- Clicking FIL changes the headline to "Ang Maluwalhating Misteryo" (and the reveal
  panel's four names to the client's given Filipino wording: Maligayang, Mahapding,
  Maluwalhating, Misteryo ng Liwanag); the liturgical-day line stays in English
  ("Wednesday of the 20th Week in Ordinary Time") — confirmed both lines
  simultaneously in one query.
- This new toggle is scoped to the start screen only, via a separate `START_SET_NAMES`
  table — it does not touch `P.tl.setNames`, which the in-prayer header still uses.
- Prayer-text language switching (the existing header EN/FIL button, `el.btnLang`)
  was not modified and still works: toggling it mid-prayer rebuilds `S.seq` via the
  existing `buildSequence()` and re-renders in place.

## 6. Prayer flow regression check (the one that matters most)

Started the Joyful mysteries via the new Begin button and tapped through 12 steps:
Sign of the Cross → Apostles' Creed → Our Father → five Hail Marys → Glory Be, in
order, with `S.idx` advancing and 6 beads/medal/cross elements gaining
`active`/`done` classes as expected. `render()`, `paintBeads()`, `buildSequence()`,
voice/karaoke code, and the camera-path system were not touched by this change.
`window.speechSynthesis` and `SpeechRecognition`/`webkitSpeechRecognition` are both
present and untouched — voice guidance is unaffected by the music removal (it never
used the `<audio>` element).

## 7. Slideshow

- `ALL_SLIDES` reuses the existing `SCENES` object (20 paths, no new data).
- Two `<img>` elements swap an `.on` class; only the front image is eager
  (`loading="eager"`, `src` set synchronously) — confirmed via
  `performance.getEntriesByType('resource')` that **only 2 of 20** images are
  requested on initial load (the shown one + one pre-fetched-ahead), not all 20.
  Each subsequent image is fetched only after the prior fade completes, during the
  ~7s hold of the new front image — plenty of margin even for the 5.4MB file.
- Hold/fade timing confirmed via computed style, not estimated: `--slide-fade` is
  `1800ms` (`SLIDE_FADE_MS`), applied as `transition: opacity 1.8s` on the images;
  hold is `SLIDE_HOLD_MS = 7000ms`. Both are within the requested 6–8s hold /
  1.5–2s fade.
- One caveat found during testing, worth flagging: like most browsers, this
  environment throttles `setTimeout` in a backgrounded/hidden tab. If the tab is
  minimized for a long stretch and then reactivated, several overdue advances can
  fire in a burst, jumping several images at once before settling back into the
  normal cadence. This is invisible to a user who's actually looking at the
  screen (the condition only exists while it's not visible) and self-corrects, but
  it's a real behavior worth knowing about if this ever gets more scrutiny.
- First paint: the eager image's network request starts ~24ms after navigation and
  completes ~4ms later on localhost; in production this is bounded by the size of
  whichever image is first in `SCENES` for the default day's set (typically well
  under 100KB — only 2 of the 20 files are large: 5.4MB and 4.2MB).

## 8. Image weight

Total for all 20 paintings: **12,190,993 bytes (11.63 MB)**, confirmed by fetching
each one. Two are large outliers: `Luminous/Baptism of jesus.jpg` (5.43MB) and
`Joyful/Finding Jesus at the Temple.jpg` (4.28MB) — together they're 79% of the
total weight; the other 18 average ~140KB each.

**Recommendation (not applied — client's call per the brief):** the eager+lazy
loading means this isn't a first-paint problem, but on a slow/metered mobile
connection the two outliers could take many seconds each to arrive during the
slideshow, and 11.6MB total is a lot to pull down over one sitting of prayer on
cellular data. If the client wants to keep the originals untouched (recommended
default, since these are their own artwork), consider either (a) recompressing just
those two files to a similar visual quality at a fraction of the size (JPEGs this
size are almost always uncompressed originals — a quality-85 re-encode would very
likely bring both under 500KB with no visible loss on a phone screen), or (b) adding
a "reduce data usage" toggle that skips the slideshow on cellular
(`navigator.connection.saveData`/`effectiveType`) and just shows a static image.
Left as a recommendation only, per the brief.

## 9. Ambient music

`AMBIENT_MUSIC_FILE` (near the top of the file, replacing the old `MUSIC_FILE`
constant) is `null` with a comment explaining how to restore it. The header's music
button, the `<audio>` element, and `setupMusic`/`fadeMusic`/`syncMusicButton` were
removed entirely. `playMusic()`/`pauseMusic()` remain as harmless no-ops (checked
against `AMBIENT_MUSIC_FILE`) so `begin()`/`endSession()` don't need to change again
when a real file is added — restoring music is a one-line change plus re-adding the
button, exactly as scoped.

## 10. Console

No errors in either the standalone `rosary/index.html` load or inside the parent
app's Rosary-tab iframe, at any point during testing (fresh load, language toggles,
mystery selection, Begin, 12 prayer steps, Exit).

## Type floor / theme

- Palette: navy `#151B53` background, card `#1E2566`-family navy panels at 0.70
  alpha + 18px blur (see §2), teal `#1886A0` fills with white text, `#5FC7DE` kept
  as the fill/accent color everywhere except as small text directly on the
  translucent card (see §2 for why).
- Font: Poppins throughout the new screen (already loaded for this file).
- Motion: card/button transitions 250–300ms ease; the slideshow crossfade is 1.8s
  per the brief's slower requirement.
- Every new element is ≥14px (see §3); nothing on the redesigned screen violates the
  16/15/14px floor.

## Not touched

Prayer engine (`buildSequence`, `render`, camera paths, beads, voice
recognition/synthesis, karaoke highlighting), the in-prayer header and its own
EN/FIL button, the finish screen, and `P` (the prayer-text/translation object) are
all unmodified.
