/**
 * "Accepting applications" / "Not available", as a chip.
 *
 * ## Why the closed state is grey and not red
 *
 * A parish closing the choir to new members for Lent is housekeeping, not
 * an error. Red is what the app uses for a rejected application and for a
 * form that would not send, and borrowing it here would tell a pilgrim
 * that something had gone wrong with THEM.
 *
 * ## Why the dot is not the whole signal
 *
 * A coloured dot alone is invisible to a screen reader and ambiguous to
 * the roughly one man in twelve who cannot separate the two colours. The
 * words carry the meaning; the dot only makes it quicker to scan.
 */
export default function AvailabilityBadge({
  open,
  kind,
  className = "",
}: {
  open: boolean;
  kind: "ministry" | "sacrament";
  className?: string;
}) {
  const label = open
    ? kind === "ministry" ? "Accepting applications" : "Applications open"
    : "Not available";

  return (
    <span
      className={`availability-badge${open ? "" : " availability-badge--closed"} ${className}`}
    >
      <span className="availability-badge__dot" aria-hidden />
      {label}
    </span>
  );
}
