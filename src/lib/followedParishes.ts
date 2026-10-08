/**
 * Parishes you want reminders from, besides your own.
 *
 * ## The problem this solves
 *
 * Reminders were built from whichever parish the dashboard happened to
 * be showing. So looking up San Roque's Mass times quietly replaced
 * every reminder for your own parish, and looking back replaced them
 * again — the pilgrim never asked for either, and nothing on screen
 * said it had happened.
 *
 * Which parish you are READING about and which parishes you want to be
 * REMINDED about are two different questions. This answers the second
 * one, and only ever changes when somebody presses a switch.
 *
 * ## Why your own parish is not in the list
 *
 * It is always included, and it cannot be removed here. Storing it
 * would mean two places could disagree about where you belong, and the
 * first bug would be a pilgrim who changed parish and kept being woken
 * for the old one's 6am Mass. The home parish comes from the profile;
 * this list is strictly the extras.
 *
 * ## Why it lives on the device
 *
 * Same reasoning as the reminder settings themselves: these are the
 * alarms THIS phone has queued. A shared account should not mean a
 * shared alarm clock.
 */

const STORAGE_KEY = "sanctiwalk.followedParishes";

/** Enough for a pilgrim doing a Visita Iglesia; far short of the alarm cap. */
export const MAX_FOLLOWED = 5;

export function loadFollowed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtered on the way in: a malformed entry here becomes a Firestore
    // listener on a junk id later, which is a harder failure to trace.
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function saveFollowed(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private mode. The choice holds for this run and no longer.
  }
}

export function isFollowing(followed: string[], parishId: string): boolean {
  return followed.includes(parishId);
}

/**
 * Adds or removes one parish.
 *
 * Returns a new array, capped, and never containing the home parish —
 * that one is always on, so letting it in here would make the switch
 * for it look meaningful when it is not.
 */
export function withFollowed(
  followed: string[],
  parishId: string,
  follow: boolean,
  homeParishId?: string | null,
): string[] {
  if (parishId === homeParishId) return followed;

  if (!follow) return followed.filter(id => id !== parishId);
  if (followed.includes(parishId)) return followed;
  // Oldest out when full, rather than refusing. Somebody adding a sixth
  // parish means it, and a silent "no" from a switch that visibly moved
  // is worse than quietly retiring the one they chose longest ago.
  return [...followed, parishId].slice(-MAX_FOLLOWED);
}

/**
 * Every parish to build reminders for: yours first, then the extras.
 *
 * Yours leads because its reminders are the ones that matter most when
 * the cap trims the list, and the cap keeps the order it is given.
 */
export function remindableParishes(
  followed: string[],
  homeParishId?: string | null,
): string[] {
  const out = homeParishId ? [homeParishId] : [];
  for (const id of followed) {
    if (id !== homeParishId && !out.includes(id)) out.push(id);
  }
  return out;
}
