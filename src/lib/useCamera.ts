import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useCamera — owns the MediaStream lifecycle for the AR Tour.
 *
 * Returns a ref for a <video>, permission/error state, a front/back flip, and
 * captureFrame() which grabs the current frame as base64 JPEG for the vision
 * endpoint.
 *
 * Note the camera only works on a secure origin: https, or localhost. On a bare
 * LAN IP the browser refuses regardless of permission, which is the usual cause
 * of "it works on my laptop but not my phone".
 */

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable"
  | "insecure"
  | "in-use"
  | "error";

export interface CapturedFrame {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  /** Encoded size in bytes, before base64 inflation. */
  bytes: number;
  /** Mean luminance 0-255, used to catch a frame taken in the dark. */
  brightness: number;
}

/**
 * Why a capture failed. `captureFrame` used to return plain null, which the
 * caller could only translate into a single vague message — or, as it did,
 * into nothing at all.
 */
export type CaptureFailure =
  | "no-video"       // the <video> element is not mounted
  | "not-ready"      // stream is live but no frame has painted yet
  | "no-canvas"      // 2D context unavailable
  | "encode-failed"; // toDataURL produced nothing usable

export type CaptureResult =
  | { ok: true; frame: CapturedFrame }
  | { ok: false; reason: CaptureFailure };

/**
 * True when getUserMedia can even be attempted here. False on a bare LAN IP
 * over plain HTTP (e.g. http://192.168.1.7:5173) — the browser hides
 * mediaDevices entirely rather than prompting and denying, so this has to be
 * checked before calling start(), not inferred from a caught error.
 */
export function isCameraSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices;
}

function insecureContextMessage(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "this address";
  return (
    `The camera needs a secure connection, and ${origin} is not one. ` +
    "Open the app's HTTPS address instead (ask whoever set this up for the " +
    "https:// link), or use the app's deployed URL. On a self-signed HTTPS " +
    "address your phone will show a one-time security warning — that is " +
    "expected, tap through it."
  );
}

export function useCamera({ autoStart = false }: { autoStart?: boolean } = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Guards against getUserMedia resolving after teardown or a newer start().
  const startTokenRef = useRef(0);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stop = useCallback(() => {
    startTokenRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(
    async (mode: "environment" | "user" = facingMode) => {
      if (!isCameraSecureContext() || !navigator.mediaDevices?.getUserMedia) {
        setStatus("insecure");
        setError(insecureContextMessage());
        return;
      }

      console.log(`[Scanner] Camera initialized: requesting ${mode} camera`);
      setStatus("requesting");
      setError(null);

      startTokenRef.current++;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const token = startTokenRef.current;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // `ideal` rather than `exact`, so a laptop with one webcam still works.
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });

        if (token !== startTokenRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Deliberately NOT attaching the stream here.
        //
        // The <video> element only exists once status is "ready" — ArTour
        // returns a different screen for every other status. So at this point
        // videoRef.current is still null, the assignment would be skipped
        // silently, and the user would get a live camera behind a black
        // rectangle with no error to explain it. The attach happens in the
        // effect below, once React has actually mounted the element.
        console.log("[Scanner] Camera permission: granted");
        setStatus("ready");

        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err) {
        if (token !== startTokenRef.current) return;
        const e = err as DOMException;
        console.error(`[Scanner] Scanner error: getUserMedia failed — ${e.name}: ${e.message}`);
        if (e.name === "NotAllowedError" || e.name === "SecurityError") {
          setStatus("denied");
          setError(
            "Camera permission was denied. Re-enable it from the camera icon in your " +
              "browser's address bar (or Settings → Site settings → Camera on mobile), " +
              "then try again.",
          );
        } else if (e.name === "NotFoundError" || e.name === "OverconstrainedError") {
          setStatus("unavailable");
          setError("No camera was found on this device.");
        } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
          setStatus("in-use");
          setError(
            "The camera is already in use by another app. Close any other camera app " +
              "(or browser tab using the camera) and try again.",
          );
        } else {
          setStatus("error");
          setError(e.message || "The camera could not be started.");
        }
      }
    },
    [facingMode],
  );

  const switchCamera = useCallback(() => {
    setFacingMode((current) => {
      const next = current === "environment" ? "user" : "environment";
      void start(next);
      return next;
    });
  }, [start]);

  // Attach the live stream once the <video> is actually on the page.
  //
  // This runs after the render that mounts the element, which is the whole
  // point: start() acquires the stream while the video element does not yet
  // exist, so the attach cannot happen there. Keyed on `status` so it fires
  // exactly when the element appears, and re-runs after a camera switch.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (status !== "ready" || !video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    console.log(
      `[Scanner] Camera is ready: ${settings?.width ?? "?"}x${settings?.height ?? "?"} ` +
        `facing ${settings?.facingMode ?? "?"}`,
    );

    // play() can reject if the browser wants a fresher gesture; the stream is
    // still live and the element will usually paint anyway, so this must never
    // throw into the UI.
    void video.play().catch(() => {});
  }, [status]);

  /**
   * The current frame as a base64 JPEG, with the checks that make a failure
   * explainable instead of silent.
   *
   * Capture width is 960, not the sensor's. A larger frame is not a better
   * answer: measured against the same photograph of a crowned Marian statue,
   * 640px produced "Statue of Our Lady with the Child Jesus" and 1280px
   * produced "Our Lady of the Rosary" — more specific, and wrong. Resolution
   * is not what limits recognition here, so 960 is chosen as headroom for a
   * genuinely distant subject rather than as an accuracy fix.
   */
  const captureFrame = useCallback((): CaptureResult => {
    const video = videoRef.current;
    if (!video) {
      console.warn("[Scanner] Capturing image: no <video> element mounted");
      return { ok: false, reason: "no-video" };
    }

    // readyState < 2 means metadata may exist but no frame has been decoded,
    // so drawImage would paint a blank rectangle rather than the scene.
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      console.warn(
        `[Scanner] Capturing image: video not ready (${video.videoWidth}x${video.videoHeight}, readyState ${video.readyState})`,
      );
      return { ok: false, reason: "not-ready" };
    }

    const canvas =
      canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));

    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      console.error("[Scanner] Capturing image: no 2D context");
      return { ok: false, reason: "no-canvas" };
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    console.log(`[Scanner] Image dimensions: ${canvas.width}x${canvas.height} (source ${video.videoWidth}x${video.videoHeight})`);

    // Mean luminance over a sparse grid. Cheap, and it distinguishes "the
    // lens cap is on / the church is dark" from "the model could not tell",
    // which are the same message to a pilgrim otherwise.
    let brightness = 0;
    try {
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      let count = 0;
      for (let i = 0; i < sample.length; i += 4 * 97) {
        total += 0.2126 * sample[i] + 0.7152 * sample[i + 1] + 0.0722 * sample[i + 2];
        count++;
      }
      brightness = count ? total / count : 0;
    } catch {
      // A tainted canvas cannot be read. Not fatal — brightness is advice,
      // not a gate.
      brightness = -1;
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1] ?? "";
    if (base64.length < 512) {
      console.error(`[Scanner] Image encoding: produced only ${base64.length} chars — treating as failed`);
      return { ok: false, reason: "encode-failed" };
    }

    const bytes = Math.round(base64.length * 0.75);
    console.log(`[Scanner] Encoded image size: ${(bytes / 1024).toFixed(0)} KB, brightness ${brightness.toFixed(0)}/255`);

    return {
      ok: true,
      frame: { base64, mimeType: "image/jpeg", width: canvas.width, height: canvas.height, bytes, brightness },
    };
  }, []);

  // Always release the camera when the tab unmounts — a live green dot after
  // leaving the AR tab reads as the app spying on you.
  useEffect(() => {
    if (autoStart) void start();
    return () => {
      startTokenRef.current++;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    status,
    error,
    facingMode,
    hasMultipleCameras,
    isReady: status === "ready",
    start,
    stop,
    switchCamera,
    captureFrame,
  };
}
