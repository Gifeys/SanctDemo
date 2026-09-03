import { useEffect, useState } from "react";
import { watchParishContent, type ParishContent } from "./parishContent";

/**
 * Live admin-managed content for one parish, or null while it loads and for
 * every parish nobody has edited yet.
 *
 * Subscribed rather than fetched, so a photo an admin uploads on one phone
 * appears on every other device without anyone reloading — which is the
 * behaviour a parish office expects of a noticeboard.
 *
 * Callers must treat null as "use the values from data.ts". Nothing here
 * replaces the compiled content; it only overlays it.
 */
export function useParishContent(parishId: string | null | undefined): ParishContent | null {
  const [content, setContent] = useState<ParishContent | null>(null);

  useEffect(() => {
    if (!parishId) {
      setContent(null);
      return;
    }
    setContent(null); // clear the previous parish's content while the new one loads
    return watchParishContent(parishId, setContent);
  }, [parishId]);

  return content;
}
