import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The scanner's furniture: the instruction over the camera, the dark
 * sheet at the bottom, and the control that switches between the two
 * scanners.
 *
 * ## Why these are separate from ArTour
 *
 * ArTour is 900 lines of camera handling, recognition and error states.
 * The chrome is the part the client is actually looking at, it is the
 * same in every state, and keeping it here means a change to the look
 * is one file rather than a hunt through the logic.
 *
 * ## The look
 *
 * Near-black is not a style choice here — it is a darkened camera feed,
 * and anything placed on it has to survive a bright window behind a
 * statue or an unlit side chapel. So: white type at two weights,
 * everything else held back, and exactly one accent.
 *
 * That accent is a candle gold rather than the usual interface blue.
 * The parish's navy disappears against a dark nave, and this is the one
 * colour in the building that is already associated with "look here" -
 * gilt on a retablo, a lit taper. It is spent on the AR states only,
 * where the pilgrim is being asked to find something.
 */

export type ScannerMode = "ai" | "ar";

/**
 * The instruction, centred over the camera.
 *
 * Two lines and no more: what to point at, and what will happen. Anyone
 * reading this is holding a phone up in a church, which is not the
 * posture for a paragraph.
 */
export function ScannerHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  return (
    <div className="scan-head">
      <div className="scan-head__text">
        <h2 className="scan-head__title">{title}</h2>
        {subtitle && <p className="scan-head__sub">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the scanner"
          className="scan-head__close"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/** The dark panel the controls live in. */
export function ScannerSheet({ children }: { children: ReactNode }) {
  return <div className="scan-sheet">{children}</div>;
}

/**
 * AI or AR.
 *
 * Two radio buttons wearing a segmented control, rather than two
 * `<button>`s with an `aria-pressed` each. They are one choice with two
 * answers, and a radiogroup is the only shape that says so to a screen
 * reader — and it brings arrow-key movement between them for free.
 */
export function ScannerTabs({
  mode,
  onChange,
}: {
  mode: ScannerMode;
  onChange: (mode: ScannerMode) => void;
}) {
  const options: Array<{ value: ScannerMode; label: string; hint: string }> = [
    { value: "ai", label: "AI Scanner", hint: "Identify anything with the camera" },
    { value: "ar", label: "AR Scanner", hint: "Start the AR tour at a marker" },
  ];

  return (
    <div className="scan-tabs" role="radiogroup" aria-label="Which scanner">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mode === option.value}
          aria-label={`${option.label}. ${option.hint}`}
          onClick={() => onChange(option.value)}
          className={`scan-tab${mode === option.value ? " is-on" : ""}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The corner brackets that say "put it here".
 *
 * Drawn as four corners rather than a full rectangle: a closed frame
 * reads as a border around the whole picture, while corners read as a
 * target to fill. `tight` pulls them in and warms them to gold while
 * something is being read, so the state change is visible without any
 * text having to announce it.
 */
export function ScannerReticle({ tight }: { tight?: boolean }) {
  return (
    <div className={`scan-reticle${tight ? " is-reading" : ""}`} aria-hidden>
      <span className="scan-reticle__c scan-reticle__c--tl" />
      <span className="scan-reticle__c scan-reticle__c--tr" />
      <span className="scan-reticle__c scan-reticle__c--bl" />
      <span className="scan-reticle__c scan-reticle__c--br" />
    </div>
  );
}
