import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * A short recording of a feature, played over the screen.
 *
 * ## Why this exists
 *
 * The scanner and the AR tour can only be shown by doing them, and
 * doing them means standing in the church pointing a phone at the
 * altar. During a Mass that is not available, and a survey respondent
 * cannot be asked to imagine the feature from a description. So each
 * one carries a recording of itself.
 *
 * ## Why the file is bundled rather than streamed
 *
 * It is shown to respondents in a church hall on whatever signal the
 * building has. A video that buffers is worse than no video when
 * somebody is standing over your shoulder waiting, so both clips ship
 * inside the app and play with the network off.
 */
export default function PreviewVideo({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);

  // Escape closes it, as it would any dialog. Without this the only
  // way out on a desktop browser is the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Paused on the way out. A video left playing behind a closed dialog
  // keeps its audio going, which during a demonstration is the worst
  // possible moment for it.
  useEffect(() => () => video.current?.pause(), []);

  return (
    <div
      className="preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      {/* Stops a tap inside the player from closing it. */}
      <div className="preview-box" onClick={e => e.stopPropagation()}>
        <div className="preview-bar">
          <span className="preview-title">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close preview" className="preview-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <video
          ref={video}
          src={src}
          controls
          autoPlay
          playsInline
          controlsList="nodownload"
          className="preview-video"
        />

        <p className="preview-note">
          A recording of the feature. Tap play, pause or full screen as you would any video.
        </p>
      </div>
    </div>
  );
}
