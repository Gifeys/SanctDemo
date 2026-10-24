import { useState } from "react";
import { Capacitor } from "@capacitor/core";

import ConsentGate from "./ConsentGate";
import { SpotlightProvider } from "./Spotlight";
import Landing from "./Landing";
import App from "../App";

/**
 * What the root of the site is.
 *
 * The same page for everybody - a phone, a tablet and a laptop all get
 * the page that explains SanctiWalk, with the app one tap away. It used
 * to send phones straight into the app, and that was wrong for a reason
 * worth writing down: somebody shown the site on a laptop and then
 * handed a phone saw two different things and reasonably concluded the
 * phone was out of date. One front door is less clever and much clearer.
 *
 * ## The exception: anyone who already has the app
 *
 * `manifest.webmanifest` sets `start_url: "/"`, so an installed PWA
 * opens this route, and the APK's WebView loads the same bundle at
 * https://localhost/. Showing a page advertising SanctiWalk to
 * somebody who has already installed it and just tapped its icon
 * would be absurd, so both go straight to the app.
 *
 * The Capacitor check is not optional and is listed first. A WebView
 * inside an APK is NOT a PWA: it does not match
 * `(display-mode: standalone)` and sets no `navigator.standalone`, so
 * a display-mode test alone says "browser" and the installed Android
 * app opens on its own advertisement. That is exactly what shipped,
 * and it is the whole reason this function asks three questions
 * instead of one.
 */

/** True when this is the installed app rather than a browser tab. */
function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;

  // The APK. Asked first because it is the only one of the three that
  // is a fact rather than an inference.
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // No Capacitor bridge: an ordinary browser. Fall through.
  }

  try {
    // iOS Safari predates the standard and uses its own flag.
    const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
    return iosStandalone || window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  } catch {
    return false;
  }
}

export default function RootGate() {
  // Read once. A browser cannot become an installed app mid-session, and
  // swapping the whole page out from under somebody would be a strange
  // thing for a media query to do.
  const [installed] = useState(isInstalledApp);

  if (installed) {
    // The consent screen belongs here and nowhere else: this is the
    // branch that runs inside the APK, which is where somebody has
    // deliberately installed the thing. A visitor merely looking at
    // the parish's public site has installed nothing and agreed to
    // nothing, and should not meet a consent wall. See ConsentGate.
    return (
      <ConsentGate>
        <SpotlightProvider>
          <App />
        </SpotlightProvider>
      </ConsentGate>
    );
  }

  return <Landing />;
}
