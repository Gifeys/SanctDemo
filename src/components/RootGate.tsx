import { useState } from "react";
import { SpotlightProvider } from "./Spotlight";
import Landing from "./Landing";
import App from "../App";
import { isHandset, readDeviceSignals } from "../lib/deviceClass";

/**
 * What the root of the site is, which depends on who opened it.
 *
 * A phone gets the app. A laptop gets the page explaining the app.
 *
 * ## Why this renders rather than redirects
 *
 * A redirect would change the URL, and the URL at the root is load
 * bearing: `manifest.webmanifest` sets `start_url: "/"`, so the
 * installed app opens here. Bouncing that to `/app` would leave the
 * installed app on a different address than the one it was installed
 * from, and the service worker's cached shell is keyed to this one.
 * Rendering keeps the address exactly as it was.
 *
 * ## Why it is decided once, not on resize
 *
 * Read at mount and kept. Somebody dragging a browser window narrow is
 * not holding a different device, and swapping the whole application
 * out from under them mid-session - losing scroll, state and anything
 * half-typed - would be a strange thing for a window resize to do.
 */
export default function RootGate() {
  const [handset] = useState(() =>
    typeof window === "undefined" ? false : isHandset(readDeviceSignals(window)),
  );

  if (handset) {
    return (
      <SpotlightProvider>
        <App />
      </SpotlightProvider>
    );
  }

  return <Landing />;
}
