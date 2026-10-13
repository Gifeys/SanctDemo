import { Check } from "lucide-react";

/**
 * The AR half of the scanner.
 *
 * ## Why it stops at the door
 *
 * It used to run a tour of its own once the handover happened: stop 1
 * of 3, the station's name, its narration read aloud, End tour, Next
 * stop. All of it over a camera view that was no longer doing anything,
 * underneath an AR app that was already showing the station's name and
 * already reading it aloud — and the two could not agree, because only
 * the AR app knows which statue the pilgrim is standing in front of.
 * SanctiWalk was guessing and the guess was on top.
 *
 * So the tour belongs to the AR app, whole. This is the door to it and
 * the way back in, and nothing else.
 *
 * ## Why it no longer asks the pilgrim to find the marker first
 *
 * It used to: "I can see the marker", pressed before the handover. That
 * made the pilgrim do the marker step twice, because the AR app opens on
 * its own marker screen and reads the sheet itself - so the honest
 * answer to "are you at a marker" was always "the next app will tell
 * you". Two screens asking the same question, and the first one could
 * only guess.
 *
 * So this is now a door, not a checkpoint: it says what is about to
 * happen and opens the tour. Finding the marker belongs to the app that
 * can actually see it.
 */

export type ArStage = "find" | "reading" | "live";

export default function ArScannerPanel({
  stage,
  error,
  onFoundMarker,
  parishName,
}: {
  stage: ArStage;
  /** Why the handover to the AR app did not happen, when it did not. */
  error?: string | null;
  onFoundMarker: () => void;
  parishName: string;
}) {
  if (stage === "reading") {
    return (
      <div className="scan-panel">
        <h3 className="scan-panel__title">Opening the AR tour</h3>
        <div className="scan-progress" role="progressbar" aria-label="Opening the AR tour" />
        <p className="scan-caption">Starting the AR app for {parishName}.</p>
      </div>
    );
  }

  // "live" means the AR app took the screen and the pilgrim has come
  // back to this one. The tour is still theirs to walk over there, so
  // the only thing worth offering is the way back.
  const live = stage === "live";

  return (
    <div className="scan-panel">
      <h3 className="scan-panel__title">
        {live ? "AR tour is open" : "AR Museum tour"}
      </h3>
      {error ? (
        <p className="scan-panel__body" role="alert" style={{ color: "#ffd9a8" }}>
          {error}
        </p>
      ) : (
        <p className="scan-panel__body">
          {live
            ? "The tour is running in the SanctiWalk AR app. Switch back to it to carry on walking."
            : "Walk the church and hear each statue, altar and image tell its own story. The tour opens in the SanctiWalk AR app and starts by reading the printed marker."}
        </p>
      )}
      <button type="button" onClick={onFoundMarker} className="scan-action">
        <Check className="w-4 h-4" /> {live ? "Back to the AR tour" : "Open AR tour"}
      </button>
    </div>
  );
}
