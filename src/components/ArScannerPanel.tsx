import { useState } from "react";
import { Check, Pause, Volume2 } from "lucide-react";
import type { Station } from "../types";
import { useNarration } from "../lib/useNarration";

/**
 * The AR half of the scanner.
 *
 * ## Why it has three states and not one button
 *
 * The AR tour only works in front of a printed marker, and the old
 * screen did not say so — it offered "Tour now" everywhere and failed
 * silently in the wrong half of the church. The three states are the
 * three honest answers to "can I do this right now": you are not at a
 * marker yet, I am reading one, the tour is running.
 *
 * ## Why confirming the marker is a tap and not a detection
 *
 * The marker is read by the Unity app, not by this WebView, so the page
 * genuinely cannot tell whether the pilgrim is standing in front of one.
 * Rather than pretend, it asks. A button the pilgrim presses when they
 * can see the marker is honest about where the knowledge lives, and it
 * is one tap either way.
 */

export type ArStage = "find" | "reading" | "live";

export default function ArScannerPanel({
  stage,
  error,
  onFoundMarker,
  onEndTour,
  onNextStop,
  station,
  stopNumber,
  stopCount,
  parishName,
}: {
  stage: ArStage;
  /** Why the handover to the AR app did not happen, when it did not. */
  error?: string | null;
  onFoundMarker: () => void;
  onEndTour: () => void;
  onNextStop: () => void;
  /** The stop the AR tour is on, once it is running. */
  station: Station | null;
  stopNumber: number;
  stopCount: number;
  parishName: string;
}) {
  if (stage === "find") {
    return (
      <div className="scan-panel">
        <h3 className="scan-panel__title">Only at the marker</h3>
        {error ? (
          // Replaces the instruction rather than sitting under it. Being
          // told what to do next matters more than being told again what
          // the feature is.
          <p className="scan-panel__body" role="alert" style={{ color: "#ffd9a8" }}>
            {error}
          </p>
        ) : (
          <p className="scan-panel__body">
            The AR tour runs from a printed SanctiWalk marker. Find the one beside
            the station, then point your camera at it.
          </p>
        )}
        <button type="button" onClick={onFoundMarker} className="scan-action">
          <Check className="w-4 h-4" /> I can see the marker
        </button>
      </div>
    );
  }

  if (stage === "reading") {
    return (
      <div className="scan-panel">
        <h3 className="scan-panel__title">Reading the marker</h3>
        <div className="scan-progress" role="progressbar" aria-label="Reading the marker" />
        <p className="scan-caption">Hold steady. Opening the AR tour for {parishName}.</p>
      </div>
    );
  }

  return (
    <LiveStop
      station={station}
      stopNumber={stopNumber}
      stopCount={stopCount}
      onEndTour={onEndTour}
      onNextStop={onNextStop}
    />
  );
}

/**
 * The stop the tour is on, with its narration.
 *
 * ## Why the narration is spoken rather than played
 *
 * No station has a recorded file — `audioUrl` is set on none of them.
 * The app already answered this once on the Map tab by reading the text
 * aloud with the browser's own voice, and doing the same here keeps one
 * answer rather than two. Nothing above this component changes when
 * real recordings arrive.
 */
function LiveStop({
  station, stopNumber, stopCount, onEndTour, onNextStop,
}: {
  station: Station | null;
  stopNumber: number;
  stopCount: number;
  onEndTour: () => void;
  onNextStop: () => void;
}) {
  const narration = useNarration();
  const [expanded, setExpanded] = useState(false);

  if (!station) {
    return (
      <div className="scan-panel">
        <h3 className="scan-panel__title">AR tour running</h3>
        <p className="scan-panel__body">Follow the markers around the church.</p>
        <button type="button" onClick={onEndTour} className="scan-action scan-action--quiet">
          End tour
        </button>
      </div>
    );
  }

  // What gets read aloud: what this is, then why it matters. The
  // reflection on its own opens mid-thought.
  const script = `${station.name}. ${station.description} ${station.reflection}`;

  return (
    <>
      <div className="scan-stop">
        <span className="scan-stop__n" aria-hidden>{stopNumber}</span>
        <div className="min-w-0 flex-1">
          <h3 className="scan-stop__name">{station.name}</h3>
          <p className="scan-stop__meta">
            Stop {stopNumber} of {stopCount} · AR view active
          </p>

          {narration.supported ? (
            <button
              type="button"
              onClick={() => narration.toggle(script)}
              className={`scan-listen${narration.speaking ? " is-speaking" : ""}`}
            >
              {narration.speaking
                ? <><Pause className="w-3.5 h-3.5" /> Stop narration</>
                : <><Volume2 className="w-3.5 h-3.5" /> Listen to this stop</>}
            </button>
          ) : (
            // Said rather than shown as a dead button.
            <p className="scan-stop__meta mt-2">
              This phone cannot read the narration aloud. The text is below.
            </p>
          )}

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="scan-stop__meta mt-2 block underline underline-offset-2"
          >
            {expanded ? "Hide the words" : "Read the words instead"}
          </button>

          {expanded && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-[rgb(255_255_255_/_0.82)]">
              {station.description} {station.reflection}
            </p>
          )}
        </div>
      </div>

      <div className="scan-row">
        <button
          type="button"
          onClick={() => { narration.stop(); onEndTour(); }}
          className="scan-action scan-action--quiet"
        >
          End tour
        </button>
        <button
          type="button"
          onClick={() => { narration.stop(); onNextStop(); }}
          className="scan-action"
        >
          Next stop
        </button>
      </div>
    </>
  );
}
