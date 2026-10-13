# Making the AI scanner work every time, anywhere

## Why it does not, today

The scanner is not doing the recognition. It takes a photograph, sends
it to a server, and that server asks Gemini. The Gemini key lives on
the server and must stay there — ship it inside the APK and anyone who
unpacks the app can spend your quota.

That server is `server.ts`, and right now it only exists on the
development laptop. So:

| Where the app runs | Scanner | Why |
|---|---|---|
| Laptop, `npm run dev` | works | the app is served *by* the server, so `/api/identify` is the same origin |
| **APK on the phone** | fails | the APK serves itself from a local scheme. There is no server at its origin, so `/api/identify` is a 404 |
| **Vercel** | fails | Vercel has the static build only, and `vercel.json` rewrites everything to `index.html` — so `/api/identify` returns the HTML page |

Nothing is broken in the code. The server simply is not anywhere the
phone can reach.

## The fix, once

Deploy `server.ts` to a public HTTPS address, then point both builds at
it. `render.yaml` in the repository root is already written for this.

### 1. Deploy the server

1. Push the repository to GitHub if it is not there already.
2. On [render.com](https://render.com): **New → Blueprint**, choose the
   repository. Render reads `render.yaml` and proposes one web service,
   `sanctiwalk-api`, in the Singapore region.
3. It will ask for the two secrets marked `sync: false`:
   - `GEMINI_API_KEY` — the same key in your local `.env`
   - `APP_KEY` — a long random string. Generate one with
     `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
     Keep it; both builds below need the same value.
4. Deploy. When it is live, check the address in a browser:
   `https://<your-service>.onrender.com/api/health` must answer
   `{"ok":true}`.

`APP_KEY` is what stops a stranger who finds the URL from spending your
Gemini quota. The server only enforces it when it is set, which is why
local development needs no configuration.

### 2. Rebuild the APK against it

```bash
VITE_API_BASE=https://<your-service>.onrender.com VITE_APP_KEY=<your APP_KEY> npm run build:app
npx cap sync android
cd android && ./gradlew assembleDebug
```

Both variables are read at build time, not run time — they are baked
into the bundle, so a rebuild is required if either changes.

### 3. Point the Vercel site at it too

In the Vercel project: **Settings → Environment Variables**, add
`VITE_API_BASE` and `VITE_APP_KEY` with the same values, then redeploy.
Without this the website's scanner keeps failing even after the server
is up.

## Two things that will bite during a defence

**The free plan sleeps.** Render's free tier stops the service after
about 15 minutes with no traffic, and the next request waits roughly 50
seconds while it starts again. In front of a panel, the first scan would
appear to hang. Either:

- open `/api/health` in a browser a minute before the demonstration, so
  the service is already awake; or
- keep it awake with a scheduled ping every 10 minutes
  ([cron-job.org](https://cron-job.org) is free and enough); or
- move to Render's paid tier, which does not sleep.

The ping is the honest answer for a demonstration. Paying is the honest
answer for real parish use.

**The daily limit is per IP, not per person.** `DAILY_SCAN_LIMIT` is 20
in `render.yaml`. A room full of people on one WiFi network shares one
public address, so twenty scans between all of them exhausts it. Raise
it in the Render dashboard before a demonstration.

## What still will not work offline

None of this makes the scanner work without the internet. It reaches
Gemini, which is a network service. Inside a church with no signal the
scanner cannot work and should say so rather than spin.

The AR tour is the opposite, and deliberately so: its stations, models
and narration are compiled into the Unity application precisely because
a church basement has no signal.
