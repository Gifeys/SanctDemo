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
}

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
        setStatus("ready");

        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err) {
        if (token !== startTokenRef.current) return;
        const e = err as DOMException;
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

    // play() can reject if the browser wants a fresher gesture; the stream is
    // still live and the element will usually paint anyway, so this must never
    // throw into the UI.
    void video.play().catch(() => {});
  }, [status]);

  /** Current frame as base64 JPEG, or null when the video isn't ready. */
  const captureFrame = useCallback((): CapturedFrame | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const canvas =
      canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));

    // Downscale — the model doesn't need sensor resolution, and a smaller frame
    // is most of the difference in perceived speed on a phone.
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    return { base64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" };
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
