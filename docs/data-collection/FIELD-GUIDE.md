# SanctiWalk — Parish Data Collection Guide

**For the team gathering real information from parishes of the Diocese of Kalookan.**

Everything below feeds directly into the app. Follow the formats exactly and the data drops in with no retyping.

---

## Before you go

- Bring a phone with a working camera and plenty of storage. Photos are the slow part.
- Ask at the parish office first. Say what the app is and who it is for. Most offices will hand you a bulletin with the Mass schedule already printed — that alone saves an hour.
- If you are photographing inside the church, ask permission first. Always.

---

## 1. What to collect per parish

Fill one row of `parishes-template.csv` per parish, or one copy of the form below.

### Required — the app is wrong without these

| Field | Example | Notes |
|---|---|---|
| Parish name | San Roque Cathedral | Full official name |
| Address | A. Mabini St, Caloocan City | Street and city |
| **Mass schedule** | see format below | **The most important field** |
| Parish priest | Rev. Fr. Rufino P. Yabut | Include the title |
| Fiesta day | August 16 | The patronal feast |

### Important — the app is thin without these

| Field | Example |
|---|---|
| Established | April 8, 1815 |
| Brief history | 2–4 sentences, in your own words or the parish's |
| Patron saint + their story | St. Roque, and 2–3 sentences on who they were |
| Phone / email / Facebook page | However the parish prefers to be contacted |
| Confession times | Saturday 4:00–5:30 PM |
| Office hours | Mon–Fri 8:00 AM – 5:00 PM |

### Mass schedule format — follow this exactly

One line per day. Multiple Masses on the same day separated by a slash:

```
Monday      6:00 AM
Tuesday     6:00 AM
Wednesday   6:00 AM / 6:00 PM
Thursday    6:00 AM / 6:00 PM
Friday      6:00 AM / 6:00 PM
Saturday    6:00 AM / 6:00 PM
Sunday      6:00 AM / 7:30 AM / 9:00 AM / 10:30 AM / 4:30 PM / 6:00 PM
```

Rules:
- Always `H:MM AM` or `H:MM PM` — not "6am", not "1800", not "6:00".
- If a day has **no** Mass, write `none`. Do not leave it blank — blank looks like missing data, `none` is a fact.
- If a Mass is seasonal or "first Friday only", write it in the notes column rather than the schedule.

**Why this matters more than anything else you collect:** a wrong Mass time sends someone to a locked church. If you are unsure about a time, mark it in `notes` and we will show it as unconfirmed rather than stating it as fact.

---

## 2. Photos

**Format: JPG straight from the phone camera. Not PDF. Not screenshots. Not scans.**

A PDF is a document wrapper — the app cannot display one, and pulling images back out of it loses quality. Photograph the building, not a printout of the building.

### What to photograph, per parish

| Shot | How many | Notes |
|---|---|---|
| Church facade (front) | 2–3 | Straight on, whole building in frame |
| Interior toward the altar | 2–3 | From the centre aisle |
| Patron saint image or statue | 3–5 | **See the AR section — these matter most** |
| Anything historic | 2–3 | Cornerstone, old image, historic marker |

### Naming

```
parish-slug_subject_number.jpg

san-roque-cathedral_facade_01.jpg
san-roque-cathedral_altar_02.jpg
san-roque-cathedral_patron_01.jpg
```

Lowercase, hyphens, no spaces, no accents. Spaces in filenames cause real bugs.

### Quality

- Hold the phone **landscape** for buildings and interiors, **portrait** for statues.
- Do not use flash on statues or gold — it blows out the detail the app needs.
- Do not apply filters, do not crop tightly, do not upload to Facebook and download again (that recompresses and destroys detail).
- Send originals. If a file is under 500 KB it has probably been compressed by a chat app — send via Google Drive or a USB drive instead of Messenger.

---

## 3. Photos for AR scanning — read this carefully

This is the part that decides whether scanning feels instant or frustrating.

### How the scanning actually works

Two layers, and it matters which one you are helping:

**Layer 1 — QR codes. Instant, and always works.**
Each station gets a small printed code beside it. Scanning is immediate, needs no internet, and works in a dark church. **This is the fast path.** You do not need to photograph anything for it — you just need to tell us which stations exist so we can generate the codes.

**Layer 2 — image recognition. For things without a code.**
The camera looks at a statue or facade and identifies it. This is the one that needs good photos from you.

### What makes recognition fast

The app is given a **short list** of that parish's stations and asked "which of these is this?" — not the open question "what is this?". Choosing from five options is far faster and far more accurate than identifying something from nothing.

So the single most useful thing you can give us is **a clear list of the stations at each parish**, each with a name and a few photos.

### Photographing an AR target

For each station, take **3–5 photos**:

1. **Straight on**, filling most of the frame
2. **From the left**, about 30 degrees
3. **From the right**, about 30 degrees
4. **In different light** — one bright, one dimmer, if you can
5. **From where a person would actually stand** — not from a ladder, not from the sacristy

### What tracks well, and what does not

| Tracks well | Tracks badly |
|---|---|
| Painted statues with detail | Plain white or plain gold surfaces |
| Carved wood, textured stone | Shiny, reflective, or glass-fronted objects |
| Framed images, mosaics, murals | Blank walls, plain columns |
| Anything with rich, uneven pattern | Symmetrical objects that look the same from both sides |

If something is behind glass, photograph it at a slight angle so the reflection does not cover it.

### Station list — what we need per station

For each station in a parish:

```
Station name:      Main Altar and Tabernacle
Where it is:       Centre of the sanctuary
Why it matters:    2-3 sentences a pilgrim would want to know
Photos:            san-roque-cathedral_altar_01.jpg ... _03.jpg
```

Three to six stations per parish is right. More than that and a visit becomes a chore.

---

## 4. Prayer content

Only collect prayer material that is **specific to the parish**:

- A novena or devotion particular to that parish
- A prayer to their patron
- Any local devotional practice worth recording

The Rosary itself is already in the app and does not change per parish — do not re-collect it.

If the parish has prayers in Filipino, collect them in Filipino. Do not translate to English; the app already supports both and the Filipino original is more useful than a translation.

---

## 5. Sending it back

**One folder per parish:**

```
san-roque-cathedral/
    san-roque-cathedral.csv        (or the filled form)
    photos/
        san-roque-cathedral_facade_01.jpg
        san-roque-cathedral_altar_01.jpg
        ...
    stations.txt
```

Send via Google Drive or a USB drive. **Not through Messenger or Viber** — chat apps recompress photos and the detail loss ruins AR recognition.

---

## 6. Honesty rules

These are not optional, and they are what keeps the app trustworthy.

1. **Never guess a Mass time.** If nobody could confirm it, write `unconfirmed` in the notes. The app has a way to display unconfirmed information as unconfirmed — that is far better than a confident wrong answer.
2. **Never copy another parish's information as a placeholder.** An empty field is honest; the wrong parish's Mass times are not.
3. **Write down who collected it and when.** If something turns out wrong, we need to know who to ask, not to blame anyone but because they will remember the context.
4. **If a parish declines, record that too.** "Parish office declined, try again after fiesta" is useful information.

---

## Quick checklist per parish

- [ ] Parish name, address, priest
- [ ] Mass schedule for all seven days, in the exact format
- [ ] Confession times and office hours
- [ ] Established date and fiesta day
- [ ] Brief history, 2–4 sentences
- [ ] Patron saint and their story
- [ ] Contact details
- [ ] Facade photos (2–3)
- [ ] Interior photos (2–3)
- [ ] Patron image photos (3–5, multiple angles)
- [ ] Station list with names and descriptions
- [ ] Your name and the date
