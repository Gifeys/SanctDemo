import { useEffect, useState } from "react";
import { MASS_SCHEDULES } from "../data";
import { massStatus, type MassStatus } from "../lib/schedule";

interface MassNowBadgeProps {
  /** A route id — the two parishes whose schedule has been collected. */
  routeId: string | null | undefined;
  className?: string;
}

/**
 * "Mass now" / "Mass in 15 min" — live, or nothing at all.
 *
 * This is the question a mapping app structurally cannot answer and a parish
 * app must: not "when is the next Mass" but "can I still walk in". It renders
 * nothing outside those windows, so it reads as an event rather than as a
 * label that is always present.
 *
 * Only the two parishes with a collected schedule can show it. The other 29
 * render nothing rather than "no Mass", which would state as fact something
 * nobody has checked.
 */
export default function MassNowBadge({ routeId, className = "" }: MassNowBadgeProps) {
  const [status, setStatus] = useState<MassStatus>({ state: "none", time: null, minutes: 0 });

  useEffect(() => {
    const schedule = routeId ? MASS_SCHEDULES[routeId]?.schedule : undefined;
    if (!schedule) {
      setStatus({ state: "none", time: null, minutes: 0 });
      return;
    }

    // Re-checked every half minute so the badge appears and clears on its own
    // while the screen is left open — a pilgrim standing outside at 5:58 should
    // not have to reopen the app to see it turn over.
    const tick = () => setStatus(massStatus(schedule, new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [routeId]);

  if (status.state === "none") return null;

  const live = status.state === "in-progress";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[14px] font-semibold px-2.5 py-1 rounded-md ${
        live
          ? "bg-[var(--color-brand-error)] text-[var(--color-brand-on-accent)]"
          : "bg-[var(--color-brand-success)] text-[var(--color-brand-on-accent)]"
      } ${className}`}
    >
      {live && (
        <span
          aria-hidden
          className="w-2 h-2 rounded-full bg-current animate-pulse motion-reduce:animate-none"
        />
      )}
      {live ? `Mass now · ${status.time}` : `Mass in ${status.minutes} min`}
    </span>
  );
}
