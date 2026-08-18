# SanctDemo Security Fix Report

Date: 2026-08-18
Scope: close three related data-security issues (open Firestore rules, email-substring
admin privilege, ownerless application documents).

## Files changed

- `firestore.rules` — replaced entirely.
- `src/App.tsx` — admin determination, application-listener scoping, write ownership,
  listener error handling.
- `src/components/LoginModal.tsx` — removed the email-substring admin check that fed
  `isAdmin` into `App.tsx`, replaced with a real Firestore lookup; updated the misleading
  "type admin@… to get admin" copy and placeholder; added an `isAdmin` prop for the
  post-login banner instead of re-deriving it from the email string.

`src/lib/firebase.ts` and `firebase-applet-config.json` were **not** touched.

## 1. `firestore.rules`

Replaced the blanket `allow read, write: if true` rules for `users`, `applications`,
`announcements` with the rules specified in the task:

- `users/{userId}`: only the owning uid may read/write.
- `applications/{docId}`: any signed-in user may `create` a document that carries their
  own `uid`; `read` is limited to the document's own owner or an admin; `update`/`delete`
  are admin-only.
- `announcements/{docId}`: public read, admin-only write.
- `admins/{userId}`: signed-in users may read (so the client can decide whether to show
  admin UI), nobody may write from the client. Admin membership is granted only from the
  Firebase console by creating a document at `admins/<uid>`.

This file is **not deployed by me** — see "What the human partner must do next" below.

## 2. Admin status: `src/App.tsx` and `src/components/LoginModal.tsx`

- `App.tsx`'s `onAuthStateChanged` handler no longer does
  `user.email.toLowerCase().includes("admin")`. It now does:
  ```ts
  const adminSnap = await getDoc(doc(db, "admins", user.uid));
  setIsAdmin(adminSnap.exists());
  ```
  wrapped in try/catch, defaulting to `false` on error.

- **Beyond the literal task scope, but required for the fix to actually hold:**
  `src/components/LoginModal.tsx` also computed `isAdmin` from the email string (in two
  places: sign-up and sign-in) and passed that flag to `App.tsx`'s
  `handleLoginSuccess(email, adminFlag)`, which does `setIsAdmin(adminFlag)`. Left alone,
  this would have immediately overwritten the correct value computed in `App.tsx` with the
  bogus email-based one on every login, completely defeating the fix. I replaced both
  occurrences with a real lookup against `admins/{uid}` (using the already-imported
  `getDoc`/`doc`), and changed the "Admin Privilege Unlocked" banner and email placeholder
  text (which literally told users to type "admin@sti.edu" to get admin) to stop
  advertising the old exploit. `LoginModal` now takes an `isAdmin` prop from `App.tsx` for
  the banner instead of re-deriving it from the email.

  I made this change because the task's stated vulnerability #2 ("anyone who registers an
  address containing 'admin' becomes a parish administrator") is not actually closed if
  this second code path is left in place — it would silently re-introduce the exact bug
  moments after the `App.tsx` fix runs. Flagging it explicitly rather than deciding
  silently, per your instructions.

Grep confirms no remaining email-substring privilege checks:
```
$ grep -rn "includes(\"admin\")\|includes('admin')\|toLowerCase().includes" src/
src/components/ExploreTab.tsx:18:  route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
src/components/ExploreTab.tsx:19:  route.location.toLowerCase().includes(searchQuery.toLowerCase());
```
Those two hits are the church-search filter, unrelated to auth.

## 3. Application ownership: `src/App.tsx`

- `handleAddApplication` now requires `auth.currentUser`. If nobody is signed in, it logs
  a clear console error, shows `alert("Please sign in first before submitting this form.")`,
  and returns without attempting a write (the rules would reject it anyway; failing loudly
  beats a silent console error). When a user is signed in, the write now includes
  `uid: auth.currentUser.uid`.

  Note: `handleAddApplication` is shared by the real application forms
  (`MinistriesTab`, `SacramentsTab`) and by several internal auto-logging calls
  (`handleLoginSuccess`, `handleStationVisited`, `handlePostComment`, plus the
  `AgosBookAR`/`PilgrimQuiz` callbacks) that previously logged anonymously
  ("Anonymous Pilgrim" / "Public User" / "Pilgrim Walk"). Those anonymous logging calls
  will now also require sign-in and will show the same alert if triggered while signed
  out. This is a direct, unavoidable consequence of the rule that every `applications`
  document must carry an owning `uid` — there is no such thing as an anonymously-owned
  document under the new rules. I did not special-case these internal calls to fail
  silently instead, since the task explicitly asked for loud failure over silent
  console errors.

- **Applications listener** (`useEffect` #2) is now conditional and depends on
  `[isLoggedIn, isAdmin, uid]`:
  - signed out → no subscription; `applications` state is cleared.
  - signed in + admin → subscribes to the full `applications` collection (as before).
  - signed in + non-admin → subscribes to
    `query(collection(db, "applications"), where("uid", "==", uid))`.
  Each transition properly unsubscribes the previous listener via the effect's cleanup
  function (unchanged mechanism, just now re-run on the added dependencies).

- **Seeding block** (used to backfill two demo applications when the collection is empty):
  guarded to only run `if (items.length === 0 && isAdmin)`, and each seeded document now
  includes `uid` (the admin's own uid, since a write with no uid, or a uid the admin
  doesn't own, would still be perfectly legal for an admin under these rules — `create`
  only requires the uid match the creator, and an admin is also just a signed-in user for
  the purposes of the `create` rule). I judged it better to keep the seeding (with the
  guard) rather than remove it, since removing it wasn't asked for and the guard is enough
  to make it safe; happy to remove it instead if you'd rather the demo not create synthetic
  data at all.

- Same treatment applied to the **announcements** seeding block: guarded on `isAdmin`
  (announcement writes are admin-only under the new rules), effect now depends on
  `[isAdmin]`.

- **Listener error callbacks**: added an `error` callback (second argument to
  `onSnapshot`) to every listener that lacked one — the `users/{uid}` profile listener,
  the `applications` listener, and the `announcements` listener — each logging a
  `console.error` naming the likely cause ("check Firestore rules / sign-in state").
  Previously a permission-denied error would fail with no visible signal at all.

## Verification

### TypeScript

Could not run `npx tsc --noEmit` meaningfully: `node_modules` is not installed in this
repo (matches the task's note that dependencies may not be installed / it uses
`bun.lock`), and there is no local `typescript` package. Running `npx tsc --noEmit`
resolved to an unrelated unmaintained npm package called `tsc` (not the TypeScript
compiler) and printed a warning rather than type-checking anything:

```
$ npx tsc --noEmit
npm warn exec The following package was not found and will be installed: tsc@2.0.4
npm warn deprecated tsc@2.0.4: Package no longer supported...
                This is not the tsc command you are looking for
```

I am reporting this plainly rather than claiming a type-check passed. To actually
verify, run `bun install` (or `npm install`) then `bun run lint` / `npx tsc --noEmit`
using the project's own `typescript` dependency (see `package.json`'s `devDependencies`).

### Manual inspection

Re-read the edited `App.tsx` sections and confirmed:
- Every write to `applications` (`handleAddApplication`'s `addDoc`, and both seeded docs
  in the applications-seeding block) now includes a `uid` field.
- No listener subscribes to a path the current user cannot read under the new rules:
  `users/{uid}` is always the caller's own uid; `applications` is either the full
  collection (admin only, gated by `isAdmin`) or `where("uid","==",uid)` (matches the
  signed-in caller); `announcements` remains public-read, matching `allow read: if true`.
  The applications listener additionally does not subscribe at all when signed out.
- Every `onSnapshot` call (`users/{uid}` profile, `applications`, `announcements`) now
  has an error callback that logs to the console.

### Grep for remaining email-based privilege checks

See section 2 above — only the unrelated `ExploreTab` search filter remains.

## What was NOT changed

- `firebase-applet-config.json` was left untouched (the Firebase web API key it contains
  is a public client identifier, not a secret — the rules are the real security boundary).
- No credentials, API keys, or secrets were added anywhere.
- No visual design, navigation, or unrelated component was touched, beyond the
  `LoginModal.tsx` admin-check fix described above (which is directly part of closing
  vulnerability #2, not an unrelated change).
- The rules were **not** deployed.

## What the human partner must do next

1. **Deploy the new `firestore.rules`.** I only edited the file locally; it has no effect
   on the live Firebase project until deployed, e.g. with the Firebase CLI:
   `firebase deploy --only firestore:rules` (run from a machine that's logged into the
   correct Firebase project), or by pasting the file's contents into the Firestore Rules
   editor in the Firebase console and publishing. Until this happens, the database is
   still wide open, and the code changes alone do not protect it.

2. **Create the first admin document.** With the new rules, nobody is an admin until a
   document exists at `admins/<their-uid>` in Firestore. To make yourself (or a parish
   staff member) an admin:
   - Have that person sign up/sign in once in the app so a Firebase Auth user exists.
   - Find their `uid` in the Firebase console (Authentication → Users).
   - In Firestore, create a document at collection `admins`, document ID = that uid (the
     document's content doesn't need any fields — its existence is what the rules check —
     though adding something like `{ email: "...", grantedAt: "..." }` for your own
     record-keeping is fine).
   - Do this only from the Firebase console, not from the app — the rules explicitly
     forbid client writes to `admins` (`allow write: if false`) so this can't be
     self-served.

3. **Re-verify once dependencies are installed.** Run `bun install` (or `npm install`)
   and then `npx tsc --noEmit` to get a real type-check, since I could not run one here.

Every code change described above is inert with respect to the live database until step 1
is done — the rules are the actual security boundary; the code changes make the app work
correctly *under* those rules and fail loudly instead of silently once they're active.
