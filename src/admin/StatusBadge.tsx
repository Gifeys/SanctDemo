import { STATUS_LABEL } from "../lib/applications";
import type { ApplicationStatus } from "../types";

/**
 * A status, as a word and a colour.
 *
 * The word is not decoration. Colour alone fails for anyone who cannot
 * separate the hues, and it fails again when the table is printed, which
 * a parish office does. The tint narrows the search; the word is the
 * answer.
 */
const TONE: Record<ApplicationStatus, { bg: string; fg: string }> = {
  pending:      { bg: "var(--color-brand-card-sunk)", fg: "var(--color-brand-text)" },
  under_review: { bg: "#E8EEF8", fg: "#1C2C56" },
  approved:     { bg: "#E4F0E8", fg: "#2F5A41" },
  rejected:     { bg: "#FBE9E4", fg: "#8E3F2C" },
  completed:    { bg: "#EDE7F6", fg: "#4A3B70" },
};

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  const tone = TONE[status] ?? TONE.pending;
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-[13px] font-bold whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
