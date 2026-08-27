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
} from "lucide-react";
import { useCamera, type CameraStatus } from "../lib/useCamera";
import type { Station } from "../types";

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
  /** "ai" = the camera actually recognised this. "manual" = the pilgrim
   *  picked it from the list because the camera couldn't open or couldn't
   *  tell. Mirrors the coordinatesVerified / scheduleVerified pattern in
   *  data.ts: unverified data is shown, but never labelled as confirmed. */
  source: "ai" | "manual";
  /** False when the subject was recognised but is not one of this parish's
   *  own stations — the camera still says what it is, it just isn't part of
   *  the tour. Undefined for manual picks and for open recognition. */
  matchedStation?: boolean;
}

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

function stationToRecognition(station: Station): Recognition {
  const highlights = [
    station.history && `History: ${station.history}`,
    station.reflection && `Reflection: ${station.reflection}`,
  ].filter((v): v is string => Boolean(v));

  return {
    recognized: true,
    title: station.name,
    category: "Station",
    summary: station.description,
    highlights,
    source: "manual",
  };
}

export default function ArTour({ stations = [] }: { stations?: Station[] }) {
  const camera = useCamera();
  const stationNames = stations.map((s) => s.name);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Recognition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [budget, setBudget] = useState<ScanBudget | null>(null);

  // Fetched once so the remaining count is visible before anyone spends one.
  // Failure is silent: the counter just doesn't appear, rather than blocking
  // a scan over a number that is only informational.
  useEffect(() => {
    let live = true;
    void fetch("/api/identify/budget")
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

    if (!capture.ok) {
      // Each reason gets its own words. "It didn't work" is the same message
      // for a camera that has not painted a frame yet and for one that never
      // will, and those need different actions from the pilgrim.
      const message: Record<typeof capture.reason, string> = {
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
    try {
      const response = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setError(
        err instanceof TypeError
          ? "Could not reach the server. Check your connection and try again."
          : "Something went wrong reading the result. Please try again.",
      );
      setPhase("idle");
    }
  }, [camera, stationNames]);

  const pickStation = useCallback((station: Station) => {
    setResult(stationToRecognition(station));
    setSheetOpen(true);
    setPhase("done");
    setPickerOpen(false);
  }, []);

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
                      {station.description}
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
      <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] overflow-y-auto">
        <div className="bg-[var(--color-brand-primary)] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[var(--color-brand-border)]">
          <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
            <ScanLine className="w-32 h-32 text-white" />
          </div>
          <div className="flex items-center gap-1.5 text-[var(--color-brand-on-accent)] font-bold text-[15px] tracking-wider uppercase font-serif italic">
            <Sparkles className="w-3.5 h-3.5" /> Augmented Reality
          </div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">AR Tour</h2>
          <p className="text-[15px] text-[var(--color-brand-secondary)] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Point your camera at a feature of the church to learn about it.
          </p>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-5 shadow-xs space-y-3 text-center">
            <div className="h-14 w-14 rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] flex items-center justify-center mx-auto text-[var(--color-brand-accent)]">
              {camera.status === "requesting" ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : statusCopy?.icon === "offline" ? (
                <WifiOff className="w-7 h-7 text-[var(--color-brand-error)]" />
              ) : camera.error ? (
                <AlertTriangle className="w-7 h-7 text-[var(--color-brand-error)]" />
              ) : (
                <Camera className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-base font-bold text-[var(--color-brand-text)] font-serif italic">
              {camera.status === "requesting" ? "Opening the camera…" : statusCopy?.title ?? "Start the AR Tour"}
            </h3>

            <p className="text-[15px] text-[var(--color-brand-text)] leading-relaxed font-sans">
              {camera.error ??
                "The tour uses your camera to recognise altars, statues, and markers around the parish. Nothing is recorded — frames are analysed and discarded."}
            </p>

            {camera.status !== "requesting" && camera.status !== "insecure" && (
              <button
                onClick={() => void camera.start()}
                className="w-full bg-[var(--color-brand-primary)] text-white rounded-2xl py-3 font-bold text-[15px] font-sans active:scale-[0.98] transition-transform"
              >
                {camera.status === "denied" || camera.status === "in-use" || camera.status === "error"
                  ? "Try again"
                  : "Open camera"}
              </button>
            )}
          </div>

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

  return (
    <div className="flex-1 relative bg-black overflow-hidden">
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

      {/* Reticle */}
      {!sheetOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`relative transition-transform duration-500 ${busy ? "scale-95" : ""}`}
            style={{ width: "min(62%, 240px)", aspectRatio: "1", marginTop: "-8%" }}
          >
            <span
              className={`absolute top-0 left-0 w-7 h-7 rounded-tl-lg border-t-[2.5px] border-l-[2.5px] transition-colors duration-500 ${busy ? "border-[var(--color-brand-on-accent)]" : "border-white/85"}`}
            />
            <span
              className={`absolute top-0 right-0 w-7 h-7 rounded-tr-lg border-t-[2.5px] border-r-[2.5px] transition-colors duration-500 ${busy ? "border-[var(--color-brand-on-accent)]" : "border-white/85"}`}
            />
            <span
              className={`absolute bottom-0 left-0 w-7 h-7 rounded-bl-lg border-b-[2.5px] border-l-[2.5px] transition-colors duration-500 ${busy ? "border-[var(--color-brand-on-accent)]" : "border-white/85"}`}
            />
            <span
              className={`absolute bottom-0 right-0 w-7 h-7 rounded-br-lg border-b-[2.5px] border-r-[2.5px] transition-colors duration-500 ${busy ? "border-[var(--color-brand-on-accent)]" : "border-white/85"}`}
            />
          </div>
        </div>
      )}

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

      {/* Recognised label — tap to reopen the full card */}
      {result && !sheetOpen && (
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute left-1/2 -translate-x-1/2 bottom-32 max-w-[80%] flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 text-left active:scale-[0.97] transition-transform"
        >
          <span className="flex flex-col min-w-0">
            <span className="text-[14px] font-bold uppercase tracking-[0.09em] text-[var(--color-brand-on-accent)] font-sans">
              {result.category}
            </span>
            <span className="text-[15px] font-semibold text-white truncate font-sans">
              {result.title}
            </span>
          </span>
        </button>
      )}

      {/* Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-9">
        <button
          onClick={camera.switchCamera}
          disabled={!camera.hasMultipleCameras}
          aria-label="Switch camera"
          className="w-14 h-14 rounded-2xl bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/85 disabled:opacity-30 active:scale-95 transition-transform"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>

        <button
          onClick={() => void scan()}
          disabled={busy}
          aria-label="Scan what the camera is pointed at"
          className="w-[74px] h-[74px] rounded-full border-[3px] border-white/85 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-70"
        >
          <span
            className={`rounded-full bg-[var(--color-brand-on-accent)] transition-all duration-300 ${busy ? "w-6 h-6" : "w-14 h-14"}`}
          />
        </button>

        <div className="w-14" aria-hidden />
      </div>

      {/* Recognitions left today. The allowance sits on the server's single
          API key and is shared by every device, so this is the real number,
          not a per-phone guess. It only appears once the count is known. */}
      {budget && (
        <div className="absolute bottom-[104px] left-0 right-0 flex justify-center pointer-events-none">
          <span
            className={`text-[14px] font-semibold px-3 py-1.5 rounded-full backdrop-blur-md border ${
              budget.remaining === 0
                ? "bg-[var(--color-brand-error)]/85 border-white/20 text-white"
                : "bg-black/45 border-white/15 text-white/90"
            }`}
          >
            {budget.remaining === 0
              ? `No scans left today · resets tomorrow`
              : `${budget.remaining} of ${budget.limit} scans left today`}
          </span>
        </div>
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

            {/* Recognition is AI-generated (or, on the fallback path, a
                manual pick). Say which — a pilgrim should know which text is
                parish-verified and which is not. */}
            {result.source === "manual" ? (
              <div className="mt-5 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-sm font-bold text-amber-900 leading-snug font-sans">
                  Selected manually — not confirmed by a camera scan.
                </span>
              </div>
            ) : (
              <p className="mt-5 text-[15px] text-[var(--color-brand-secondary)] leading-relaxed font-sans bg-[var(--color-brand-card)]/70 border border-[var(--color-brand-border)] rounded-xl p-3">
                Identified by AI from your camera. Details may be incomplete — the parish record
                is the authority.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
