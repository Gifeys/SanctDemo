import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  ScanLine,
  SwitchCamera,
  X,
  Sparkles,
  AlertTriangle,
  Loader2,
  ListChecks,
  ChevronRight,
  ChevronLeft,
  WifiOff,
  QrCode,
} from "lucide-react";
import { useCamera, captureFailed, type CameraStatus, type CaptureFailure } from "../lib/useCamera";
import { useQrScanner } from "../lib/useQrScanner";
import type { QrScanResult } from "../lib/qr";
import type { Station } from "../types";
import { PARISH_PATRON_IMAGES, PARISH_HEADER_IMAGES } from "../data";

const PLACEHOLDER_PHOTO = "/parish/placeholder-photo.svg";

/** The church itself, for the card about pointing a camera around it. */
const PARISH_CHURCH_PHOTOS: Record<string, string> = {
  "route-mhcp": "/parish/mary-help-history.jpg",
  "route-src": "/parish/san-roque-church.jpg",
};
import { arAvailability, arTourUrl } from "../lib/arApp";
import { apiUrl } from "../lib/apiBase";
import {
  ScannerHeader, ScannerSheet, ScannerTabs, ScannerReticle, type ScannerMode,
} from "./ScannerChrome";
import ArScannerPanel, { type ArStage } from "./ArScannerPanel";
import { useLanguage } from "../lib/useLanguage";
import { stationText } from "../lib/contentTranslations";
import type { Language } from "../lib/language";
import { withAppKey } from "../lib/appKey";

/**
 * ArTour — the camera experience behind the AR Tour tab.
 *
 * The camera fills the tab and stays visible; recognised information rises over
 * it as a card rather than replacing it. That is the decision recorded in
 * docs/ar-and-pilgrim-tour-decisions.md — an information card anchored over the
 * camera view, not a 3D model.
 *
 * `stations` is the accuracy lever for the live scan (names become the
 * `candidates` shortlist — see /api/identify in server.ts) AND the source
 * list for manual selection below, so the two paths describe the same set of
 * places.
 *
 * The camera can only open on a secure origin (https, or localhost) — a
 * browser rule, not a bug this app can route around. Most real-world use is
 * a phone on the parish wifi at a bare LAN IP, which is insecure by default.
 * Rather than dead-ending there, every non-ready state offers "choose your
 * station manually" as a fallback that always works — see docs/CAMERA-SETUP.md
 * for how to get the camera itself working (HTTPS).
 */

interface Recognition {
  recognized: boolean;
  title: string;
  category: string;
  /** Omitted for manual selections — there's no vision-model confidence to show. */
  confidence?: number;
  summary: string;
  highlights: string[];
  /** "ai" = the vision model recognised this. "qr" = the pilgrim scanned the
   *  parish's own printed code, which is the most certain of the three: the
   *  code names exactly one station and nothing was inferred. "manual" = they
   *  picked it from the list because the camera couldn't open or couldn't
   *  tell. Mirrors the coordinatesVerified / scheduleVerified pattern in
   *  data.ts: unverified data is shown, but never labelled as confirmed. */
  source: "ai" | "manual" | "qr";
  /** False when the subject was recognised but is not one of this parish's
   *  own stations — the camera still says what it is, it just isn't part of
   *  the tour. Undefined for manual picks and for open recognition. */
  matchedStation?: boolean;
  /** Which station this is, when it is one. Lets the card show that
   *  station's photograph and offer the next stop on the tour — the AI path
   *  has no station behind it, so it carries no id. */
  stationId?: string;
}

/**
 * How long to wait for a recognition before giving up.
 *
 * Must stay ABOVE the server's own ceiling (OVERALL_DEADLINE_MS, 40s) or the
 * retrying is wasted: aborting first replaces the honest "the service is busy"
 * with a bare timeout, and the pilgrim loses the one piece of information that
 * tells them trying again will work.
 *
 * Long, and deliberately so. Measured: a congested primary model refuses in
 * ~3s and the fallback then answers in 7-18s, so the common recovery is
 * 10-20s. This is the outer bound for the bad case, not the expected wait.
 */
const SCAN_TIMEOUT_MS = 45000;

/** The server's shared daily recognition allowance — see /api/identify. */
interface ScanBudget {
  limit: number;
  used: number;
  remaining: number;
}

type Phase = "idle" | "scanning" | "done";

const STATUS_COPY: Partial<Record<CameraStatus, { title: string; icon: "warning" | "offline" }>> = {
  denied: { title: "Camera permission needed", icon: "warning" },
  insecure: { title: "Camera needs a secure connection", icon: "offline" },
  unavailable: { title: "Camera unavailable", icon: "warning" },
  "in-use": { title: "Camera is busy", icon: "warning" },
  error: { title: "Camera unavailable", icon: "warning" },
};

function stationToRecognition(
  station: Station,
  source: Recognition["source"] = "manual",
  /**
   * The reader's language. The station text compiled into data.ts is
   * English only, so a pilgrim reading in Tagalog scanned a statue and
   * got an English card back - which is the complaint this fixes.
   *
   * The history stays as written: it is the parish's own account, and
   * only the description and the reflection have been translated.
   */
  language: Language = "en",
): Recognition {
  const words = stationText(station, language);
  const highlights = [
    station.history && `History: ${station.history}`,
    words.reflection && `Reflection: ${words.reflection}`,
  ].filter((v): v is string => Boolean(v));

  return {
    recognized: true,
    title: station.name,
    category: "Station",
    summary: words.description,
    highlights,
    source,
    stationId: station.id,
  };
}

function ArTourLaunch({ parishId }: { parishId?: string }) {
  const availability = arAvailability(
    typeof navigator === "undefined" ? "" : navigator.userAgent,
  );

  if (availability.kind !== "ready") {
    return (
      <p className="text-[14px] leading-relaxed text-[var(--color-brand-secondary)] px-1 font-sans">
        {availability.reason}
      </p>
    );
  }

  return (
    <a href={arTourUrl(parishId ?? "route-mhcp")} className="scan-card__action scan-card__action--ghost">
      <Sparkles className="w-4 h-4" /> Tour now
    </a>
  );
}

export default function ArTour({
  stations = [], parishId, parishName = "your parish", onClose, onCameraLiveChange,
}: {
  stations?: Station[];
  parishId?: string;
  /** Named in the AR handover, so the pilgrim knows which tour is opening. */
  parishName?: string;
  /**
   * Leaves the scanner. The reference design puts a close in the corner
   * of the viewfinder, and on a screen that has taken over the display
   * there has to be a visible way back that is not the system gesture.
   */
  onClose?: () => void;
  /**
   * Fires when the viewfinder opens or closes. The parish band lives above
   * this component, and once the camera is up the screen is the camera -
   * a header over a live viewfinder is covering the thing being scanned.
   */
  onCameraLiveChange?: (live: boolean) => void;
}) {
  // This parish's own pictures, so the choice looks like this church's
  // rather than the software's. The patron fronts the museum because the
  // museum is largely its statues; the church interior fronts the scanner
  // because that is what the camera will be pointed at.
  const museumImage =
    PARISH_PATRON_IMAGES[parishId ?? ""] ?? PARISH_HEADER_IMAGES[parishId ?? ""] ?? PLACEHOLDER_PHOTO;
  // The scanner's picture is the church, not the patron: the patron already
  // fronts the museum card directly above, and two photographs of the same
  // statue made the two choices look like one thing listed twice.
  const scannerImage = PARISH_CHURCH_PHOTOS[parishId ?? ""] ?? PARISH_HEADER_IMAGES[parishId ?? ""] ?? PLACEHOLDER_PHOTO;

  const camera = useCamera();

  // "ready" is the only status with a picture on screen; every other one
  // is a card explaining why there is not.
  const cameraLive = camera.status === "ready";

  /**
   * Open the camera as soon as the tab does.
   *
   * Tapping Scan used to land on a menu of cards with a "Scan now"
   * button on one of them, so reaching the scanner took two taps and
   * the first one showed something nobody came for. A scanner tab
   * should be a viewfinder; the AI/AR switch inside it already offers
   * the choice those cards were offering.
   *
   * Only from "idle". Re-running after a denial would reopen the
   * permission prompt on every render, and after a grant it would stop
   * and restart a camera that is already running.
   */
  useEffect(() => {
    if (camera.status === "idle") void camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.status]);
  useEffect(() => {
    onCameraLiveChange?.(cameraLive);
    // Leaving the tab with the camera open must put the band back.
    return () => onCameraLiveChange?.(false);
  }, [cameraLive, onCameraLiveChange]);
  const { language } = useLanguage();
  const stationNames = stations.map((s) => s.name);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Recognition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [budget, setBudget] = useState<ScanBudget | null>(null);

  /**
   * Which scanner is showing, and how far the AR one has got.
   *
   * They share the camera and the chrome and differ only in what they
   * do with a frame, so this is one screen with a switch rather than
   * two screens with a duplicate camera between them.
   */
  const [mode, setMode] = useState<ScannerMode>("ai");
  const [arStage, setArStage] = useState<ArStage>("find");
  const [arStop, setArStop] = useState(0);
  const [arError, setArError] = useState<string | null>(null);

  // Fetched once so the remaining count is visible before anyone spends one.
  // Failure is silent: the counter just doesn't appear, rather than blocking
  // a scan over a number that is only informational.
  useEffect(() => {
    let live = true;
    void fetch(apiUrl("/api/identify/budget"), { headers: withAppKey() })
      .then(r => (r.ok ? r.json() : null))
      .then(b => {
        if (live && b) setBudget(b);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const scan = useCallback(async () => {
    const capture = camera.captureFrame();

    if (captureFailed(capture)) {
      // Each reason gets its own words. "It didn't work" is the same message
      // for a camera that has not painted a frame yet and for one that never
      // will, and those need different actions from the pilgrim.
      // Record<CaptureFailure, …>, not Record<typeof capture.reason, …>:
      // a `typeof` in a TYPE position reads the declared type, not the
      // one narrowed by the `if` above, so it saw the whole union and
      // the success branch has no `reason`.
      const message: Record<CaptureFailure, string> = {
        "no-video": "The camera view is not open. Close and reopen the scanner.",
        "not-ready": "The camera is still warming up. Give it a second and tap again.",
        "no-canvas": "This browser could not prepare the image. Try reloading the app.",
        "encode-failed": "The captured frame was empty. Try again, and make sure the camera is not covered.",
      };
      console.error(`[Scanner] Scanner error: capture failed — ${capture.reason}`);
      setError(message[capture.reason]);
      return;
    }

    const frame = capture.frame;

    // A frame this dark carries nothing for the model to work from, and
    // spending one of the day's twenty recognitions to be told so is worse
    // than saying it here. -1 means brightness could not be measured, which
    // is not a reason to block.
    if (frame.brightness >= 0 && frame.brightness < 18) {
      console.warn(`[Scanner] Scanner error: frame too dark (brightness ${frame.brightness.toFixed(0)}/255)`);
      setError("Too dark to read. Move closer, turn on more light, and keep the object inside the frame.");
      return;
    }

    setPhase("scanning");
    setError(null);
    console.log(
      `[Scanner] Sending image to AI: ${frame.width}x${frame.height}, ` +
        `${(frame.bytes / 1024).toFixed(0)} KB, ${stationNames.length} station candidates`,
    );

    const startedAt = Date.now();

    // A hard ceiling on the wait. The server now retries a congested model
    // three times before falling back to a second one, so a slow answer is
    // expected — but without an abort a genuinely hung request left the
    // scanner spinning on "scanning" with no error and no way back.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl("/api/identify"), {
        method: "POST",
        headers: withAppKey({ "Content-Type": "application/json" }),
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: frame.base64,
          mimeType: frame.mimeType,
          candidates: stationNames,
        }),
      });

      console.log(`[Scanner] API response: ${response.status} in ${Date.now() - startedAt}ms`);

      // A 413 used to arrive as the dev server's HTML error page, which threw
      // on .json() and surfaced as "Could not reach the server" — a size
      // limit reported as a network fault. Read the content type first.
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        console.error(
          `[Scanner] Scanner error: expected JSON, got "${contentType}" (status ${response.status})`,
        );
        setError(
          response.status === 413
            ? "That photo was too large to send. Try again from a little further back."
            : `The server replied unexpectedly (status ${response.status}). Please try again.`,
        );
        setPhase("idle");
        return;
      }

      const data = await response.json();
      if (data?.budget) setBudget(data.budget);

      if (!response.ok) {
        console.error(`[Scanner] Scanner error: ${response.status} — ${data?.error ?? "no message"}`);
        setError(data?.error ?? "Recognition failed. Please try again.");
        setPhase("idle");
        return;
      }

      if (!data.recognized) {
        console.log("[Scanner] AI result: nothing identifiable in frame");
        setError(
          data?.advice ??
            "Nothing recognisable in view. Move closer, improve the lighting, and keep the object inside the frame.",
        );
        setPhase("idle");
        return;
      }

      console.log(
        `[Scanner] AI result: "${data.title}" (${Math.round((data.confidence ?? 0) * 100)}% confidence` +
          `${data.matchedStation === false ? ", not a listed station" : ""})`,
      );
      setResult({ ...(data as Omit<Recognition, "source">), source: "ai" });
      setSheetOpen(true);
      setPhase("done");
    } catch (err) {
      console.error("[Scanner] Scanner error:", err);
      // An abort is our own timeout firing, not a network fault, and saying
      // "check your connection" for it sends the pilgrim after the wrong
      // problem — their connection was fine, the answer just never came.
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setError(
        timedOut
          ? `The recognition service did not answer within ${Math.round(SCAN_TIMEOUT_MS / 1000)} seconds. Tap scan to try again.`
          : err instanceof TypeError
            ? "Could not reach the server. Check your connection and try again."
            : "Something went wrong reading the result. Please try again.",
      );
      setPhase("idle");
    } finally {
      window.clearTimeout(timeout);
    }
  }, [camera, stationNames]);

  const pickStation = useCallback((station: Station) => {
    setResult(stationToRecognition(station, "manual", language));
    setSheetOpen(true);
    setPhase("done");
    setPickerOpen(false);
  }, []);

  // The station currently on the card, when the card is showing one. The AI
  // path recognises things that are not stations at all, so this is often
  // null and every use of it has to allow for that.
  const currentStation = result?.stationId
    ? stations.find(s => s.id === result.stationId) ?? null
    : null;

  // The next stop on the tour, so a pilgrim can walk the church in order
  // without going back to the picker between every station. Wraps at the end
  // rather than dead-ending on the last one.
  const nextStation =
    currentStation && stations.length > 1
      ? stations[(stations.findIndex(s => s.id === currentStation.id) + 1) % stations.length]
      : null;

  /* ------------------------------------------------------------------- QR */

  /**
   * The parish's printed codes, read continuously while the camera is idle.
   *
   * No mode to choose and no button to press, deliberately: a pilgrim
   * standing in front of a poster should not first have to work out that the
   * app has a separate QR mode. It costs nothing to look — decoding runs on a
   * downscaled frame a few times a second — and every code found names
   * exactly one station, so unlike the vision model there is nothing to get
   * wrong.
   *
   * Paused while a result card is open or a recognition is in flight, so a
   * code still in frame cannot yank the screen out from under a reader.
   */
  const onQrResult = useCallback(
    (scan: QrScanResult) => {
      if (scan.kind === "station") {
        const { station, route } = scan.match;
        console.log(`[Scanner] QR matched station "${station.name}" in ${route.id}`);
        setError(null);
        setResult(stationToRecognition(station, "qr", language));
        setSheetOpen(true);
        setPhase("done");
        return;
      }

      // Both misses get words that place the blame accurately. A pilgrim who
      // scanned the parish's own poster and is told "that is not a SanctiWalk
      // code" will reasonably conclude the app is broken.
      setError(
        scan.kind === "unknown-station"
          ? `Code ${scan.code} is a SanctiWalk code, but this parish's content has not been added yet.`
          : "That code is not a SanctiWalk station code. Point the camera at a station instead, or use the scan button.",
      );
    },
    [],
  );

  useQrScanner(camera.videoRef, {
    active: camera.isReady && !sheetOpen && phase !== "scanning",
    onResult: onQrResult,
  });

  /* ------------------------------------------------------------ permission */

  if (camera.status !== "ready") {
    const statusCopy = STATUS_COPY[camera.status];
    const showManualFallback = camera.status !== "idle" && camera.status !== "requesting";

    // A manual pick was made while the camera was unavailable — show the
    // station's info card right here, same shape as a real scan would, with
    // a way back to either try the camera again or pick a different station.
    if (result && result.source === "manual" && sheetOpen) {
      return (
        <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
          <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[var(--color-brand-border)]">
            <button
              onClick={() => setSheetOpen(false)}
              aria-label="Back"
              className="flex items-center gap-1 text-[15px] font-bold text-white/90 font-sans mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14px] font-bold uppercase tracking-[0.09em] text-[var(--color-brand-on-accent)] font-sans">
                {result.category}
              </span>
            </div>
            <h2 className="text-2xl font-bold font-serif italic tracking-tight">{result.title}</h2>
          </div>

          <div className="p-4 space-y-4">
            {/* Unverified badge — mirrors scheduleVerified's amber "sample,
                unconfirmed" treatment in MassSchedule.tsx / Dashboard.tsx. A
                manual pick is not a scan, and must never look like one. */}
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-[15px] font-bold text-amber-900 leading-snug font-sans">
                Selected manually — not confirmed by a camera scan.
              </span>
            </div>

            <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-5 shadow-xs">
              {/* The station's own photograph, when one exists — nothing when
                  it does not. Most stations have none, and an empty space is
                  more honest than another church's altar. */}
              {currentStation?.imageUrl && (
                <img
                  src={currentStation.imageUrl}
                  alt={currentStation.name}
                  className="mb-4 w-full h-40 object-cover rounded-2xl border border-[var(--color-brand-border)]"
                  loading="lazy"
                />
              )}

              <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans">{result.summary}</p>

              {result.highlights.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {result.highlights.map((fact) => (
                    <li key={fact} className="flex gap-2.5 items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-accent)] mt-2 shrink-0" />
                      <span className="text-[14px] text-[var(--color-brand-text)] leading-relaxed font-sans">
                        {fact}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Walks the church in order, naming the next stop rather than
                saying "Next" — knowing you are being sent to the Baptismal
                Font is what makes it worth following. */}
            {nextStation && (
              <button
                type="button"
                onClick={() => pickStation(nextStation)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-left active:scale-[0.99] transition-transform"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-secondary)]">
                    Next location
                  </span>
                  <span className="mt-0.5 block text-[16px] font-semibold text-[var(--color-brand-text)] leading-snug">
                    {nextStation.name}
                  </span>
                </span>
                <ChevronRight className="w-5 h-5 shrink-0 text-[var(--color-brand-primary)]" />
              </button>
            )}

            <button
              onClick={() => setPickerOpen(true)}
              className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)] rounded-2xl py-3 font-bold text-[15px] font-sans active:scale-[0.98] transition-transform"
            >
              Choose a different station
            </button>
          </div>
        </div>
      );
    }

    // The manual station picker — the fallback that "always works" per the
    // parish's request, since the camera itself is a browser permission the
    // app cannot force.
    if (pickerOpen) {
      return (
        <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
          <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[var(--color-brand-border)]">
            <button
              onClick={() => setPickerOpen(false)}
              aria-label="Back"
              className="flex items-center gap-1 text-[15px] font-bold text-white/90 font-sans mb-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-1.5 text-[var(--color-brand-on-accent)] font-bold text-[15px] tracking-wider uppercase font-serif italic">
              <ListChecks className="w-3.5 h-3.5" /> Choose your station
            </div>
            <h2 className="text-2xl font-bold font-serif italic tracking-tight">
              Where are you standing?
            </h2>
            <p className="text-[15px] text-[var(--color-brand-secondary)] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
              Pick the station in front of you and we&rsquo;ll show what the scan would have.
            </p>
          </div>

          <div className="p-4 space-y-2.5">
            {stations.length === 0 ? (
              <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-5 shadow-xs text-center">
                <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans">
                  No stations are listed for this parish yet.
                </p>
              </div>
            ) : (
              stations.map((station) => (
                <button
                  key={station.id}
                  onClick={() => pickStation(station)}
                  className="w-full flex items-center justify-between gap-3 bg-[var(--color-brand-card)] rounded-2xl border border-[var(--color-brand-border)] p-4 shadow-xs text-left active:scale-[0.98] transition-transform"
                >
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold text-[var(--color-brand-text)] font-serif italic truncate">
                      {station.name}
                    </span>
                    <span className="block text-[14px] text-[var(--color-brand-text)]/70 font-sans truncate">
                      {stationText(station, language).description}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      );
    }

    return (
      /* No overflow here: App's .app-scroll is the page's one scroller, and a
         second one inside it would scroll the cards while leaving the parish
         band - which sits outside this component - stationary above them. */
      <div className="flex-1 flex flex-col bg-[var(--color-brand-card)]">
        {/* The flat navy panel with the faded clip-art scan icon used to sit
            here. The parish band above this screen says the same thing in
            the parish's own photography, so a second header was two titles
            for one tab. */}

        <div className="p-4 space-y-3">
          {/* Two ways in, offered as a choice. The museum walk and the
              scanner are different things - one is a guided tour of the
              parish's own pieces, the other identifies whatever is in
              front of you - and the old screen buried the first under a
              link beneath the second. */}

          <section className="scan-card">
            <span className="scan-card__media">
              <img src={museumImage} alt="" loading="lazy" />
              <span className="scan-card__scrim" aria-hidden />
              <span className="scan-card__title">AR Museum</span>
            </span>
            <div className="scan-card__body">
              <p className="scan-card__blurb">
                Walk the parish's own statues and history, placed where they
                stand in the church.
              </p>
              <ArTourLaunch parishId={parishId} />
            </div>
          </section>

          <section className="scan-card">
            <span className="scan-card__media">
              <img src={scannerImage} alt="" loading="lazy" />
              <span className="scan-card__scrim" aria-hidden />
              <span className="scan-card__title">Scanner</span>
            </span>
            <div className="scan-card__body">
              <p className="scan-card__blurb">
                {camera.status === "requesting"
                  ? "Opening the camera…"
                  : statusCopy?.title
                    ? statusCopy.title
                    : "Point your camera at an altar, statue or marker and the app will tell you what it is."}
              </p>

              {/* The privacy line stays with the button that asks for the
                  camera - it is the answer to the permission prompt the
                  pilgrim is about to see. */}
              <p className={`scan-card__note${camera.error ? " scan-card__note--error" : ""}`}>
                {camera.error ?? "Nothing is recorded — frames are analysed and discarded."}
              </p>

              {camera.status !== "insecure" && (
                <button
                  type="button"
                  onClick={() => void camera.start()}
                  disabled={camera.status === "requesting"}
                  className="scan-card__action"
                >
                  {camera.status === "requesting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Opening…
                    </>
                  ) : statusCopy?.icon === "offline" ? (
                    <>
                      <WifiOff className="w-4 h-4" /> Try again
                    </>
                  ) : camera.error ? (
                    <>
                      <AlertTriangle className="w-4 h-4" /> Try again
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" /> Scan now
                    </>
                  )}
                </button>
              )}
            </div>
          </section>

          {result && !sheetOpen && (
            <button
              onClick={() => setSheetOpen(true)}
              className="w-full flex items-center justify-between gap-2 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)] rounded-2xl py-3 px-4 font-sans active:scale-[0.98] transition-transform"
            >
              <span className="min-w-0 text-left">
                <span className="block text-[14px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
                  Last result
                </span>
                <span className="block text-[15px] font-bold truncate">{result.title}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
            </button>
          )}

          {/* The fallback that "always works": the camera is a browser
              permission the app cannot force open on an insecure origin, so
              offer the same station information another way rather than
              leaving a dead end. */}
          {showManualFallback && (
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)] rounded-2xl py-3 font-bold text-[15px] font-sans active:scale-[0.98] transition-transform"
            >
              <ListChecks className="w-4 h-4" /> Choose your station manually instead
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------- camera view */

  const busy = phase === "scanning";

  /* ---- what the overlay says, per mode and stage ---- */

  const arStation = stations[arStop] ?? null;

  const headline =
    mode === "ai"
      ? busy
        ? { title: "Reading what you see", sub: "Hold steady" }
        // One line at phone width. The longer version wrapped and shoved
        // the subtitle down over the viewfinder.
        : { title: "Point at a statue or marker", sub: "The AI scanner names it and tells you about it" }
      : arStage === "find"
        ? { title: "Find the SanctiWalk marker", sub: "The AR tour opens only at a marker — look for one beside the station" }
        : arStage === "reading"
          ? { title: "Hold the marker in the frame", sub: "Keep steady while it is read" }
          : { title: arStation?.name ?? "AR tour running", sub: "Follow the markers around the church" };

  function startAr() {
    setArError(null);
    setArStage("reading");

    // The marker itself is read by the Unity app, not by this WebView.
    // The pause is the handover, not a fake detection: it gives the
    // pilgrim a moment to see that something happened before another
    // app takes the screen.
    window.setTimeout(() => {
      const left = () => document.visibilityState === "hidden";

      window.location.href = arTourUrl(parishId ?? "route-mhcp");

      /*
       * Nothing happens when the AR app is not installed.
       *
       * A custom scheme fails silently: no error, no navigation, the
       * page simply stays put. Without this check the pilgrim would be
       * left looking at "Reading the marker" for ever, with the app
       * apparently frozen. If we are still here and still visible a
       * moment later, the handover did not take.
       */
      window.setTimeout(() => {
        if (left()) {
          setArStage("live");
        } else {
          setArStage("find");
          setArError(
            "The SanctiWalk AR app did not open. It is a separate Android app — install it, then try again.",
          );
        }
      }, 1200);
    }, 1200);
  }

  return (
    <div className="scan flex-1 relative bg-black overflow-hidden">
      <video
        ref={camera.videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${
          camera.facingMode === "user" ? "scale-x-[-1]" : ""
        }`}
        playsInline
        muted
        autoPlay
      />

      {/* Keeps the controls legible over a bright window or a dark nave. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.45), transparent 22%, transparent 55%, rgba(0,0,0,0.6))",
        }}
      />

      {/* The instruction, over the feed. */}
      {!sheetOpen && (
        <ScannerHeader
          title={headline.title}
          subtitle={headline.sub}
          onClose={onClose}
        />
      )}

      {/* The target. In AI mode it frames whatever is being pointed at;
          in AR it frames the marker while it is read. */}
      {!sheetOpen && !(mode === "ar" && arStage === "find") && (
        <ScannerReticle tight={busy || (mode === "ar" && arStage === "reading")} />
      )}

      {/* What to look for, when the pilgrim is not at a marker yet. */}
      {!sheetOpen && mode === "ar" && arStage === "find" && (
        <div className="scan-marker">
          <span className="scan-marker__tile">
            <img src="/ui/sanctiwalk-icon-512.png" alt="" />
          </span>
          <span className="scan-marker__label">SanctiWalk marker</span>
        </div>
      )}

      {!sheetOpen && mode === "ar" && arStage === "live" && (
        <span className="scan-chip">
          <span className="scan-chip__dot" aria-hidden />
          AR tour running
        </span>
      )}

      {/* Status pill */}
      {/* Status pill */}
      {(busy || error) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-[85%] px-4 py-2 rounded-full bg-black/65 backdrop-blur-md border border-white/15 flex items-center gap-2">
          {busy && <Loader2 className="w-3.5 h-3.5 text-[var(--color-brand-on-accent)] animate-spin shrink-0" />}
          <span
            className={`text-[15px] font-sans font-medium ${error ? "text-[var(--color-brand-error-soft)]" : "text-white"}`}
          >
            {busy ? "Looking…" : error}
          </span>
        </div>
      )}


      {/* The sheet: the switch, and whatever the chosen scanner needs. */}
      {!sheetOpen && (
        <ScannerSheet>
          <ScannerTabs
            mode={mode}
            onChange={next => {
              setMode(next);
              setError(null);
              // Coming back to AR should ask again where you are, not
              // resume a tour you walked away from.
              if (next === "ar") setArStage("find");
            }}
          />

          {mode === "ai" ? (
            <>
              <button
                type="button"
                onClick={() => void scan()}
                disabled={busy}
                aria-label="Identify what the camera is pointed at"
                className="scan-shutter"
              >
                <span className={`scan-shutter__core${busy ? " is-busy" : ""}`} />
              </button>

              <p className="scan-caption">
                {budget && budget.remaining === 0
                  ? "No scans left today — the allowance resets tomorrow."
                  : budget
                    ? `Tap to identify. ${budget.remaining} of ${budget.limit} scans left today.`
                    : "Tap to identify. The parish code is read automatically."}
              </p>
            </>
          ) : (
            <ArScannerPanel
              stage={arStage}
              error={arError}
              onFoundMarker={startAr}
              onEndTour={() => { setArStage("find"); setArStop(0); }}
              onNextStop={() => setArStop(i => (i + 1) % Math.max(stations.length, 1))}
              station={arStation}
              stopNumber={arStop + 1}
              stopCount={stations.length}
              parishName={parishName}
            />
          )}
        </ScannerSheet>
      )}

      {/* Information card */}
      {result && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-[var(--color-brand-card)] rounded-t-[2rem] border-t border-[var(--color-brand-border)] shadow-2xl transition-transform duration-500 ease-out ${
            sheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight: "72%" }}
        >
          <div className="flex items-start gap-3 p-5 pb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[14px] font-bold uppercase tracking-[0.09em] text-[var(--color-brand-accent)] font-sans">
                  {result.category}
                </span>
                {result.confidence != null && (
                  <span className="text-[14px] text-[var(--color-brand-secondary)] font-sans">
                    {Math.round(result.confidence * 100)}% match
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-[var(--color-brand-text)] font-serif italic leading-tight">
                {result.title}
              </h3>
              {/* Recognised, but not one of this parish's stations. Saying so
                  keeps the tour's own list meaningful while still answering
                  the question the pilgrim actually asked. */}
              {result.matchedStation === false && (
                <p className="mt-1.5 text-[15px] leading-snug text-[var(--color-brand-secondary)]">
                  Not one of this parish's tour stations — identified from the camera.
                </p>
              )}
            </div>
            <button
              onClick={() => setSheetOpen(false)}
              aria-label="Close"
              className="h-9 w-9 rounded-xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] flex items-center justify-center text-[var(--color-brand-text)] shrink-0 active:scale-95 transition-transform"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: "calc(72vh - 90px)" }}>
            {/* The station's own photograph, when one exists. Deliberately
                nothing when it does not: four of these carried stock images
                of unrelated churches until this pass, and an empty space is
                more honest than another parish's altar. */}
            {currentStation?.imageUrl && (
              <img
                src={currentStation.imageUrl}
                alt={currentStation.name}
                className="mb-4 w-full h-40 object-cover rounded-2xl border border-[var(--color-brand-border)]"
                loading="lazy"
              />
            )}

            <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans">{result.summary}</p>

            {result.highlights?.length > 0 && (
              <ul className="mt-4 space-y-2">
                {result.highlights.map((fact) => (
                  <li key={fact} className="flex gap-2.5 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-accent)] mt-2 shrink-0" />
                    <span className="text-[14px] text-[var(--color-brand-text)] leading-relaxed font-sans">
                      {fact}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Three ways to arrive at this card, three different degrees of
                certainty, said plainly. A pilgrim should know which text is
                parish-verified and which is not — the same principle as
                coordinatesVerified and scheduleVerified in data.ts. */}
            {result.source === "manual" ? (
              <div className="mt-5 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-sm font-bold text-amber-900 leading-snug font-sans">
                  Selected manually — not confirmed by a camera scan.
                </span>
              </div>
            ) : result.source === "qr" ? (
              // The most certain of the three, and it should read that way.
              // The parish printed this code beside this station; nothing was
              // inferred and there is nothing here for a model to get wrong.
              <div className="mt-5 flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                <QrCode className="w-4 h-4 text-emerald-800 shrink-0" />
                <span className="text-sm font-bold text-emerald-900 leading-snug font-sans">
                  Confirmed by the parish's own code — this is the station in front of you.
                </span>
              </div>
            ) : (
              <p className="mt-5 text-[15px] text-[var(--color-brand-secondary)] leading-relaxed font-sans bg-[var(--color-brand-card)]/70 border border-[var(--color-brand-border)] rounded-xl p-3">
                Identified by AI from your camera. Details may be incomplete — the parish record
                is the authority.
              </p>
            )}

            {/* Walks the church in order, so a pilgrim does not have to go
                back to the picker between every station. It names the next
                stop rather than saying "Next" — knowing you are being sent to
                the Baptismal Font is what makes it worth following. */}
            {nextStation && (
              <button
                type="button"
                onClick={() => pickStation(nextStation)}
                className="mt-5 w-full flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card-sunk)] p-4 text-left active:scale-[0.99] transition-transform"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-secondary)]">
                    Next location
                  </span>
                  <span className="mt-0.5 block text-[16px] font-semibold text-[var(--color-brand-text)] leading-snug">
                    {nextStation.name}
                  </span>
                </span>
                <ChevronRight className="w-5 h-5 shrink-0 text-[var(--color-brand-primary)]" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
