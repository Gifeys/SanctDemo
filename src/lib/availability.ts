import type { ParishContent } from "./parishContent";

/**
 * Whether a parish is currently accepting applications for a ministry or
 * a sacrament.
 *
 * ## Why a list of CLOSED ids and not a flag on each one
 *
 * Three reasons, and they all point the same way.
 *
 * Absent means open. The ministries and sacraments are compiled into
 * data.ts and 29 of the 31 parishes have no parishContent document at
 * all. A `Record<id, boolean>` would have to be seeded for every parish
 * before anything worked, and a parish nobody had seeded would read as
 * "false everywhere" - every ministry closed, on the day this shipped.
 * A list of exceptions is empty by default, and empty means normal.
 *
 * It is one field, so the security rules can enforce it. The rule on
 * creating an application has to answer "is this one closed" in a single
 * expression over one document; `itemId in closedApplications` does that.
 * Two maps would need two gets and a branch on kind.
 *
 * It says what the parish actually did. A parish closes the choir for
 * Lent; it does not "set thirty booleans, one of them false".
 *
 * ## Why ids and not names
 *
 * A ministry's name is displayed text and has been edited before -
 * "Lectors" became "Ministry of Lectors and Commentators (MLC)". Keying
 * off the name would have silently reopened it.
 */

/** Nothing is closed unless the parish has said so. */
export function closedIds(content: ParishContent | null | undefined): string[] {
  return content?.closedApplications ?? [];
}

/**
 * True when a pilgrim may apply for this ministry or sacrament.
 *
 * The one function the whole feature turns on. The Apply button, the
 * badge, the admin's toggle and the security rule all have to agree, so
 * they all come through here.
 */
export function isOpenForApplications(
  content: ParishContent | null | undefined,
  itemId: string,
): boolean {
  return !closedIds(content).includes(itemId);
}

/**
 * The list with one id closed or opened, for the admin's toggle.
 *
 * Returns a new array and keeps it sorted and free of duplicates: it is
 * written straight to Firestore, and a field that grows a second copy of
 * the same id every time someone double-taps is a field that eventually
 * cannot be read back.
 */
export function withAvailability(
  current: string[],
  itemId: string,
  open: boolean,
): string[] {
  const next = new Set(current);
  if (open) next.delete(itemId);
  else next.add(itemId);
  return [...next].sort();
}

export interface AvailabilitySummary {
  open: number;
  closed: number;
}

/** For the admin dashboard's parish-status panel. */
export function summarise(
  content: ParishContent | null | undefined,
  itemIds: string[],
): AvailabilitySummary {
  let open = 0;
  let closed = 0;
  for (const id of itemIds) {
    if (isOpenForApplications(content, id)) open++;
    else closed++;
  }
  return { open, closed };
}

/**
 * What the user app says in place of "Apply".
 *
 * Deliberately not "Disabled" or "Unavailable" on its own. A pilgrim
 * reading "Not available" on a ministry needs to know it is the
 * APPLICATIONS that are closed and that this is temporary - otherwise it
 * reads as the ministry having been disbanded.
 */
export function closedMessage(kind: "ministry" | "sacrament", name: string): string {
  return kind === "ministry"
    ? `Applications for ${name} are currently closed. Please check again later, or contact the parish office.`
    : `${name} applications are currently unavailable. Please check again later, or contact the parish office.`;
}
