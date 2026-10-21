import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";

import {
  dismiss,
  fetchLatest,
  isNewer,
  wasDismissed,
  type LatestRelease,
} from "../lib/appUpdate";

/** Where the published release is described. Written at build time. */
const LATEST_URL = "https://sanct-demo-vxzb.vercel.app/download/latest.json";

/**
 * Tells an installed SanctiWalk that a newer one is available.
 *
 * ## Only in the installed app
 *
 * In a browser there is nothing to update - the page IS the latest
 * version, and the service worker has already seen to it. Showing this
 * on the web would be offering somebody a download of the thing they
 * are currently looking at.
 *
 * ## Why it does not install the update itself
 *
 * Tapping Update opens the APK's own URL, which hands the download to
 * Android. The alternative - fetching 66MB inside the app and firing an
 * install intent through a FileProvider - needs native code, a
 * permission most users will decline, and careful handling of a
 * half-finished download. Android's own downloader already does all of
 * that correctly, and the pilgrim then taps the finished file once.
 *
 * Because the app is signed with a stable release key, that install
 * goes over the top: the saved parish, reminders and subscriptions all
 * survive. That was not true while it was signed with a debug key.
 */
export default function UpdateBanner() {
  const [release, setRelease] = useState<LatestRelease | null>(null);

  useEffect(() => {
    // The browser updates itself; see the note above.
    let installed = false;
    try {
      installed = Capacitor.isNativePlatform();
    } catch {
      installed = false;
    }
    if (!installed) return;

    let live = true;

    void (async () => {
      const latest = await fetchLatest(LATEST_URL);
      if (!live || !latest) return;
      if (!isNewer(__APP_VERSION__, latest)) return;
      // Asked once per release, not once per launch.
      if (wasDismissed(latest.versionName)) return;
      setRelease(latest);
    })();

    return () => {
      live = false;
    };
  }, []);

  if (!release) return null;

  return (
    <div className="update-banner" role="status">
      <Download className="w-[18px] h-[18px] shrink-0" aria-hidden />

      <span className="update-banner__text">
        <span className="update-banner__title">
          SanctiWalk {release.versionName} is available
        </span>
        {release.notes && (
          <span className="update-banner__notes">{release.notes}</span>
        )}
      </span>

      <a
        className="update-banner__go"
        href={release.url}
        // Android takes over the download from here.
        download
      >
        Update
      </a>

      <button
        type="button"
        className="update-banner__close"
        aria-label="Not now"
        onClick={() => {
          dismiss(release.versionName);
          setRelease(null);
        }}
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
