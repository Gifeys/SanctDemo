/*
 * SanctiWalk's service worker.
 *
 * ## Why this exists
 *
 * An iPhone cannot install the APK, and there is no iOS build of the
 * companion augmented reality app - compiling for iOS needs Xcode on
 * macOS, which this project does not have. Everything else SanctiWalk
 * does is a web page, so iPhone users get it the way the web gives it:
 * added to the home screen, opening without browser chrome, and still
 * opening when the signal drops inside a stone church.
 *
 * ## Why it is written by hand rather than generated
 *
 * A generated worker precaches a list of hashed filenames produced at
 * build time, which means a build step, a plugin and a manifest that
 * must stay in step with the bundle. This needs none of that: it
 * decides what to do from the shape of the request, so it keeps working
 * when the filenames change and there is nothing to regenerate.
 *
 * ## The three rules
 *
 * 1. Never touch the API. A cached recognition result is a wrong answer
 *    about a sacred object, and a cached sign-in is worse.
 * 2. Hashed assets are immutable - Vite fingerprints every filename -
 *    so they are served from the cache and never revalidated.
 * 3. A page navigation tries the network first and falls back to the
 *    cached shell. First, because a stale page would hide a parish's
 *    correction; fallback, because inside a church there is often no
 *    signal at all.
 */

const VERSION = 'v1';
const SHELL = `sanctiwalk-shell-${VERSION}`;
const ASSETS = `sanctiwalk-assets-${VERSION}`;
const KEEP = [SHELL, ASSETS];

/** The document every navigation falls back to. */
const SHELL_URL = '/index.html';

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(cache => cache.addAll([SHELL_URL, '/manifest.webmanifest']))
      // A failed precache must not leave the previous worker in place
      // for ever; the fetch handler copes with an empty cache.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names => Promise.all(
        names.filter(n => n.startsWith('sanctiwalk-') && !KEEP.includes(n))
          .map(n => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** True for anything that must always come from the network. */
function neverCache(url) {
  return (
    url.pathname.startsWith('/api/') ||
    // Firebase, Google sign-in and the map's tiles and routing all have
    // their own freshness rules and none of them want ours.
    url.hostname.endsWith('googleapis.com') ||
    url.hostname.endsWith('google.com') ||
    url.hostname.endsWith('gstatic.com') ||
    url.hostname.endsWith('openfreemap.org') ||
    url.hostname.endsWith('project-osrm.org')
  );
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (neverCache(url)) return;

  // A page the pilgrim navigated to.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          void caches.open(SHELL).then(c => c.put(SHELL_URL, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(SHELL_URL);
          // Every route in this app is the same document; React decides
          // what to render. So the shell answers for any path, which is
          // what makes a deep link work offline.
          return cached ?? Response.error();
        }),
    );
    return;
  }

  // Same-origin assets only. Another origin's files are its business.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Opaque and error responses are not worth keeping.
        if (!response.ok || response.type === 'opaque') return response;
        const copy = response.clone();
        void caches.open(ASSETS).then(c => c.put(request, copy));
        return response;
      });
    }),
  );
});
