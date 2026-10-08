import { useEffect, useMemo, useRef, useState } from "react";
import { watchParishContent, type ParishContent } from "./parishContent";

/**
 * Admin-managed content for several parishes at once.
 *
 * `useParishContent` watches one parish, which was right while the app
 * only ever cared about the one on screen. Reminders changed that: a
 * pilgrim can follow a second parish, and its Mass times have to be as
 * current as their own — a reminder built from the times compiled into
 * the app would keep sending them to a Mass the parish moved.
 *
 * ## Why the ids are joined into a string
 *
 * The caller builds the array inline, so a new one arrives on every
 * render and an effect keyed on the array itself would tear down and
 * rebuild every listener each time. Keyed on the joined ids, it only
 * reacts when the SET actually changes.
 */
export function useParishContents(
  parishIds: string[],
): Record<string, ParishContent | null> {
  const key = parishIds.join("|");
  const [contents, setContents] = useState<Record<string, ParishContent | null>>({});

  // Read inside the effect so the effect does not depend on the array.
  const idsRef = useRef(parishIds);
  idsRef.current = parishIds;

  useEffect(() => {
    const ids = idsRef.current;
    if (ids.length === 0) {
      setContents({});
      return;
    }

    const unsubscribes = ids.map(id =>
      watchParishContent(id, content =>
        setContents(current => ({ ...current, [id]: content })),
      ),
    );

    return () => {
      for (const stop of unsubscribes) stop();
      // Drop parishes that are no longer followed, so a stale schedule
      // cannot go on producing reminders after the switch is turned off.
      setContents(current => {
        const next: Record<string, ParishContent | null> = {};
        for (const id of idsRef.current) {
          if (id in current) next[id] = current[id];
        }
        return next;
      });
    };
  }, [key]);

  // Stable while the contents are unchanged, so the scheduler below
  // does not rebuild every alarm on every render.
  return useMemo(() => contents, [contents]);
}
