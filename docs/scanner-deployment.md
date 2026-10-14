# The AI scanner: deployment, limits and testing

Everything a visitor needs for the scanner to work on their own phone,
on any network, without the developer's laptop.

---

## 1. What changed

**The allowance is per account and per parish, not per IP address.**

It used to count against the caller's IP. Everyone on a church's Wi-Fi
shares one public address, so twenty scans were twenty for the whole
room and the first visitor through the door could spend everybody's.
Step outside onto mobile data and you became a new address with a fresh
twenty. Both halves were wrong.

- `src/lib/scanQuota.ts` — the rules: 20 scans per user per parish per
  day, which parishes have a scanner, how the day is decided. Pure and
  shared, so the screen and the server cannot disagree. 11 tests.
- `src/lib/scanQuotaStore.ts` — the Firestore counter. Read and write
  in one transaction, so two scans fired at once cannot both be told
  they were the twentieth. Refunds the scan when the failure is the
  server's, never when the model simply could not name the photograph.
- `server.ts` — verifies a Firebase ID token with the Admin SDK, checks
  the parish against a fixed list, reserves the scan before asking
  Gemini.
- `src/lib/idToken.ts`, `src/lib/useAuthUid.ts` — the app's side.
- `firestore.rules` — `scanQuotas` is closed to clients in both
  directions. Only the server writes it.

**Scanning now requires signing in.** That is the cost of counting per
person; there is no way to give one visitor their own twenty without
knowing which visitor they are. Everything else in SanctiWalk still
works signed out. Signed out, the scanner says so instead of letting
someone tap and be refused.

**Two bugs found and fixed while testing on the handset:**

- The quota gate failed *open*: with no Firebase credentials the server
  served an unlimited, unauthenticated scanner. It fails closed now,
  and production cannot be made to do otherwise.
- `Authorization` was missing from the CORS allow-list, so the phone
  reported "could not reach the server" for requests the server
  received and answered. Only visible on a real device — curl does not
  send preflights.

---

## 2. Environment variables

Never put any of these in a file you commit.

### On Render (the backend)

| Name | What it is | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | the Gemini key | [aistudio.google.com](https://aistudio.google.com/apikey) — same one in your local `.env` |
| `APP_KEY` | a long random string the app sends | generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `FIREBASE_SERVICE_ACCOUNT` | the whole service-account JSON, on one line | Firebase console, below |
| `NODE_ENV` | `production` | already in `render.yaml` |

### At APK / website build time

| Name | Value |
|---|---|
| `VITE_API_BASE` | your Render address, e.g. `https://sanctiwalk-api.onrender.com` |
| `VITE_APP_KEY` | **the same string** as `APP_KEY` above |

These two are baked into the bundle at build time, so changing either
means rebuilding.

### Local development only

`ALLOW_UNCOUNTED_SCANS=1` lets the scanner run with no Firebase
credentials, bounded by a per-IP ceiling. Production refuses to honour
it.

---

## 3. Deployment, step by step

### 3a. Get the Firebase service account

1. [console.firebase.google.com](https://console.firebase.google.com) →
   project **sanctiwalk-49bfd**
2. Gear icon → **Project settings** → **Service accounts**
3. **Generate new private key** → **Generate key**. A `.json` file
   downloads.
4. Keep it. Do not put it in the repository — `.env*` and this file are
   gitignored, but the safest place is outside the project entirely.

### 3b. Deploy the backend

1. Push to GitHub if you have not: `git push`
2. [render.com](https://render.com) → sign in with GitHub
3. **New** → **Blueprint** → choose `Gifeys/SanctDemo`
4. Render reads `render.yaml` and proposes `sanctiwalk-api` in
   Singapore. **Apply**.
5. It asks for the secrets marked `sync: false`. Paste `GEMINI_API_KEY`
   and `APP_KEY`.
6. After the first deploy: **Environment** → **Add Environment
   Variable** → name `FIREBASE_SERVICE_ACCOUNT`, value **the entire
   contents** of the JSON file from 3a, pasted as one value. Save; it
   redeploys.
7. Open `https://<your-service>.onrender.com/api/health`. It must say
   `{"ok":true}`.
8. Check the deploy log says
   `[Quota] Firebase Admin ready — scans counted per user, per parish`.
   If it says `FIREBASE_SERVICE_ACCOUNT is not set`, step 6 did not
   take, and the scanner will answer 503 by design.

### 3c. Point the website at it

Vercel → project → **Settings** → **Environment Variables** → add
`VITE_API_BASE` and `VITE_APP_KEY` → **Redeploy**.

---

## 4. Rebuilding the APK

```bash
cd D:/SanctDemo
VITE_API_BASE=https://<your-service>.onrender.com VITE_APP_KEY=<your APP_KEY> npm run build:app
npx cap sync android
cd android && JAVA_HOME="/c/Program Files/Java/jdk-23" ./gradlew assembleDebug
```

The APK lands at
`android/app/build/outputs/apk/debug/app-debug.apk` (about 47 MB).

Confirm the address really went in:

```bash
grep -c onrender dist/assets/*.js
```

Anything above zero is right. Zero means the variables were not set for
that build.

---

## 5. Installing and testing

```bash
adb install -r -d android/app/build/outputs/apk/debug/app-debug.apk
adb shell dumpsys package ph.edu.sti.sanctiwalk | grep lastUpdateTime
```

The timestamp must be from just now. `Success` on its own is not proof
the build you meant is the build on the phone.

For other people, put the APK on GitHub Releases — see
[how-people-install-the-app.md](how-people-install-the-app.md).

---

## 6. Checklist

Backend:

- [ ] `/api/health` answers `{"ok":true}`
- [ ] Deploy log says `Firebase Admin ready`
- [ ] A scan with no token answers 401, not a free scan
- [ ] A scan with `parishId` missing or invented answers 400

Per-user, per-parish:

- [ ] Account A scans at MHCP — the count goes down
- [ ] Account B, **same Wi-Fi**, still has its full 20 at MHCP
- [ ] Account A switches to San Roque — a separate 20
- [ ] Account A spends all 20 at MHCP — San Roque still has 20
- [ ] Sign out and back in — the count is where it was, not reset
- [ ] Reinstall the app, sign in again — still where it was

Networks (the point of the whole exercise):

- [ ] Home Wi-Fi
- [ ] School Wi-Fi
- [ ] Church Wi-Fi
- [ ] Mobile data, Wi-Fi switched off
- [ ] Two phones on the same Wi-Fi, two accounts, independent counts

Failure behaviour:

- [ ] Aeroplane mode: says the connection failed, does not hang
- [ ] Camera covered: the model declines rather than inventing
- [ ] A spent allowance names the parish and says the other has its own

---

## 7. Costs and limits

| Service | Tier | What it costs you |
|---|---|---|
| Render | free | nothing. **Sleeps after ~15 min idle**, then ~50 s to wake |
| Firebase Auth | Spark | free at this scale |
| Firestore | Spark | 50,000 reads and 20,000 writes a day. One scan is one read and one write, so the allowance runs out long before the quota does |
| Gemini | free tier | a daily request ceiling per model, shared across all your users |

**The sleep is the thing that will embarrass you in a defence.** The
first scan after a quiet spell waits around 50 seconds and looks like a
hang. Either open `/api/health` a minute beforehand, or set a free
ping every 10 minutes at [cron-job.org](https://cron-job.org), or pay
for the tier that does not sleep.

**Gemini's free tier is shared across all your users, not per user.**
The 20-per-parish allowance bounds one person; it does not bound a
hundred people at once. For a capstone that is fine. For a parish
launch, watch the Gemini usage page.

**It will never work offline.** The scanner reaches Gemini over the
network. In a church with no signal it cannot work and says so. The AR
tour is the opposite on purpose: its stations and models are compiled
into the Unity application precisely because churches have no signal.

---

## 8. What has and has not been verified

Verified on the Infinix, against a public HTTPS address:

- A real statue identified: *"Saint Joseph with the Child Jesus"*, 95%
  confidence, HTTP 200 in 4.6 seconds
- The scanner reached the server from the phone over the internet, not
  over the LAN
- With no Firebase credentials, production answers 503 and cannot be
  overridden
- An invented `parishId` is refused with 400
- 892 tests pass

Not verified, and honestly so:

- **Nothing is deployed to Render.** That needs your login. Every test
  above used a temporary tunnel to the development laptop.
- **The Firestore counter has never run against a real database**,
  because there is no service account yet. The transaction and the
  refund logic are written and typechecked but unproven.
- **Mobile data.** The handset had no DNS on its mobile connection at
  the time — `cloudflare.com` would not resolve either — so this could
  not be shown. Nothing suggests it will fail; it simply was not seen
  to work.
- **Two accounts on one Wi-Fi.** There is only one account on the
  handset.
