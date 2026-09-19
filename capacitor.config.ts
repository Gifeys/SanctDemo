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
    allowMixedContent: false,
  },

  server: {
    androidScheme: 'https',
  },
}

export default config
