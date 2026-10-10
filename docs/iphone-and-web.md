# SanctiWalk on an iPhone, and in any browser

There is no iOS build and there is not going to be one in this project:
compiling for iOS needs Xcode on macOS, which the team does not have,
and the companion augmented reality application is an Android build for
the same reason.

So iPhone users get SanctiWalk the way the web gives it — added to the
home screen, opening without browser chrome, and still opening when the
signal drops inside a stone church.

## How an iPhone user installs it

1. Open the site in **Safari**. It must be Safari; Chrome on iOS cannot
   add a web app to the home screen.
2. Share button → **Add to Home Screen**.
3. It appears with the SanctiWalk icon and opens full screen.

On Android and desktop Chrome the browser offers to install it directly.

## What works, and what does not

Everything in the app is a web page except two things, and both are
honest about themselves rather than failing silently.

**Works in a browser, including on iPhone:**

- The parish bulletin, Mass schedules, feast days, announcements
- The map, walking directions and turn-by-turn guidance
- Church history, ministries, sacraments and their requirements
- Registration, sign-in (including Google), and applying for a ministry
  or booking a sacrament
- Following an application's status
- The rosary and the daily verse
- Audio narration of station text — Safari has speech synthesis
- English and Filipino throughout
- The parish office portal, for administrators

**Does not work in a browser:**

- **The augmented reality marker tour.** It is a separate Unity and
  ARCore application, and it is Android-only. On an iPhone the app says
  so rather than offering a button that opens nothing.
- **Reminders.** Scheduling an alarm needs the device, and a web page
  has nothing to schedule one with. The Me tab says this where the
  reminder settings would be.
- **The AI scanner**, until the backend is deployed. It reaches Gemini
  through the Express server; see `render.yaml`. This is not an iPhone
  limitation — it is equally dead in the APK today.

A visitor on an iPhone can therefore find a parish, walk to it, read
its history, see when Mass is, and apply for a sacrament. What they
cannot do is the marker tour inside the church.

## What makes it installable

- `public/manifest.webmanifest` — name, icons, standalone display,
  theme colour.
- `index.html` — the Apple meta tags. iOS reads none of the manifest's
  display fields, so without `apple-mobile-web-app-capable` and its
  siblings, "Add to Home Screen" produces a bookmark that opens in the
  browser with its address bar.
- `public/sw.js` — the service worker. Hand-written rather than
  generated, so there is no build step to keep in step with the bundle.
  It never caches `/api/`, serves Vite's fingerprinted assets from the
  cache, and falls back to the cached shell when a navigation cannot
  reach the network.
- `src/lib/registerServiceWorker.ts` — registers it in a browser only,
  and only in a production build. The APK serves its own bundle from
  inside itself; a worker there would be a second cache in front of
  local files whose first act would be to make an update stick.

## Testing it

The service worker needs a production build and a real browser:

```bash
npm run build:app
npx vite preview --port 4173
```

Then in Chrome or Safari, not in an embedded preview pane: DevTools →
Application → Service Workers should show it activated, and Manifest
should show the icons with no errors. Turning on Offline and reloading
should still render the app.
