import type { CapacitorConfig } from '@capacitor/cli'

// Packages the SanctiWalk web app as a real Android application.
//
// The paper calls SanctiWalk "a mobile app tour guide system" and says it
// must "operate on mobile devices with or without internet connectivity".
// Served from a browser it was neither: not installable, and dead without a
// connection. Capacitor bundles the built web app inside an APK, so it gets
// its own launcher icon, opens without a browser, and its shell, parish data,
// station content and Rosary all work with no signal.
//
// It does not make the AI recognition work offline - that reaches Gemini
// through the Express backend and always needed the internet. See
// src/lib/apiBase.ts for how the packaged app is told where that backend is.
// Set CAP_LAN_TEST=1 when the backend is a laptop on the same WiFi rather
// than a deployed HTTPS server. It is off unless asked for, so the ordinary
// build keeps both of Android's protections intact.
//
// Pair it with VITE_API_BASE pointing at that laptop:
//   CAP_LAN_TEST=1 VITE_API_BASE=http://192.168.1.20:3000 npm run apk:lan
const LAN_TEST = process.env.CAP_LAN_TEST === '1'

const config: CapacitorConfig = {
  appId: 'ph.edu.sti.sanctiwalk',
  appName: 'SanctiWalk',
  // `npx vite build` writes here. Use that rather than `npm run build`,
  // which also esbuilds server.cjs into the same folder - a Node bundle has
  // no business inside an Android APK.
  webDir: 'dist',

  android: {
    // The scanner and the AR tour both need the camera, and a WebView only
    // grants getUserMedia on a secure origin. Capacitor serves the bundle
    // over https://localhost, which qualifies.
    //
    // The page is https, so a plain-http backend is mixed content and the
    // WebView blocks it. That is the correct default: it is exactly the
    // protection that stops anyone on the same WiFi reading the photographs
    // being scanned. It is relaxed only for a deliberate LAN test build.
    allowMixedContent: LAN_TEST,
  },

  server: {
    androidScheme: 'https',
    // Android has refused cleartext traffic by default since API 28, on top
    // of the mixed-content rule above. Both have to give way for a backend
    // running on a laptop at http://192.168.x.x, and neither should give way
    // for the APK that gets handed to anyone else.
    cleartext: LAN_TEST,
  },
}

export default config
