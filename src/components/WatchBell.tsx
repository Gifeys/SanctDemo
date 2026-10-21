import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";

import { permissionState, requestPermission } from "../lib/deviceNotifications";
import { isWatched, onWatchChange, setWatched, type Watch } from "../lib/openingSubscriptions";

/**
 * The bell beside something that is closed.
 *
 * Tapping it is the pilgrim saying "tell me when this changes", and it
 * is the only place in the app that asks for notification permission.
 * That is on purpose. Asking on first launch, alongside location, gets
 * a reflexive no from somebody who has not yet seen anything worth
 * being told about; asking here, one tap after they have said they want
 * to be told, is the same question with its answer already given.
 *
 * It stays useful when the answer is no. The watch is stored either
 * way, and lib/useOpeningNotices still shows the change in the app -
 * what permission buys is being told without opening it.
 */
export default function WatchBell({
  watch,
  label,
  className = "",
  iconOnly = false,
}: {
  watch: Watch;
  /** What is being watched, for the screen reader: "Confirmation". */
  label: string;
  className?: string;
  /** The bell on its own, with no words beside it. */
  iconOnly?: boolean;
}) {
  const [on, setOn] = useState(() => isWatched(watch));
  const [note, setNote] = useState<string | null>(null);

  // Another bell on the same thing may have been tapped; see
  // onWatchChange in openingSubscriptions.
  useEffect(() => onWatchChange(() => setOn(isWatched(watch))), [watch.kind, watch.parishId, watch.itemId]);

  const toggle = useCallback(async () => {
    const next = !isWatched(watch);
    setWatched(watch, next);
    setOn(next);

    if (!next) {
      setNote(null);
      return;
    }

    // Only now, and only the first time.
    const state = await permissionState();
    const granted = state === "granted" ? state : await requestPermission();

    setNote(
      granted === "granted"
        ? "You'll be notified."
        : // Not an error, and not a nag to go to Settings. The watch is
          // kept and the notice will be waiting in the app.
          "Saved. You'll see it here next time you open the app.",
    );
  }, [watch.kind, watch.parishId, watch.itemId]);

  return (
    <span className="watch-bell__wrap">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? `Stop reminders about ${label}` : `Remind me when ${label} opens`}
        className={`watch-bell${on ? " is-on" : ""}${iconOnly ? " watch-bell--icon" : ""} ${className}`.trim()}
      >
        {on ? (
          <BellRing className="w-[18px] h-[18px]" aria-hidden />
        ) : (
          <Bell className="w-[18px] h-[18px]" aria-hidden />
        )}
        {/* The aria-label carries the whole meaning when the words are
            gone, which is why it names the thing rather than the icon. */}
        {!iconOnly && (
          <span className="watch-bell__text">{on ? "Reminding you" : "Notify me"}</span>
        )}
      </button>
      {/* The bell alone has no room beside it for a sentence; its own
          filled state is the acknowledgement there. */}
      {note && !iconOnly && (
        <span className="watch-bell__note" role="status">
          {note}
        </span>
      )}
    </span>
  );
}
