import { useEffect, useRef, useState, type RefObject } from 'react'
import jsQR from 'jsqr'
import { resolveScannedQr, type QrScanResult } from './qr'

/**
 * Continuous QR scanning over an already-running camera stream.
 *
 * It deliberately does NOT own a camera. useCamera already holds the stream,
 * the secure-origin check and the permission handling; opening a second
 * MediaStream for the same device is how you get "camera in use" errors and a
 * second green recording dot. This reads frames out of the <video> that is
 * already on screen.
 *
 * Decoding is jsQR, not the browser's BarcodeDetector. BarcodeDetector is
 * faster where it exists but is absent on iOS Safari — the platform this app
 * is being demonstrated on — so it is a fast path, never the implementation.
 */

/** How often to look for a code. */
const SCAN_INTERVAL_MS = 220

/**
 * Frames are downscaled to this width before decoding.
 *
 * jsQR walks every pixel, so a full 1080p frame costs tens of milliseconds
 * several times a second on a mid-range phone — enough to make the camera
 * preview stutter, which reads as the app being broken. A printed poster's
 * code is comfortably legible at this width from normal scanning distance.
 */
const DECODE_WIDTH = 640

/**
 * How long the same code is ignored after being reported.
 *
 * Without this, a poster held in frame reports the same station five times a
 * second. The point is not throttling for its own sake: each report opens a
 * screen, and re-opening it under the pilgrim's finger makes the app feel
 * possessed.
 */
const REPEAT_SUPPRESSION_MS = 2500

interface UseQrScannerOptions {
  /** Scanning only runs while this is true. */
  active: boolean
  /** Called once per distinct code seen. */
  onResult: (result: QrScanResult, raw: string) => void
}

export interface QrScannerState {
  /** True while a frame is being looked at — for a subtle "looking" hint. */
  scanning: boolean
  /** The most recent raw payload seen, whether or not it was one of ours. */
  lastRaw: string | null
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

function nativeDetector(): BarcodeDetectorLike | null {
  const ctor = (window as unknown as {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
  }).BarcodeDetector

  if (typeof ctor !== 'function') return null
  try {
    return new ctor({ formats: ['qr_code'] })
  } catch {
    // Constructing throws when the format is unsupported. Not an error worth
    // reporting — jsQR handles it either way.
    return null
  }
}

export function useQrScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  { active, onResult }: UseQrScannerOptions,
): QrScannerState {
  const [scanning, setScanning] = useState(false)
  const [lastRaw, setLastRaw] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Held in a ref so changing the handler does not restart the scan loop,
  // which would drop the suppression state and re-fire the code in frame.
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const lastReportedRef = useRef<{ code: string; at: number } | null>(null)

  useEffect(() => {
    if (!active) {
      setScanning(false)
      lastReportedRef.current = null
      return
    }

    setScanning(true)
    const detector = nativeDetector()
    let stopped = false
    let timer: number | undefined

    const readFrame = async () => {
      if (stopped) return
      const video = videoRef.current

      // readyState < 2 means no frame has been decoded yet, so the canvas
      // would hold a blank rectangle rather than the scene.
      if (!video || video.readyState < 2 || !video.videoWidth) {
        timer = window.setTimeout(readFrame, SCAN_INTERVAL_MS)
        return
      }

      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
      const scale = Math.min(1, DECODE_WIDTH / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        console.error('[Scanner] QR: no 2D context — cannot decode')
        stopped = true
        setScanning(false)
        return
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      let raw: string | null = null

      if (detector) {
        try {
          const found = await detector.detect(canvas)
          raw = found[0]?.rawValue ?? null
        } catch {
          // A detector that throws mid-session falls through to jsQR rather
          // than stopping the scan.
          raw = null
        }
      }

      if (!raw) {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        // "attemptBoth" reads codes printed light-on-dark as well as the
        // usual dark-on-light — a parish is as likely to print white on navy.
        raw = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'attemptBoth',
        })?.data ?? null
      }

      if (raw && !stopped) {
        const now = Date.now()
        const last = lastReportedRef.current
        const isRepeat = last?.code === raw && now - last.at < REPEAT_SUPPRESSION_MS

        if (!isRepeat) {
          lastReportedRef.current = { code: raw, at: now }
          setLastRaw(raw)
          const result = resolveScannedQr(raw)
          console.log(
            `[Scanner] QR read: ${JSON.stringify(raw.slice(0, 80))} → ${result.kind}`,
          )
          onResultRef.current(result, raw)
        }
      }

      if (!stopped) timer = window.setTimeout(readFrame, SCAN_INTERVAL_MS)
    }

    void readFrame()

    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
      setScanning(false)
    }
  }, [active, videoRef])

  return { scanning, lastRaw }
}
