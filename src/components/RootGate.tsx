import { useState } from "react";
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
 * ## The exception: the installed app
 *
 * `manifest.webmanifest` sets `start_url: "/"`, so an installed PWA
 * opens this route. Showing a page advertising the app to somebody who
 * has already installed it and just tapped its icon would be absurd, so
 * a standalone launch skips straight to the app.
 */

/** True when launched from a home-screen icon rather than a browser tab. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
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
  const [installed] = useState(isStandalone);

  if (installed) {
    return (
      <SpotlightProvider>
        <App />
      </SpotlightProvider>
    );
  }

  return <Landing />;
}
