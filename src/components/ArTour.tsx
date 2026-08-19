import { useCallback, useState } from "react";
import {
  Camera,
  ScanLine,
  SwitchCamera,
  X,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useCamera } from "../lib/useCamera";

/**
 * ArTour — the camera experience behind the AR Tour tab.
 *
 * The camera fills the tab and stays visible; recognised information rises over
 * it as a card rather than replacing it. That is the decision recorded in
 * docs/ar-and-pilgrim-tour-decisions.md — an information card anchored over the
 * camera view, not a 3D model.
 *
 * `stationNames` is the accuracy lever. Passing the current parish's stations
 * turns open-ended recognition ("what statue is this, out of everything in the
 * world") into a multiple choice, which the model is far better at. See
 * /api/identify in server.ts.
 */

interface Recognition {
  recognized: boolean;
  title: string;
  category: string;
  confidence: number;
  summary: string;
  highlights: string[];
}

type Phase = "idle" | "scanning" | "done";

export default function ArTour({ stationNames = [] }: { stationNames?: string[] }) {
  const camera = useCamera();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Recognition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const scan = useCallback(async () => {
    const frame = camera.captureFrame();
    if (!frame) return;

    setPhase("scanning");
    setError(null);

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

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "Recognition failed. Please try again.");
        setPhase("idle");
        return;
      }

      if (!data.recognized) {
        // Not an error — say so plainly instead of inventing an answer.
        setError("Nothing recognisable in view. Move closer, or steady the camera.");
        setPhase("idle");
        return;
      }

      setResult(data as Recognition);
      setSheetOpen(true);
      setPhase("done");
    } catch {
      setError("Could not reach the server. Check your connection.");
      setPhase("idle");
    }
  }, [camera, stationNames]);

  /* ------------------------------------------------------------ permission */

  if (camera.status !== "ready") {
    return (
      <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
        <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
          <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
            <ScanLine className="w-32 h-32 text-white" />
          </div>
          <div className="flex items-center gap-1.5 text-[#5FC7DE] font-bold text-[15px] tracking-wider uppercase font-serif italic">
            <Sparkles className="w-3.5 h-3.5" /> Augmented Reality
          </div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">AR Tour</h2>
          <p className="text-[15px] text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Point your camera at a feature of the church to learn about it.
          </p>
        </div>

        <div className="p-4">
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-5 shadow-xs space-y-3 text-center">
            <div className="h-14 w-14 rounded-2xl bg-[#EBEBE0] border border-[#D6D6C2] flex items-center justify-center mx-auto text-[#147288]">
              {camera.status === "requesting" ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : camera.error ? (
                <AlertTriangle className="w-7 h-7 text-[#B3543F]" />
              ) : (
                <Camera className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-base font-bold text-[#4A4A35] font-serif italic">
              {camera.status === "requesting"
                ? "Opening the camera…"
                : camera.status === "denied"
                  ? "Camera permission needed"
                  : camera.error
                    ? "Camera unavailable"
                    : "Start the AR Tour"}
            </h3>

            <p className="text-[15px] text-[#33332D] leading-relaxed font-sans">
              {camera.error ??
                "The tour uses your camera to recognise altars, statues, and markers around the parish. Nothing is recorded — frames are analysed and discarded."}
            </p>

            {camera.status === "denied" && (
              <p className="text-[13px] text-[#33332D]/70 leading-relaxed font-sans">
                Re-enable the camera from the icon in your browser&rsquo;s address bar, then try
                again.
              </p>
            )}

            {camera.status !== "requesting" && (
              <button
                onClick={() => void camera.start()}
                className="w-full bg-[#5A5A40] text-white rounded-2xl py-3 font-bold text-[15px] font-sans active:scale-[0.98] transition-transform"
              >
                {camera.status === "denied" ? "Try again" : "Open camera"}
              </button>
            )}
          </div>
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
              className={`absolute top-0 left-0 w-7 h-7 rounded-tl-lg border-t-[2.5px] border-l-[2.5px] transition-colors duration-500 ${busy ? "border-[#5FC7DE]" : "border-white/85"}`}
            />
            <span
              className={`absolute top-0 right-0 w-7 h-7 rounded-tr-lg border-t-[2.5px] border-r-[2.5px] transition-colors duration-500 ${busy ? "border-[#5FC7DE]" : "border-white/85"}`}
            />
            <span
              className={`absolute bottom-0 left-0 w-7 h-7 rounded-bl-lg border-b-[2.5px] border-l-[2.5px] transition-colors duration-500 ${busy ? "border-[#5FC7DE]" : "border-white/85"}`}
            />
            <span
              className={`absolute bottom-0 right-0 w-7 h-7 rounded-br-lg border-b-[2.5px] border-r-[2.5px] transition-colors duration-500 ${busy ? "border-[#5FC7DE]" : "border-white/85"}`}
            />
          </div>
        </div>
      )}

      {/* Status pill */}
      {(busy || error) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-[85%] px-4 py-2 rounded-full bg-black/65 backdrop-blur-md border border-white/15 flex items-center gap-2">
          {busy && <Loader2 className="w-3.5 h-3.5 text-[#5FC7DE] animate-spin shrink-0" />}
          <span
            className={`text-[13px] font-sans font-medium ${error ? "text-[#FFB4A2]" : "text-white"}`}
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
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#5FC7DE] font-sans">
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
            className={`rounded-full bg-[#5FC7DE] transition-all duration-300 ${busy ? "w-6 h-6" : "w-14 h-14"}`}
          />
        </button>

        <div className="w-14" aria-hidden />
      </div>

      {/* Information card */}
      {result && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-[#F5F5F0] rounded-t-[2rem] border-t border-[#D6D6C2] shadow-2xl transition-transform duration-500 ease-out ${
            sheetOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight: "72%" }}
        >
          <div className="flex items-start gap-3 p-5 pb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[#147288] font-sans">
                  {result.category}
                </span>
                <span className="text-[11px] text-[#33332D]/50 font-sans">
                  {Math.round(result.confidence * 100)}% match
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#4A4A35] font-serif italic leading-tight">
                {result.title}
              </h3>
            </div>
            <button
              onClick={() => setSheetOpen(false)}
              aria-label="Close"
              className="h-9 w-9 rounded-xl bg-[#EBEBE0] border border-[#D6D6C2] flex items-center justify-center text-[#4A4A35] shrink-0 active:scale-95 transition-transform"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: "calc(72vh - 90px)" }}>
            <p className="text-[15px] text-[#33332D] leading-relaxed font-sans">{result.summary}</p>

            {result.highlights?.length > 0 && (
              <ul className="mt-4 space-y-2">
                {result.highlights.map((fact) => (
                  <li key={fact} className="flex gap-2.5 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#147288] mt-2 shrink-0" />
                    <span className="text-[14px] text-[#33332D] leading-relaxed font-sans">
                      {fact}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Recognition is AI-generated. Say so — a pilgrim should know which
                text is parish-verified and which is not. */}
            <p className="mt-5 text-[12px] text-[#33332D]/60 leading-relaxed font-sans bg-[#EBEBE0]/70 border border-[#D6D6C2] rounded-xl p-3">
              Identified by AI from your camera. Details may be incomplete — the parish record
              is the authority.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
