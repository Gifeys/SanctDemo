# Admin: editing parish content

An administrator can change a parish's **patron photograph**, **description**,
**Mass schedule** and **colour** from inside the app — no developer, no code
change, no redeploy. Changes appear on every device within about a second.

Admin Panel → **Content Management** → *Parish content*.

---

## Two things must be set up first, once

Neither can be done from the app. Both are on the Firebase console for project
`project-6503fa3c-aa2d-4319-b63`.

### 1. Turn on Storage and deploy its rules

Photographs are the only thing that needs Storage. Until this is done, the
upload button reports *"Firebase Storage is not set up for this project yet"*
— everything else on the screen still works.

1. Firebase console → **Build → Storage → Get started**.
2. Then deploy the rules from this repo:

```bash
npx firebase deploy --only storage
```

`storage.rules` makes parish photos **public to read** (a pilgrim browsing the
diocese is not signed in, and the home screen must still fill in) and
**writable only by an admin**. Size and type are enforced there as well as in
the app, because a client-side check is a courtesy, not a security control.

### 2. Deploy the Firestore rules

```bash
npx firebase deploy --only firestore:rules
```

This adds the `parishContent` collection: public to read, admin-only to write.
Mass times in particular are the one thing here that could send a congregation
to a locked church, so they are not world-writable.

### Who counts as an admin

Anyone with a document at `admins/{uid}` in Firestore, created from the
console. Never from the client, so nobody can promote themselves. Same
definition in both rule files, so the two cannot drift apart.

---

## What each field does

**Patron photograph** — the large image at the top of Home, which shrinks as
the page scrolls. Under 5 MB; most phones offer to resize when sharing. Use a
photograph of *this parish's own* image. A generic church photo presented as a
particular parish's patron is the most visible version of the mistake the rest
of the app's data rules avoid.

With no photograph, Home shows the parish name alone — which is exactly what
the header looks like once scrolled, so nothing looks broken or empty.

**Description** — the paragraph under the parish name on Home.

**Mass schedule** — one line per day, commas between Masses:
`6:00 AM, 6:00 PM`. Leave a day blank if there is no Mass. Times must read
like `6:00 AM`; the editor refuses to save anything else, because a time the
app cannot parse is skipped silently, which would hide a Mass rather than
show an error.

This is the field worth having. Twenty-nine of the thirty-one parishes still
have no schedule, and until now every one had to be typed into `data.ts` by a
developer — the field team could collect them but not enter them.

**Colour** — the parish's own brand colour, used for buttons, headings and the
map's route line.

You pick the background; **the app derives the text colour on it** and refuses
any value that cannot carry readable text. Two separate checks, because a
colour can pass one and fail the other:

- a mid-grey is too light for pale text and too dark for ink, so a button in
  it has no legible label whichever way you go
- a pale gold carries ink on a button perfectly well but vanishes as a heading
  on the page background

The editor shows a live button preview and the reason for any refusal. The
same check runs again when the app applies a colour, so a value written
directly into Firestore, bypassing the editor, is ignored rather than trusted.

---

## Everything overlays, nothing replaces

A parish with no document behaves exactly as it did before this feature
existed. Each field falls back independently to what is compiled into
`data.ts`, so setting a description does not blank a Mass schedule, and an
admin can fill things in one at a time as the field team returns them.
